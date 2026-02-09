import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [tokenCount, operationCount, topTokens] = await Promise.all([
      prisma.token.count(),
      prisma.operation.count(),
      prisma.token.findMany({
        take: 10,
        include: {
          _count: {
            select: { operations: true, balances: true },
          },
        },
      }),
    ])

    // Get total minted per token
    const supplies = await Promise.all(
      topTokens.map(async (token) => {
        const result = await prisma.operation.aggregate({
          where: { tick: token.tick, op: 'mint' },
          _sum: { amount: true },
        })
        return {
          tick: token.tick,
          maxSupply: token.maxSupply.toString(),
          currentSupply: (result._sum.amount || 0n).toString(),
          holders: token._count.balances,
          operations: token._count.operations,
        }
      })
    )

    return NextResponse.json({
      tokens: tokenCount,
      operations: operationCount,
      topTokens: supplies,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
