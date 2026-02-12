/**
 * CLAW LAUNCH SCRIPT — One command to deploy everything on Base mainnet
 *
 * Usage:
 *   npx hardhat run scripts/launch.js --network base
 *
 * What it does:
 *   1. Deploys ClaimManager + Factory + Marketplace on Base mainnet
 *   2. Calls initToken("CLAW", 21M) to create the CLAW ERC-20
 *   3. Sets marketplace as pool on the CLAW token (enables 2% fee)
 *   4. Outputs all addresses + next steps
 *
 * After deployment:
 *   - renounceOwnership() → call after verifying everything works
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("╔══════════════════════════════════════════╗");
  console.log("║        $CLAW MAINNET LAUNCH              ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Network:", (await hre.ethers.provider.getNetwork()).chainId.toString());
  console.log("");

  if (balance < hre.ethers.parseEther("0.005")) {
    throw new Error("Insufficient balance. Need at least 0.005 ETH on Base mainnet.");
  }

  // Config
  const SIGNER = process.env.SIGNER_ADDRESS || "0x22dA4D6314B863dD7c3a39E6f338c8cF0BEC7d9f";
  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;
  const TEAM_WALLET = process.env.TEAM_WALLET || TREASURY;
  const REWARD_POOL = "0x174910FBc832931FA5DF3E9014d51c964BF0D4fF";
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base mainnet USDC
  const CLAIM_FEE = hre.ethers.parseEther("0.0001");
  const CLAW_MAX_SUPPLY = hre.ethers.parseEther("21000000"); // 21M

  console.log("=== Config ===");
  console.log("Signer:      ", SIGNER);
  console.log("Treasury:    ", TREASURY);
  console.log("Team Wallet: ", TEAM_WALLET);
  console.log("Reward Pool: ", REWARD_POOL);
  console.log("USDC:        ", USDC);
  console.log("Claim Fee:   ", hre.ethers.formatEther(CLAIM_FEE), "ETH");
  console.log("");

  // ─── Step 1: Deploy ClaimManager ───
  console.log("1/5 Deploying ClaimManager...");
  const nonce = await deployer.getNonce();
  const futureFactoryAddr = hre.ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 1 });

  const ClaimManager = await hre.ethers.getContractFactory("ClaimManager");
  const claimManager = await ClaimManager.deploy(futureFactoryAddr, SIGNER, TREASURY, CLAIM_FEE);
  await claimManager.waitForDeployment();
  const claimManagerAddr = await claimManager.getAddress();
  console.log("  ClaimManager:", claimManagerAddr);

  // ─── Step 2: Deploy Factory ───
  console.log("2/5 Deploying MBC20Factory...");
  const Factory = await hre.ethers.getContractFactory("MBC20Factory");
  const factory = await Factory.deploy(claimManagerAddr, TEAM_WALLET, REWARD_POOL);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();

  if (factoryAddr !== futureFactoryAddr) {
    throw new Error(`Factory address mismatch! ${factoryAddr} != ${futureFactoryAddr}`);
  }
  console.log("  MBC20Factory:", factoryAddr, "(prediction verified)");

  // ─── Step 3: Deploy Marketplace ───
  console.log("3/5 Deploying MBC20Marketplace...");
  const Marketplace = await hre.ethers.getContractFactory("MBC20Marketplace");
  const marketplace = await Marketplace.deploy(USDC, TREASURY);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("  Marketplace:", marketplaceAddr);

  // ─── Step 4: Init CLAW token ───
  console.log("4/5 Creating CLAW token (initToken)...");
  const initTx = await claimManager.initToken("CLAW", CLAW_MAX_SUPPLY);
  await initTx.wait();
  const clawTokenAddr = await factory.getToken("CLAW");
  console.log("  CLAW Token:", clawTokenAddr);

  // ─── Step 5: Set marketplace as pool ───
  console.log("5/5 Setting marketplace as trading pool...");
  const clawToken = await hre.ethers.getContractAt("MBC20Token", clawTokenAddr);
  const poolTx = await clawToken.setPool(marketplaceAddr, true);
  await poolTx.wait();
  console.log("  Marketplace set as pool (2% fee active on trades)");

  // ─── Summary ───
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║        DEPLOYMENT COMPLETE                ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log("ClaimManager:     ", claimManagerAddr);
  console.log("MBC20Factory:     ", factoryAddr);
  console.log("MBC20Marketplace: ", marketplaceAddr);
  console.log("CLAW Token:       ", clawTokenAddr);
  console.log("Reward Pool:      ", REWARD_POOL);
  console.log("USDC:             ", USDC);
  console.log("");

  const balanceAfter = await hre.ethers.provider.getBalance(deployer.address);
  console.log("ETH spent:", hre.ethers.formatEther(balance - balanceAfter), "ETH");
  console.log("");

  // Output env vars for VM update
  console.log("=== Copy these to VM .env ===");
  console.log(`CHAIN_ID=8453`);
  console.log(`CLAIM_MANAGER_ADDRESS=${claimManagerAddr}`);
  console.log(`MBC20_FACTORY_ADDRESS=${factoryAddr}`);
  console.log(`MARKETPLACE_ADDRESS=${marketplaceAddr}`);
  console.log(`CLAW_TOKEN_ADDRESS=${clawTokenAddr}`);
  console.log(`MOCK_USDC_ADDRESS=${USDC}`);
  console.log("");
  console.log("=== Copy these to VM .env.local ===");
  console.log(`NEXT_PUBLIC_CHAIN=mainnet`);
  console.log(`NEXT_PUBLIC_TRADING_LIVE=true`);
  console.log("");
  console.log("=== NEXT STEPS (manual) ===");
  console.log("1. Update VM .env + .env.local with addresses above");
  console.log("2. Update web3-config.ts with new addresses");
  console.log("3. Rebuild: npx next build && pm2 restart mbc20");
  console.log(`4. Airdrop: CLAIM_MANAGER=${claimManagerAddr} npx hardhat run scripts/airdrop.js --network base`);
  console.log("5. After verification: call token.renounceOwnership()");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
