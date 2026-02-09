import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface Props {
  params: { tick: string }
}

export async function GET(request: NextRequest, { params }: Props) {
  const tick = params.tick.toUpperCase()

  // Get all mint operations for this token, ordered by date
  const mints = await prisma.operation.findMany({
    where: {
      tick,
      op: 'mint',
    },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      amount: true,
    },
  })

  if (mints.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // Aggregate by hour for granularity
  const hourlyData = new Map<string, bigint>()
  
  for (const mint of mints) {
    const date = new Date(mint.createdAt)
    // Round to hour
    date.setMinutes(0, 0, 0)
    const key = date.toISOString()
    
    const current = hourlyData.get(key) || 0n
    hourlyData.set(key, current + (mint.amount || 0n))
  }

  // Convert to cumulative supply over time
  let cumulative = 0n
  const data: { time: string; timestamp: number; supply: string; minted: string }[] = []

  // Sort by time
  const sortedKeys = Array.from(hourlyData.keys()).sort()
  
  for (const key of sortedKeys) {
    const minted = hourlyData.get(key) || 0n
    cumulative += minted
    
    data.push({
      time: key,
      timestamp: new Date(key).getTime(),
      supply: cumulative.toString(),
      minted: minted.toString(),
    })
  }

  return NextResponse.json({ data })
}
