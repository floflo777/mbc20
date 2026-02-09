import { PrismaClient } from "@prisma/client"
import { OperationProcessor } from "./processor"

const prisma = new PrismaClient()
const processor = new OperationProcessor(prisma)

const SCAN_INTERVAL = 10000  // 10 seconds
const SOURCES = [
  { submolt: undefined },
  { submolt: "general" },
  { submolt: "moltbot" },
]

interface MoltbookPost {
  id: string
  content: string
  author: { name: string; id: string }
  created_at: string
}

async function scan() {
  const seenPostIds = new Set<string>()
  let processed = 0
  
  for (const source of SOURCES) {
    const url = new URL("https://www.moltbook.com/api/v1/posts")
    url.searchParams.set("limit", "100")
    url.searchParams.set("sort", "new")
    if (source.submolt) url.searchParams.set("submolt", source.submolt)

    try {
      const response = await fetch(url.toString(), {
        headers: { "Accept": "application/json" },
      })
      
      if (!response.ok) continue
      
      const data = await response.json()
      const posts: MoltbookPost[] = data.posts || []
      
      for (const post of posts) {
        if (seenPostIds.has(post.id)) continue
        seenPostIds.add(post.id)
        
        if (!post.content || !post.content.includes("mbc-20")) continue
        
        try {
          const moltbookPost = {
            id: post.id,
            content: post.content,
            authorName: post.author?.name || "Unknown",
            authorId: post.author?.id || "",
            createdAt: post.created_at,
            url: "https://www.moltbook.com/p/" + post.id,
          }
          
          const wasProcessed = await processor.processPost(moltbookPost)
          if (wasProcessed) {
            processed++
            console.log(new Date().toISOString().slice(11,19), "NEW:", post.author?.name, post.id.slice(0,8))
          }
        } catch {}
      }
    } catch {}
  }
  
  if (processed > 0) {
    console.log("--- Indexed", processed, "new ops ---")
  }
}

async function main() {
  console.log("Scanner started - running every", SCAN_INTERVAL/1000, "seconds")
  
  while (true) {
    try {
      await scan()
    } catch (error) {
      console.error("Scan error:", error)
    }
    await new Promise(resolve => setTimeout(resolve, SCAN_INTERVAL))
  }
}

main()
