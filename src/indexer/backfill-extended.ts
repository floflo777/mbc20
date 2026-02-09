import { MoltbookClient } from './moltbook'
import { OperationProcessor } from './processor'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const moltbook = new MoltbookClient()
const processor = new OperationProcessor(prisma)

const BATCH_SIZE = 100
const CHECKPOINT_SIZE = 50000
const MAX_POSTS = 1000000
const START_OFFSET = 50000

async function backfill() {
  console.log(`Starting extended backfill from offset ${START_OFFSET}...`)
  
  let offset = START_OFFSET
  let totalOpsFound = 0
  let checkpointOps = 0
  
  while (offset < MAX_POSTS) {
    const checkpointStart = offset
    checkpointOps = 0
    
    // Process one checkpoint (50,000 posts)
    while (offset < checkpointStart + CHECKPOINT_SIZE && offset < MAX_POSTS) {
      try {
        const { posts, hasMore } = await moltbook.fetchPosts({ limit: BATCH_SIZE, offset })
        
        if (posts.length === 0) {
          console.log(`No more posts at offset ${offset}. Reached end of Moltbook.`)
          console.log(`\n=== BACKFILL COMPLETE ===`)
          console.log(`Total posts scanned: ${offset}`)
          console.log(`Total mbc-20 operations found: ${totalOpsFound}`)
          await prisma.$disconnect()
          return
        }
        
        for (const post of posts) {
          const result = await processor.processPost(post)
          if (result) {
            checkpointOps++
            totalOpsFound++
            console.log(`  Found mbc-20: ${post.id}`)
          }
        }
        
        offset += BATCH_SIZE
        
        // Progress every 5000 posts
        if (offset % 5000 === 0) {
          console.log(`Progress: ${offset} posts scanned, ${totalOpsFound} total ops, ${checkpointOps} in current checkpoint`)
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } catch (error) {
        console.error(`Error at offset ${offset}:`, error)
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    // Checkpoint reached
    console.log(`\n=== CHECKPOINT at ${offset} ===`)
    console.log(`Posts ${checkpointStart} - ${offset}: ${checkpointOps} mbc-20 ops found`)
    console.log(`Total so far: ${totalOpsFound} ops`)
    
    if (checkpointOps === 0) {
      console.log(`No mbc-20 operations in last 50,000 posts. Stopping.`)
      break
    }
    
    console.log(`Continuing to next checkpoint...\n`)
  }
  
  console.log(`\n=== BACKFILL COMPLETE ===`)
  console.log(`Total posts scanned: ${offset}`)
  console.log(`Total mbc-20 operations found: ${totalOpsFound}`)
  
  await prisma.$disconnect()
}

backfill().catch(console.error)
