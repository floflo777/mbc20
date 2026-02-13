import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Valid API keys for higher rate limits
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

  // Rate limit: 60/min without key, 600/min with key
  const limiterKey = hasValidKey ? `key:${apiKey}` : `ip:${ip}`
  const limit = hasValidKey ? 600 : 60
  const rl = rateLimit(limiterKey, { name: 'token-api', limit, windowSec: 60 })

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

  // Get live stats from operations + balances
  const [mintedResult, holdersResult, burnedResult] = await Promise.all([
    prisma.operation.aggregate({ where: { tick, op: 'mint' }, _sum: { amount: true } }),
    prisma.balance.count({ where: { tick, amount: { gt: 0 } } }),
    prisma.operation.aggregate({ where: { tick, op: 'burn' }, _sum: { amount: true } }),
  ])

  const minted = mintedResult._sum.amount || 0n
  const burned = burnedResult._sum.amount || 0n
  const supply = minted - burned

  const response = {
    tick,
    max_supply: token.maxSupply.toString(),
    mint_limit: token.mintLimit.toString(),
    minted: minted.toString(),
    burned: burned.toString(),
    supply: supply.toString(),
    holders: holdersResult,
    deployer: token.deployer,
    deployed_at: token.createdAt.toISOString(),
    progress: Number(token.maxSupply) > 0
      ? Number((minted * 10000n) / token.maxSupply) / 100
      : 0,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(rl.remaining),
    }
  })
}
