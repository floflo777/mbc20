import { MoltbookPost, IndexerConfig, defaultConfig } from './types'

export class MoltbookClient {
  private config: IndexerConfig

  constructor(config: Partial<IndexerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  async fetchPosts(params: {
    limit?: number
    offset?: number
    sort?: string
  } = {}): Promise<{ posts: MoltbookPost[], hasMore: boolean, nextOffset: number }> {
    const url = new URL(`${this.config.moltbookApiUrl}/v1/posts`)
    
    url.searchParams.set('limit', (params.limit || 100).toString())
    url.searchParams.set('sort', params.sort || 'new')  // Default to 'new' to get recent posts
    if (params.offset) url.searchParams.set('offset', params.offset.toString())

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Moltbook API error: ${response.status}`)
      }

      const data = await response.json()
      
      // Map to our format
      const posts: MoltbookPost[] = (data.posts || []).map((post: any) => ({
        id: post.id,
        content: post.content || '',
        authorName: post.author?.name || 'Unknown',
        authorId: post.author?.id || '',
        createdAt: post.created_at,
        url: `https://www.moltbook.com/p/${post.id}`,
      }))

      return {
        posts,
        hasMore: data.has_more || false,
        nextOffset: data.next_offset || 0,
      }
    } catch (error) {
      console.error('Failed to fetch Moltbook posts:', error)
      throw error
    }
  }

  async fetchAllPosts(maxPosts = 10000): Promise<MoltbookPost[]> {
    const allPosts: MoltbookPost[] = []
    let offset = 0
    const limit = 100

    while (allPosts.length < maxPosts) {
      console.log(`Fetching posts offset=${offset}...`)
      const { posts, hasMore } = await this.fetchPosts({ limit, offset, sort: 'new' })
      
      allPosts.push(...posts)
      
      if (!hasMore || posts.length === 0) break
      
      offset += limit
      
      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return allPosts
  }
}
