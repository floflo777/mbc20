const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const token = await hre.ethers.getContractAt("MBC20Token", "0x869F37b5eD9244e4Bc952EEad011E04E7860E844");
  const balance = await token.balanceOf(deployer.address);
  console.log("Burning", hre.ethers.formatEther(balance), "CLAW...");
  const tx = await token.burn(balance);
  const receipt = await tx.wait();
  console.log("BURNED! TX hash:", receipt.hash);
  const after = await token.balanceOf(deployer.address);
  console.log("Remaining balance:", hre.ethers.formatEther(after));
}

main().catch((e) => { console.error(e); process.exit(1); });
