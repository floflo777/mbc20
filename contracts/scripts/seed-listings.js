/**
 * Seed 100 sell listings on the marketplace with varied amounts and prices
 * Usage: npx hardhat run scripts/seed-listings.js --network base
 */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Seeding listings with:", deployer.address);

  const CLAW = "0x869F37b5eD9244e4Bc952EEad011E04E7860E844";
  const MARKETPLACE = "0xfa1c15539E1740a8B0078211b01F00ed49E2C5A8";
  const CLAIM_MANAGER = "0x08EbdA4c5dcDA94385D86EAc267f89E46EafCE11";
  const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const ZERO = "0x0000000000000000000000000000000000000000";

  const token = await hre.ethers.getContractAt("MBC20Token", CLAW);
  const marketplace = await hre.ethers.getContractAt("MBC20Marketplace", MARKETPLACE);
  const claimManager = await hre.ethers.getContractAt("ClaimManager", CLAIM_MANAGER);

  // Step 1: Mint 200k CLAW to deployer via batchAirdrop
  const currentBal = await token.balanceOf(deployer.address);
  console.log("Current CLAW balance:", hre.ethers.formatEther(currentBal));

  const NEED = hre.ethers.parseEther("200000");
  if (currentBal < NEED) {
    const mintAmount = NEED - currentBal;
    console.log("Minting", hre.ethers.formatEther(mintAmount), "CLAW to deployer...");
    const tx = await claimManager.batchAirdrop("CLAW", [deployer.address], [mintAmount]);
    await tx.wait();
    console.log("Minted. New balance:", hre.ethers.formatEther(await token.balanceOf(deployer.address)));
  }

  // Step 2: Approve marketplace for max
  console.log("Approving marketplace...");
  const approveTx = await token.approve(MARKETPLACE, hre.ethers.MaxUint256);
  await approveTx.wait();
  console.log("Approved");

  // Step 3: Generate 100 listings
  // Amounts: 50-8000 CLAW (skewed toward smaller)
  // Prices: $0.08-$0.85 in ETH (at ~$2600/ETH)
  const ETH_PRICE = 2600;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randAmount() {
    const r = Math.random();
    if (r < 0.3) return randInt(50, 300);       // 30% small orders
    if (r < 0.6) return randInt(300, 1500);      // 30% medium
    if (r < 0.85) return randInt(1500, 4000);    // 25% large
    return randInt(4000, 8000);                   // 15% very large
  }

  function randPrice() {
    const r = Math.random();
    if (r < 0.15) return 0.08 + Math.random() * 0.07;  // $0.08-0.15
    if (r < 0.40) return 0.15 + Math.random() * 0.15;  // $0.15-0.30
    if (r < 0.70) return 0.30 + Math.random() * 0.20;  // $0.30-0.50
    if (r < 0.90) return 0.50 + Math.random() * 0.20;  // $0.50-0.70
    return 0.70 + Math.random() * 0.15;                 // $0.70-0.85
  }

  const listings = [];
  for (let i = 0; i < 100; i++) {
    const amount = randAmount();
    const priceUsd = randPrice();
    const priceEth = priceUsd / ETH_PRICE;
    // Use ETH payment (70%) or USDC (30%)
    const useEth = Math.random() < 0.7;

    listings.push({
      amount,
      priceUsd: priceUsd.toFixed(4),
      priceWei: useEth
        ? hre.ethers.parseEther(priceEth.toFixed(18))
        : BigInt(Math.round(priceUsd * 1e6)),  // USDC 6 decimals
      paymentToken: useEth ? ZERO : USDC_ADDR,
      payLabel: useEth ? "ETH" : "USDC",
    });
  }

  const totalAmount = listings.reduce((s, l) => s + l.amount, 0);
  console.log(`\nCreating 100 listings (total: ${totalAmount} CLAW)`);
  console.log("Price range: $0.08 - $0.85");

  let success = 0;
  let failed = 0;

  for (let i = 0; i < listings.length; i++) {
    const l = listings[i];
    const amountWei = hre.ethers.parseEther(l.amount.toString());

    try {
      const tx = await marketplace.list(CLAW, amountWei, l.priceWei, l.paymentToken);
      await tx.wait();
      success++;
      if ((i + 1) % 10 === 0) {
        console.log(`  ${i + 1}/100 done (${success} ok, ${failed} failed) | Last: ${l.amount} CLAW @ $${l.priceUsd} [${l.payLabel}]`);
      }
    } catch (err) {
      failed++;
      console.log(`  #${i + 1} FAILED: ${l.amount} CLAW @ $${l.priceUsd} - ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`\n=== DONE: ${success} listings created, ${failed} failed ===`);
  const finalBal = await token.balanceOf(deployer.address);
  console.log("Remaining CLAW balance:", hre.ethers.formatEther(finalBal));

  const orderCount = await marketplace.orderCount();
  console.log("Total marketplace orders:", orderCount.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
