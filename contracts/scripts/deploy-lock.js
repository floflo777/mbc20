const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TokenLock with:", deployer.address);

  const CLAW_TOKEN = "0x869F37b5eD9244e4Bc952EEad011E04E7860E844";
  const BENEFICIARY = deployer.address; // team wallet
  const SIX_MONTHS = 180 * 24 * 60 * 60; // 180 days in seconds
  const unlockTime = Math.floor(Date.now() / 1000) + SIX_MONTHS;

  const unlockDate = new Date(unlockTime * 1000);
  console.log("Token:", CLAW_TOKEN);
  console.log("Beneficiary:", BENEFICIARY);
  console.log("Unlock time:", unlockTime, "(" + unlockDate.toISOString() + ")");

  const TokenLock = await hre.ethers.getContractFactory("TokenLock");
  const lock = await TokenLock.deploy(CLAW_TOKEN, BENEFICIARY, unlockTime);
  await lock.waitForDeployment();

  const address = await lock.getAddress();
  console.log("\nTokenLock deployed at:", address);
  console.log("\nSend CLAW tokens to this address to lock them for 6 months.");
  console.log("Nobody can withdraw until:", unlockDate.toISOString());
}

main().catch((e) => { console.error(e); process.exit(1); });
