const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  const SIGNER = process.env.SIGNER_ADDRESS;
  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;
  const TEAM_WALLET = process.env.TEAM_WALLET || TREASURY;
  const REWARD_POOL = process.env.REWARD_POOL || "0x174910FBc832931FA5DF3E9014d51c964BF0D4fF";
  let USDC = process.env.USDC_ADDRESS;
  const CLAIM_FEE = hre.ethers.parseEther("0.0001"); // ~$0.25 on Base

  if (!SIGNER) {
    throw new Error("Set SIGNER_ADDRESS in .env");
  }

  // 0. Deploy MockUSDC if needed (testnet only)
  if (!USDC || USDC === "deploy_mock") {
    console.log("\n0. Deploying MockUSDC (testnet)...");
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    USDC = await mockUsdc.getAddress();
    console.log("  MockUSDC:", USDC);
  }

  // Predict Factory address: ClaimManager is next tx (nonce), Factory is nonce+1
  const nonce = await deployer.getNonce();
  const futureFactoryAddr = hre.ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 1 });

  // 1. Deploy ClaimManager
  console.log("\n1. Deploying ClaimManager...");
  const ClaimManager = await hre.ethers.getContractFactory("ClaimManager");
  const claimManager = await ClaimManager.deploy(
    futureFactoryAddr, // factory (will be deployed next)
    SIGNER,
    TREASURY,
    CLAIM_FEE
  );
  await claimManager.waitForDeployment();
  const claimManagerAddr = await claimManager.getAddress();
  console.log("  ClaimManager:", claimManagerAddr);

  // 2. Deploy Factory (authorized caller = ClaimManager)
  console.log("2. Deploying MBC20Factory...");
  const Factory = await hre.ethers.getContractFactory("MBC20Factory");
  const factory = await Factory.deploy(claimManagerAddr, TEAM_WALLET, REWARD_POOL);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("  MBC20Factory:", factoryAddr);

  // Verify prediction
  if (factoryAddr !== futureFactoryAddr) {
    throw new Error(`Factory address mismatch! Got ${factoryAddr}, expected ${futureFactoryAddr}`);
  }
  console.log("  Factory address prediction verified!");

  // 3. Deploy Marketplace
  console.log("3. Deploying MBC20Marketplace...");
  const Marketplace = await hre.ethers.getContractFactory("MBC20Marketplace");
  const marketplace = await Marketplace.deploy(USDC, TREASURY);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("  MBC20Marketplace:", marketplaceAddr);

  // Summary
  console.log("\n=== Deployment Complete ===");
  console.log("ClaimManager:    ", claimManagerAddr);
  console.log("MBC20Factory:    ", factoryAddr);
  console.log("MBC20Marketplace:", marketplaceAddr);
  console.log("Signer:          ", SIGNER);
  console.log("Treasury:        ", TREASURY);
  console.log("Team Wallet:     ", TEAM_WALLET);
  console.log("Reward Pool:     ", REWARD_POOL);
  console.log("USDC:            ", USDC);
  console.log("Claim fee:       ", hre.ethers.formatEther(CLAIM_FEE), "ETH");

  // Post-deploy instructions
  console.log("\n=== Post-Deploy Steps ===");
  console.log("1. Call claimManager.initToken('CLAW', 21000000e18) to create CLAW");
  console.log("2. Create Aerodrome LP pair for CLAW/USDC (or CLAW/ETH)");
  console.log("3. Call token.setPool(lpPairAddress, true) via Factory owner");
  console.log("4. Call token.setPool(marketplaceAddress, true) if using marketplace");
  console.log("5. Call token.startLaunch() when ready for 17:00 UTC");
  console.log("6. After LP + pools are set, call token.renounceOwnership()");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
