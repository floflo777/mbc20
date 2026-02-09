import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  const wallet = params.wallet.toLowerCase()

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
  }

  const links = await prisma.walletLink.findMany({
    where: { wallet },
    select: { agent: true, createdAt: true },
  })

  return NextResponse.json({
    wallet,
    linked: links.length > 0,
    agents: links.map((l) => ({ name: l.agent, linkedAt: l.createdAt })),
  })
}
