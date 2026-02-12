import { PrismaClient } from '@prisma/client'
import { MoltbookPost } from './types'
import { parseMbc20All, validateTick, parseAmount, DeployOp, MintOp, TransferOp, BurnOp, LinkOp, Mbc20Op } from '@/lib/mbc20'

// Tokens that are minted out - skip processing new mints
const MINTED_OUT_TICKS = ['CLAW']

export class OperationProcessor {
  constructor(private prisma: PrismaClient) {}

  async processPost(post: MoltbookPost): Promise<boolean> {
    // Parse ALL mbc-20 operations from content
    const ops = parseMbc20All(post.content)
    if (ops.length === 0) return false

    let anyProcessed = false

    // Handle link operations separately (no tick, no operations table)
    for (const op of ops) {
      if (op.op === 'link') {
        try {
          const processed = await this.processLink(post, op as LinkOp)
          if (processed) anyProcessed = true
        } catch (error) {
          console.error(`Failed to process link from post ${post.id}:`, error)
        }
      }
    }

    // Group non-link operations by (tick, op) to handle multiple same-type ops
    const opGroups = new Map<string, Mbc20Op[]>()
    for (const op of ops) {
      if (op.op === 'link') continue
      const tickedOp = op as DeployOp | MintOp | TransferOp | BurnOp
      const key = `${tickedOp.tick.toUpperCase()}:${tickedOp.op}`
      if (!opGroups.has(key)) opGroups.set(key, [])
      opGroups.get(key)!.push(op)
    }

    for (const [key, groupOps] of opGroups) {
      const [tick, opType] = key.split(':')

      // Count how many of this type already processed for this post
      const existingCount = await this.prisma.operation.count({
        where: {
          postId: post.id,
          tick,
          op: opType,
        },
      })

      // Process any new ones (starting from existingCount index)
      for (let i = existingCount; i < groupOps.length; i++) {
        const op = groupOps[i]

        try {
          let processed = false
          switch (op.op) {
            case 'deploy':
              processed = await this.processDeploy(post, op, i)
              break
            case 'mint':
              processed = await this.processMint(post, op, i)
              break
            case 'transfer':
              processed = await this.processTransfer(post, op, i)
              break
            case 'burn':
              processed = await this.processBurn(post, op, i)
              break
          }
          if (processed) anyProcessed = true
        } catch (error) {
          console.error(`Failed to process ${op.op} ${(op as any).tick}[${i}] from post ${post.id}:`, error)
        }
      }
    }

    return anyProcessed
  }

  private async processDeploy(post: MoltbookPost, op: DeployOp, opIndex: number = 0): Promise<boolean> {
    const tick = op.tick.toUpperCase()

    // Validate
    if (!validateTick(tick)) return false

    const maxSupply = parseAmount(op.max)
    const mintLimit = parseAmount(op.lim)
    if (!maxSupply || !mintLimit) return false
    if (mintLimit > maxSupply) return false

    // Check if token already exists
    const existingToken = await this.prisma.token.findUnique({
      where: { tick },
    })
    if (existingToken) return false // Token already deployed

    // Create token and operation in transaction
    await this.prisma.$transaction([
      this.prisma.token.create({
        data: {
          tick,
          maxSupply,
          mintLimit,
          deployer: post.authorName,
          deployPost: post.id,
          createdAt: new Date(post.createdAt),
        },
      }),
      this.prisma.operation.create({
        data: {
          op: 'deploy',
          tick,
          agent: post.authorName,
          postId: post.id,
          postUrl: post.url,
          opIndex,
          createdAt: new Date(post.createdAt),
        },
      }),
    ])

    console.log(`Deployed token: ${tick} by ${post.authorName}`)
    return true
  }

  private async processMint(post: MoltbookPost, op: MintOp, opIndex: number = 0): Promise<boolean> {
    const tick = op.tick.toUpperCase()
    
    // Skip minted out tokens
    if (MINTED_OUT_TICKS.includes(tick)) return false
    
    const amount = parseAmount(op.amt)
    if (!amount) return false

    // Get token
    const token = await this.prisma.token.findUnique({
      where: { tick },
    })
    if (!token) return false // Token doesn't exist

    // Rate limit: 1 mint per 30 min per agent per tick
    // Only check mints BEFORE this post's time (fixes negative-elapsed bug when processing newest-first)
    const lastMint = await this.prisma.operation.findFirst({
      where: { 
        tick, 
        op: 'mint', 
        agent: post.authorName,
        createdAt: { lt: new Date(post.createdAt) },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (lastMint) {
      const postTime = new Date(post.createdAt).getTime()
      const elapsed = postTime - lastMint.createdAt.getTime()
      const MIN_INTERVAL = 29 * 60 * 1000 // 29 minutes (margin for cron jobs)
      if (elapsed < MIN_INTERVAL) {
        console.log(`Rate limited: ${post.authorName} tried to mint ${tick} (${Math.round(elapsed/1000)}s since last)`)
        return false
      }
    }

    // Validate amount against mint limit
    if (amount > token.mintLimit) return false

    // Get current supply
    const currentSupply = await this.prisma.operation.aggregate({
      where: { tick, op: 'mint' },
      _sum: { amount: true },
    })
    const totalMinted = currentSupply._sum.amount || 0n

    // Check if mint would exceed max supply
    if (totalMinted + amount > token.maxSupply) return false

    // Create operation and update balance in transaction
    await this.prisma.$transaction([
      this.prisma.operation.create({
        data: {
          op: 'mint',
          tick,
          agent: post.authorName,
          amount,
          postId: post.id,
          postUrl: post.url,
          opIndex,
          createdAt: new Date(post.createdAt),
        },
      }),
      this.prisma.balance.upsert({
        where: {
          agent_tick: {
            agent: post.authorName,
            tick,
          },
        },
        update: {
          amount: { increment: amount },
        },
        create: {
          agent: post.authorName,
          tick,
          amount,
        },
      }),
    ])

    console.log(`Minted ${amount} ${tick} to ${post.authorName}`)
    return true
  }

  private async processTransfer(post: MoltbookPost, op: TransferOp, opIndex: number = 0): Promise<boolean> {
    const tick = op.tick.toUpperCase()
    const amount = parseAmount(op.amt)
    if (!amount) return false
    if (!op.to) return false

    // Get token
    const token = await this.prisma.token.findUnique({
      where: { tick },
    })
    if (!token) return false

    // Get sender balance
    const senderBalance = await this.prisma.balance.findUnique({
      where: {
        agent_tick: {
          agent: post.authorName,
          tick,
        },
      },
    })
    if (!senderBalance || senderBalance.amount < amount) return false

    // Create operation and update balances in transaction
    await this.prisma.$transaction([
      this.prisma.operation.create({
        data: {
          op: 'transfer',
          tick,
          agent: post.authorName,
          amount,
          toAgent: op.to,
          postId: post.id,
          postUrl: post.url,
          opIndex,
          createdAt: new Date(post.createdAt),
        },
      }),
      this.prisma.balance.update({
        where: {
          agent_tick: {
            agent: post.authorName,
            tick,
          },
        },
        data: {
          amount: { decrement: amount },
        },
      }),
      this.prisma.balance.upsert({
        where: {
          agent_tick: {
            agent: op.to,
            tick,
          },
        },
        update: {
          amount: { increment: amount },
        },
        create: {
          agent: op.to,
          tick,
          amount,
        },
      }),
    ])

    console.log(`Transferred ${amount} ${tick} from ${post.authorName} to ${op.to}`)
    return true
  }

  private async processBurn(post: MoltbookPost, op: BurnOp, opIndex: number = 0): Promise<boolean> {
    const tick = op.tick.toUpperCase()
    const amount = parseAmount(op.amt)
    if (!amount) return false

    // Get token
    const token = await this.prisma.token.findUnique({
      where: { tick },
    })
    if (!token) return false

    // Get sender balance
    const senderBalance = await this.prisma.balance.findUnique({
      where: {
        agent_tick: {
          agent: post.authorName,
          tick,
        },
      },
    })
    if (!senderBalance || senderBalance.amount < amount) return false

    // Create operation and decrement balance in transaction
    await this.prisma.$transaction([
      this.prisma.operation.create({
        data: {
          op: 'burn',
          tick,
          agent: post.authorName,
          amount,
          address: op.address || null,
          postId: post.id,
          postUrl: post.url,
          opIndex,
          createdAt: new Date(post.createdAt),
        },
      }),
      this.prisma.balance.update({
        where: {
          agent_tick: {
            agent: post.authorName,
            tick,
          },
        },
        data: {
          amount: { decrement: amount },
        },
      }),
    ])

    console.log(`Burned ${amount} ${tick} by ${post.authorName}`)
    return true
  }

  private async processLink(post: MoltbookPost, op: LinkOp): Promise<boolean> {
    const wallet = op.wallet.toLowerCase()

    // Cooldown: prevent wallet rebinding within 24h
    const lastLink = await this.prisma.walletLink.findFirst({
      where: { agent: post.authorName },
      orderBy: { createdAt: 'desc' },
    })

    if (lastLink) {
      const elapsed = new Date(post.createdAt).getTime() - lastLink.createdAt.getTime()
      const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours
      if (elapsed < COOLDOWN_MS && elapsed > 0) {
        console.log(`Link cooldown: ${post.authorName} tried to rebind wallet (${Math.round(elapsed/3600000)}h since last)`)
        return false
      }

      // Skip if already linked to this exact wallet
      if (lastLink.wallet === wallet) return false
    }

    // Remove any previous wallet links for this agent FIRST (replace, don't accumulate)
    await this.prisma.walletLink.deleteMany({
      where: { agent: post.authorName },
    })

    await this.prisma.walletLink.create({
      data: {
        agent: post.authorName,
        wallet,
        postId: post.id,
        createdAt: new Date(post.createdAt),
      },
    })

    console.log(`Linked wallet ${wallet} to agent ${post.authorName}`)
    return true
  }
}
