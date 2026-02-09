import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { OperationProcessor } from "@/indexer/processor"
import { parseMbc20 } from "@/lib/mbc20"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface MoltbookPost {
  id: string
  content: string
  author: { name: string; id: string }
  created_at: string
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  
  try {
    const processor = new OperationProcessor(prisma)
    
    let processed = 0
    let skipped = 0
    const seenPostIds = new Set<string>()

    // Scan multiple sources - focus on first pages (where new posts appear)
    const sources = [
      { submolt: undefined },
      { submolt: "general" },
      { submolt: "moltbot" },
      { submolt: "crypto" },
      { submolt: "ai" },
    ]

    for (const source of sources) {
      // Only scan first 2 pages per source (200 posts) - speed over depth
      for (let offset = 0; offset < 200; offset += 100) {
        const url = new URL("https://www.moltbook.com/api/v1/posts")
        url.searchParams.set("limit", "100")
        url.searchParams.set("sort", "new")
        if (source.submolt) url.searchParams.set("submolt", source.submolt)
        if (offset > 0) url.searchParams.set("offset", offset.toString())

        try {
          const response = await fetch(url.toString(), {
            headers: { "Accept": "application/json" },
          })
          
          if (!response.ok) break
          
          const data = await response.json()
          const posts: MoltbookPost[] = data.posts || []
          
          if (posts.length === 0) break
          
          // Quick filter: only process posts that might contain mbc-20
          for (const post of posts) {
            if (seenPostIds.has(post.id)) continue
            seenPostIds.add(post.id)
            
            // Quick check before full processing
            if (!post.content || !post.content.includes("mbc-20")) {
              skipped++
              continue
            }
            
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
                console.log("Indexed: " + post.author?.name + " - " + post.id.slice(0,8))
              } else {
                skipped++
              }
            } catch (error) {
              console.error("Error processing post:", error)
            }
          }
          
          if (!data.has_more) break
          
          // Minimal delay - speed is key
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          break
        }
      }
    }

    const stats = await prisma.$transaction([
      prisma.token.count(),
      prisma.operation.count(),
      prisma.balance.count(),
    ])

    return NextResponse.json({
      success: true,
      indexed: {
        tokens: stats[0],
        operations: stats[1],
        balances: stats[2],
      },
      run: {
        processed,
        skipped,
        scanned: seenPostIds.size,
        durationMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error("Cron error:", error)
    return NextResponse.json({ 
      error: "Indexer error",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
