import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  // Rate limit: 30 requests per minute per IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const rl = rateLimit(ip, { name: "claim-status", limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  const wallet = params.wallet.toLowerCase()

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
  }

  // Find all agents linked to this wallet
  const links = await prisma.walletLink.findMany({
    where: { wallet },
    select: { agent: true },
  })

  if (links.length === 0) {
    return NextResponse.json({
      wallet,
      linked: false,
      tokens: [],
      message: "No agents linked to this wallet. Post a link inscription first.",
    })
  }

  const agentNames = links.map((l) => l.agent)

  // Get all balances for linked agents
  const balances = await prisma.balance.findMany({
    where: {
      agent: { in: agentNames },
      amount: { gt: 0 },
    },
    include: { token: true },
  })

  // Aggregate balances per tick across all linked agents
  const tokenMap = new Map<string, { tick: string; totalBalance: bigint; agents: { name: string; amount: bigint }[] }>()

  for (const bal of balances) {
    if (!tokenMap.has(bal.tick)) {
      tokenMap.set(bal.tick, { tick: bal.tick, totalBalance: 0n, agents: [] })
    }
    const entry = tokenMap.get(bal.tick)!
    entry.totalBalance += bal.amount
    entry.agents.push({ name: bal.agent, amount: bal.amount })
  }

  // Get claim nonce for this wallet
  const nonceRecord = await prisma.claimNonce.findUnique({ where: { wallet } })
  const nonce = nonceRecord?.nonce ?? 0

  const tokens = Array.from(tokenMap.values()).map((t) => ({
    tick: t.tick,
    totalBalance: t.totalBalance.toString(),
    agents: t.agents.map((a) => ({ name: a.name, amount: a.amount.toString() })),
  }))

  return NextResponse.json({
    wallet,
    linked: true,
    agents: agentNames,
    nonce,
    tokens,
  })
}
