/**
 * AIRDROP — Push CLAW tokens directly to all linked wallets
 *
 * Usage:
 *   CLAW_TOKEN=0x... npx hardhat run scripts/airdrop.js --network base
 *
 * Reads wallet balances from the mbc20.xyz API and airdrops in batches of 100.
 * Uses cumulative claimed tracking — safe to run multiple times (idempotent).
 */

const hre = require("hardhat");
const https = require("https");

// mbc20.xyz API (running on VM)
const API_BASE = "https://mbc20.xyz";

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "Accept": "application/json" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${data.substring(0, 200)}`));
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Airdropping with:", deployer.address);

  // Get ClaimManager address
  const claimManagerAddr = process.env.CLAIM_MANAGER;
  if (!claimManagerAddr) {
    throw new Error("Set CLAIM_MANAGER=0x... env var");
  }

  const claimManager = await hre.ethers.getContractAt("ClaimManager", claimManagerAddr);
  const treasuryAddr = await claimManager.treasury();

  if (deployer.address.toLowerCase() !== treasuryAddr.toLowerCase()) {
    throw new Error(`Deployer ${deployer.address} is not treasury ${treasuryAddr}. Only treasury can airdrop.`);
  }

  // Fetch all linked wallets with CLAW balances from the API
  console.log("Fetching airdrop data from mbc20.xyz...");
  const data = await fetchJSON(`${API_BASE}/api/airdrop-data?tick=CLAW`);

  if (!data.wallets || data.wallets.length === 0) {
    console.log("No wallets to airdrop to.");
    return;
  }

  console.log(`Found ${data.wallets.length} wallets to airdrop`);
  console.log(`Total tokens: ${hre.ethers.formatEther(BigInt(data.totalAmount))} CLAW`);

  // Batch in groups of 100
  const BATCH_SIZE = 100;
  let totalAirdropped = 0n;
  let skipped = 0;

  for (let i = 0; i < data.wallets.length; i += BATCH_SIZE) {
    const batch = data.wallets.slice(i, i + BATCH_SIZE);
    const wallets = batch.map((w) => w.wallet);
    const amounts = batch.map((w) => BigInt(w.amount));

    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(data.wallets.length / BATCH_SIZE)}: ${wallets.length} wallets`);

    try {
      const tx = await claimManager.batchAirdrop("CLAW", wallets, amounts);
      const receipt = await tx.wait();
      console.log(`  TX: ${receipt.hash}`);
      console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

      // Count claimed events
      const claimedEvents = receipt.logs.filter(
        (log) => log.topics[0] === claimManager.interface.getEvent("Claimed").topicHash
      );
      totalAirdropped += amounts.reduce((a, b) => a + b, 0n);
      skipped += wallets.length - claimedEvents.length;
      console.log(`  Airdropped: ${claimedEvents.length}, Skipped (already claimed): ${wallets.length - claimedEvents.length}`);
    } catch (err) {
      console.error(`  Batch failed:`, err.message);
    }
  }

  console.log("\n=== AIRDROP COMPLETE ===");
  console.log(`Total wallets processed: ${data.wallets.length}`);
  console.log(`Total tokens sent: ${hre.ethers.formatEther(totalAirdropped)} CLAW`);
  console.log(`Skipped (already claimed): ${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
