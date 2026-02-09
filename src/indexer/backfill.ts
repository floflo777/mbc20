import { PrismaClient } from '@prisma/client'
import { MoltbookClient } from './moltbook'
import { OperationProcessor } from './processor'

const prisma = new PrismaClient()
const moltbook = new MoltbookClient()
const processor = new OperationProcessor(prisma)

const BATCH_SIZE = 100
const MAX_POSTS = 50000

async function backfill(): Promise<void> {
  console.log('Starting backfill...')
  
  let totalProcessed = 0
  let totalSkipped = 0
  let offset = 0
  
  while (offset < MAX_POSTS) {
    console.log(`Fetching batch at offset ${offset}...`)
    
    try {
      const { posts, hasMore } = await moltbook.fetchPosts({
        limit: BATCH_SIZE,
        offset,
      })

      if (posts.length === 0) {
        console.log('No more posts')
        break
      }

      for (const post of posts) {
        const success = await processor.processPost(post)
        if (success) {
          totalProcessed++
          console.log(`  Found mbc-20: ${post.id}`)
        } else {
          totalSkipped++
        }
      }

      console.log(`Progress: ${offset + posts.length} posts scanned, ${totalProcessed} mbc-20 ops found`)
      
      if (!hasMore) {
        console.log('No more posts available')
        break
      }

      offset += BATCH_SIZE
      
      // Rate limit: 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`Error at offset ${offset}:`, error)
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log(`\nBackfill complete!`)
  console.log(`Total posts scanned: ${offset}`)
  console.log(`Total mbc-20 operations indexed: ${totalProcessed}`)
  console.log(`Total skipped (no mbc-20 or duplicate): ${totalSkipped}`)
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
