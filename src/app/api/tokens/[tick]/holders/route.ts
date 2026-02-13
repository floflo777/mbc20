import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const API_KEYS = new Set(
  (process.env.PUBLIC_API_KEYS || '').split(',').filter(Boolean)
)

interface Props {
  params: { tick: string }
}

export async function GET(request: NextRequest, { params }: Props) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('api_key')
  const hasValidKey = apiKey ? API_KEYS.has(apiKey) : false

  const limiterKey = hasValidKey ? `key:${apiKey}` : `ip:${ip}`
  const limit = hasValidKey ? 600 : 30
  const rl = rateLimit(limiterKey, { name: 'holders-api', limit, windowSec: 60 })

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Get an API key at https://twitter.com/0xFlorent_' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        }
      }
    )
  }

  const tick = params.tick.toUpperCase()

  const token = await prisma.token.findUnique({ where: { tick } })
  if (!token) {
    return NextResponse.json({ error: `Token ${tick} not found` }, { status: 404 })
  }

  // Get all holders with balance > 0, ordered by balance desc
  const balances = await prisma.balance.findMany({
    where: { tick, amount: { gt: 0 } },
    orderBy: { amount: 'desc' },
  })

  // Get all wallet links for these agents in one query
  const agents = balances.map(b => b.agent)
  const walletLinks = await prisma.walletLink.findMany({
    where: { agent: { in: agents } },
    orderBy: { createdAt: 'desc' },
    distinct: ['agent'],
  })

  const walletByAgent: Record<string, string> = {}
  for (const link of walletLinks) {
    walletByAgent[link.agent] = link.wallet
  }

  const holders = balances.map(b => ({
    agent: b.agent,
    balance: b.amount.toString(),
    linked_wallet: walletByAgent[b.agent] || null,
  }))

  return NextResponse.json({
    token: tick,
    total_holders: holders.length,
    holders,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(rl.remaining),
    }
  })
}
