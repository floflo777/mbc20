import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const agentName = decodeURIComponent(params.name)

  // Get balances (non-zero only)
  const balances = await prisma.balance.findMany({
    where: { agent: agentName, amount: { gt: 0 } },
    orderBy: { amount: 'desc' },
  })

  // Get linked wallet
  const walletLink = await prisma.walletLink.findFirst({
    where: { agent: agentName },
    orderBy: { createdAt: 'desc' },
  })

  // Get total burned per tick
  const burnOps = await prisma.operation.findMany({
    where: { agent: agentName, op: 'burn' },
    select: { tick: true, amount: true },
  })

  const burnByTick: Record<string, string> = {}
  let totalBurned = 0n
  for (const op of burnOps) {
    const amt = op.amount || 0n
    burnByTick[op.tick] = ((BigInt(burnByTick[op.tick] || '0')) + amt).toString()
    totalBurned += amt
  }

  // Format balances
  const formattedBalances: Record<string, string> = {}
  for (const b of balances) {
    formattedBalances[b.tick] = b.amount.toString()
  }

  return NextResponse.json({
    name: agentName,
    balances: formattedBalances,
    linked_wallet: walletLink?.wallet || null,
    total_burned: totalBurned.toString(),
    burned_by_tick: burnByTick,
  })
}
