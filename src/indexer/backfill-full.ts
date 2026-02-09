import { MoltbookClient } from "./moltbook"
import { OperationProcessor } from "./processor"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const moltbook = new MoltbookClient()
const processor = new OperationProcessor(prisma)

const BATCH_SIZE = 100

async function backfill() {
  console.log("Starting FULL backfill with sort=new...")
  
  let offset = 0
  let totalProcessed = 0
  let totalSkipped = 0
  let emptyBatches = 0
  
  while (true) {
    try {
      const { posts, hasMore } = await moltbook.fetchPosts({ 
        limit: BATCH_SIZE, 
        offset,
        sort: "new"
      })
      
      if (posts.length === 0) {
        emptyBatches++
        if (emptyBatches >= 3) {
          console.log("No more posts at offset " + offset + ". Stopping.")
          break
        }
        console.log("Empty batch at offset " + offset + ", retrying...")
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      
      emptyBatches = 0
      let batchProcessed = 0
      
      for (const post of posts) {
        const result = await processor.processPost(post)
        if (result) {
          batchProcessed++
          totalProcessed++
        } else {
          totalSkipped++
        }
      }
      
      if (batchProcessed > 0) {
        console.log("Offset " + offset + ": +" + batchProcessed + " new ops (total: " + totalProcessed + ")")
      }
      
      if (offset % 5000 === 0) {
        console.log("Progress: " + offset + " posts scanned, " + totalProcessed + " new ops, " + totalSkipped + " skipped")
      }
      
      if (!hasMore) {
        console.log("API returned hasMore=false at offset " + offset + ". Stopping.")
        break
      }
      
      offset += BATCH_SIZE
      await new Promise(resolve => setTimeout(resolve, 300))
      
    } catch (error: any) {
      console.error("Error at offset " + offset + ":", error.message)
      if (error.message && (error.message.includes("429") || error.message.includes("rate"))) {
        console.log("Rate limited, waiting 30s...")
        await new Promise(resolve => setTimeout(resolve, 30000))
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }
  
  console.log("=== BACKFILL COMPLETE ===")
  console.log("Total posts scanned: " + offset)
  console.log("New mbc-20 operations: " + totalProcessed)
  console.log("Skipped: " + totalSkipped)
  
  const opCount = await prisma.operation.count()
  const tokenCount = await prisma.token.count()
  console.log("Database totals: " + opCount + " operations, " + tokenCount + " tokens")
  
  await prisma.$disconnect()
}

backfill().catch(console.error)
