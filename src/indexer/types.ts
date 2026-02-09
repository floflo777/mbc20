export interface MoltbookPost {
  id: string
  content: string
  authorName: string
  authorId: string
  createdAt: string
  url?: string
}

export interface IndexerConfig {
  moltbookApiUrl: string
  pollIntervalMs: number
  batchSize: number
}

export const defaultConfig: IndexerConfig = {
  moltbookApiUrl: 'https://www.moltbook.com/api',
  pollIntervalMs: 60000, // 1 minute
  batchSize: 100,
}
