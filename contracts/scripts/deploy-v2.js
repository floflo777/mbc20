const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying V2 with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  const SIGNER = process.env.SIGNER_ADDRESS;
  const CLAW_TOKEN = process.env.CLAW_TOKEN;
  const DEPLOYMENT_COST = hre.ethers.parseEther(process.env.DEPLOYMENT_COST || "1000"); // 1000 CLAW default

  if (!SIGNER) throw new Error("Set SIGNER_ADDRESS in .env");
  if (!CLAW_TOKEN) throw new Error("Set CLAW_TOKEN in .env");

  // Predict FactoryV2 address: ClaimManagerV2 is next tx (nonce), FactoryV2 is nonce+1
  const nonce = await deployer.getNonce();
  const futureFactoryAddr = hre.ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 1 });

  // 1. Deploy ClaimManagerV2
  console.log("\n1. Deploying ClaimManagerV2...");
  const ClaimManagerV2 = await hre.ethers.getContractFactory("ClaimManagerV2");
  const claimManagerV2 = await ClaimManagerV2.deploy(futureFactoryAddr, SIGNER);
  await claimManagerV2.waitForDeployment();
  const claimManagerV2Addr = await claimManagerV2.getAddress();
  console.log("  ClaimManagerV2:", claimManagerV2Addr);

  // 2. Deploy FactoryV2
  console.log("2. Deploying MBC20FactoryV2...");
  const FactoryV2 = await hre.ethers.getContractFactory("MBC20FactoryV2");
  const factoryV2 = await FactoryV2.deploy(claimManagerV2Addr, CLAW_TOKEN, DEPLOYMENT_COST);
  await factoryV2.waitForDeployment();
  const factoryV2Addr = await factoryV2.getAddress();
  console.log("  MBC20FactoryV2:", factoryV2Addr);

  // Verify prediction
  if (factoryV2Addr !== futureFactoryAddr) {
    throw new Error(`Factory address mismatch! Got ${factoryV2Addr}, expected ${futureFactoryAddr}`);
  }
  console.log("  Factory address prediction verified!");

  // Summary
  console.log("\n=== V2 Deployment Complete ===");
  console.log("ClaimManagerV2:  ", claimManagerV2Addr);
  console.log("MBC20FactoryV2:  ", factoryV2Addr);
  console.log("Signer:          ", SIGNER);
  console.log("CLAW Token:      ", CLAW_TOKEN);
  console.log("Deployment Cost: ", hre.ethers.formatEther(DEPLOYMENT_COST), "CLAW");

  console.log("\n=== Post-Deploy Steps ===");
  console.log("1. Verify ClaimManagerV2 on Etherscan:");
  console.log(`   npx hardhat verify --network base ${claimManagerV2Addr} ${futureFactoryAddr} ${SIGNER}`);
  console.log("2. Verify FactoryV2 on Etherscan:");
  console.log(`   npx hardhat verify --network base ${factoryV2Addr} ${claimManagerV2Addr} ${CLAW_TOKEN} ${DEPLOYMENT_COST}`);
  console.log("3. Anyone can now call factoryV2.createToken(tick, maxSupply) after approving CLAW");
  console.log("4. After deploying a token, the deployer must:");
  console.log("   - Call token.setPool(marketplaceAddr, true)");
  console.log("   - Call token.renounceOwnership()");
  console.log("   - Call claimManagerV2.batchAirdrop() to distribute tokens");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
