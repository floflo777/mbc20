import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseMbc20, validateTick, parseAmount } from '@/lib/mbc20'

export const dynamic = 'force-dynamic'

// Manual import endpoint for adding operations
// Can be used for initial seeding or browser scraping results

interface ImportPost {
  id: string
  content: string
  agent: string
  createdAt: string
  url?: string
}

export async function POST(request: Request) {
  // Simple API key auth
  const authHeader = request.headers.get('authorization')
  const apiKey = process.env.IMPORT_API_KEY
  
  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const posts: ImportPost[] = Array.isArray(body) ? body : [body]

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const post of posts) {
      try {
        // Check if already processed
        const existing = await prisma.operation.findUnique({
          where: { postId: post.id },
        })
        if (existing) {
          skipped++
          continue
        }

        // Parse mbc-20 content
        const op = parseMbc20(post.content)
        if (!op) {
          skipped++
          continue
        }

        const tick = op.tick.toUpperCase()
        const createdAt = new Date(post.createdAt)

        if (op.op === 'deploy') {
          if (!validateTick(tick)) continue
          const maxSupply = parseAmount(op.max)
          const mintLimit = parseAmount(op.lim)
          if (!maxSupply || !mintLimit) continue

          // Check if token exists
          const existingToken = await prisma.token.findUnique({ where: { tick } })
          if (existingToken) continue

          await prisma.$transaction([
            prisma.token.create({
              data: {
                tick,
                maxSupply,
                mintLimit,
                deployer: post.agent,
                deployPost: post.id,
                createdAt,
              },
            }),
            prisma.operation.create({
              data: {
                op: 'deploy',
                tick,
                agent: post.agent,
                postId: post.id,
                postUrl: post.url,
                createdAt,
              },
            }),
          ])
          imported++
        } else if (op.op === 'mint') {
          const amount = parseAmount(op.amt)
          if (!amount) continue

          const token = await prisma.token.findUnique({ where: { tick } })
          if (!token) continue
          if (amount > token.mintLimit) continue

          // Check supply
          const supply = await prisma.operation.aggregate({
            where: { tick, op: 'mint' },
            _sum: { amount: true },
          })
          if ((supply._sum.amount || 0n) + amount > token.maxSupply) continue

          await prisma.$transaction([
            prisma.operation.create({
              data: {
                op: 'mint',
                tick,
                agent: post.agent,
                amount,
                postId: post.id,
                postUrl: post.url,
                createdAt,
              },
            }),
            prisma.balance.upsert({
              where: { agent_tick: { agent: post.agent, tick } },
              update: { amount: { increment: amount } },
              create: { agent: post.agent, tick, amount },
            }),
          ])
          imported++
        } else if (op.op === 'transfer') {
          const amount = parseAmount(op.amt)
          if (!amount || !op.to) continue

          const token = await prisma.token.findUnique({ where: { tick } })
          if (!token) continue

          const senderBalance = await prisma.balance.findUnique({
            where: { agent_tick: { agent: post.agent, tick } },
          })
          if (!senderBalance || senderBalance.amount < amount) continue

          await prisma.$transaction([
            prisma.operation.create({
              data: {
                op: 'transfer',
                tick,
                agent: post.agent,
                amount,
                toAgent: op.to,
                postId: post.id,
                postUrl: post.url,
                createdAt,
              },
            }),
            prisma.balance.update({
              where: { agent_tick: { agent: post.agent, tick } },
              data: { amount: { decrement: amount } },
            }),
            prisma.balance.upsert({
              where: { agent_tick: { agent: op.to, tick } },
              update: { amount: { increment: amount } },
              create: { agent: op.to, tick, amount },
            }),
          ])
          imported++
        }
      } catch (err) {
        errors.push(`Post ${post.id}: ${err}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
