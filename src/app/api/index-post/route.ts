import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { OperationProcessor } from '@/indexer/processor'
import { MoltbookPost } from '@/indexer/types'

export const dynamic = 'force-dynamic'

async function fetchPostById(postId: string): Promise<MoltbookPost | null> {
  try {
    const response = await fetch(`https://www.moltbook.com/api/v1/posts/${postId}`)
    if (!response.ok) return null
    
    const data = await response.json()
    if (!data.success || !data.post) return null
    
    const post = data.post
    return {
      id: post.id,
      content: post.content || '',
      authorName: post.author?.name || 'Unknown',
      authorId: post.author?.id || '',
      createdAt: post.created_at,
      url: `https://www.moltbook.com/p/${post.id}`,
    }
  } catch (error) {
    console.error('Failed to fetch post:', error)
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('id')
  
  if (!postId) {
    return NextResponse.json({ error: 'Missing post id' }, { status: 400 })
  }
  
  const post = await fetchPostById(postId)
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }
  
  const processor = new OperationProcessor(prisma)
  const result = await processor.processPost(post)
  
  return NextResponse.json({
    success: true,
    postId,
    processed: result,
    author: post.authorName,
  })
}
