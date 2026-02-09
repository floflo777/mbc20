// Simple in-memory rate limiter for Next.js API routes
// No external dependency needed — single server setup

interface RateLimitEntry {
  count: number
  resetAt: number
}

const stores = new Map<string, Map<string, RateLimitEntry>>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }
}, 5 * 60 * 1000)

interface RateLimitConfig {
  /** Unique name for this limiter (e.g. "claim-signature") */
  name: string
  /** Max requests per window */
  limit: number
  /** Window duration in seconds */
  windowSec: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  if (!stores.has(config.name)) {
    stores.set(config.name, new Map())
  }
  const store = stores.get(config.name)!
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSec * 1000 })
    return { allowed: true, remaining: config.limit - 1, resetAt: now + config.windowSec * 1000 }
  }

  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
}
