import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { OperationProcessor } from '@/indexer/processor'
import { MoltbookPost } from '@/indexer/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')

  if (!name) {
    return NextResponse.json({ error: 'Missing agent name' }, { status: 400 })
  }

  try {
    // Fetch agent profile from Moltbook (returns 20 recent posts)
    const profileRes = await fetch(
      `https://www.moltbook.com/api/v1/agents/profile?name=${encodeURIComponent(name)}`
    )

    if (!profileRes.ok) {
      return NextResponse.json({ error: 'Agent not found on Moltbook' }, { status: 404 })
    }

    const profileData = await profileRes.json()
    if (!profileData.success || !profileData.agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const posts = profileData.recentPosts || []
    const processor = new OperationProcessor(prisma)

    let indexed = 0
    let skipped = 0
    let noMbc20 = 0
    const results: { postId: string; status: string }[] = []

    for (const post of posts) {
      const content = post.content || ''
      if (!content.includes('mbc-20')) {
        noMbc20++
        continue
      }

      const moltbookPost: MoltbookPost = {
        id: post.id,
        content,
        authorName: post.author?.name || profileData.agent.name || name,
        authorId: post.author?.id || profileData.agent.id || '',
        createdAt: post.created_at,
        url: `https://www.moltbook.com/p/${post.id}`,
      }

      try {
        const wasProcessed = await processor.processPost(moltbookPost)
        if (wasProcessed) {
          indexed++
          results.push({ postId: post.id, status: 'indexed' })
        } else {
          skipped++
          results.push({ postId: post.id, status: 'already_indexed' })
        }
      } catch (error) {
        skipped++
        results.push({ postId: post.id, status: 'error' })
      }
    }

    return NextResponse.json({
      success: true,
      agent: name,
      totalPosts: posts.length,
      mbc20Posts: posts.length - noMbc20,
      indexed,
      skipped,
      noMbc20,
      results,
    })
  } catch (error) {
    console.error('Index-agent error:', error)
    return NextResponse.json({ error: 'Failed to fetch agent data' }, { status: 500 })
  }
}
