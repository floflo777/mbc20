import { PrismaClient } from '@prisma/client'
import { MoltbookClient } from './moltbook'
import { OperationProcessor } from './processor'

const prisma = new PrismaClient()
const moltbook = new MoltbookClient()
const processor = new OperationProcessor(prisma)

const POLL_INTERVAL = 30000 // 30 seconds
const BATCH_SIZE = 50

async function getLastProcessedId(): Promise<string | null> {
  const state = await prisma.indexerState.findUnique({
    where: { key: 'lastPostId' },
  })
  return state?.value || null
}

async function setLastProcessedId(id: string): Promise<void> {
  await prisma.indexerState.upsert({
    where: { key: 'lastPostId' },
    update: { value: id },
    create: { key: 'lastPostId', value: id },
  })
}

async function runOnce(): Promise<number> {
  const lastId = await getLastProcessedId()
  
  console.log(`Fetching posts${lastId ? ` after ${lastId}` : ''}...`)
  
  const posts = await moltbook.fetchPosts({
    limit: BATCH_SIZE,
    after: lastId || undefined,
  })

  if (posts.length === 0) {
    console.log('No new posts')
    return 0
  }

  console.log(`Processing ${posts.length} posts...`)
  
  let processed = 0
  
  // Process in chronological order (oldest first)
  const sortedPosts = posts.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  for (const post of sortedPosts) {
    const success = await processor.processPost(post)
    if (success) processed++
  }

  // Update last processed ID
  if (sortedPosts.length > 0) {
    const newestPost = posts.reduce((a, b) => 
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    )
    await setLastProcessedId(newestPost.id)
  }

  console.log(`Processed ${processed}/${posts.length} valid mbc-20 operations`)
  return processed
}

async function run(): Promise<void> {
  console.log('Starting mbc-20 indexer...')
  
  while (true) {
    try {
      await runOnce()
    } catch (error) {
      console.error('Indexer error:', error)
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
  }
}

// Run
run().catch(console.error)
