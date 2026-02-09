import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ethers } from "ethers"
import { rateLimit } from "@/lib/rate-limit"

const SIGNER_PK = process.env.CLAIM_SIGNER_PK
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "84532")
const RPC_URL = process.env.CHAIN_ID === "8453"
  ? "https://mainnet.base.org"
  : "https://sepolia.base.org"
const CLAIM_MANAGER = process.env.CLAIM_MANAGER_ADDRESS || "0x09C73fee7c7Ff83BB0B8387DB4029Cd1f43A5338"
const FACTORY = process.env.MBC20_FACTORY_ADDRESS || "0x1F35A894d53FBBBA03B20A34abBD3E50ACD6D7AD"

export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per minute per IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const rl = rateLimit(ip, { name: "claim-signature", limit: 5, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  if (!SIGNER_PK) {
    return NextResponse.json({ error: "Signer not configured" }, { status: 500 })
  }

  const body = await request.json()
  const { wallet, tick } = body

  if (!wallet || !tick) {
    return NextResponse.json({ error: "wallet and tick required" }, { status: 400 })
  }

  const walletLower = wallet.toLowerCase()
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletLower)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
  }

  const tickUpper = tick.toUpperCase()

  // Verify wallet has linked agents
  const links = await prisma.walletLink.findMany({
    where: { wallet: walletLower },
    select: { agent: true },
  })

  if (links.length === 0) {
    return NextResponse.json({ error: "No agents linked to this wallet" }, { status: 403 })
  }

  // Get total balance across all linked agents for this tick
  const balances = await prisma.balance.findMany({
    where: {
      agent: { in: links.map((l) => l.agent) },
      tick: tickUpper,
      amount: { gt: 0 },
    },
  })

  const totalBalance = balances.reduce((sum, b) => sum + b.amount, 0n)
  if (totalBalance === 0n) {
    return NextResponse.json({ error: "No balance for this token" }, { status: 400 })
  }

  // Get token info from DB for maxSupply (needed for initToken)
  const tokenInfo = await prisma.token.findUnique({ where: { tick: tickUpper } })
  if (!tokenInfo) {
    return NextResponse.json({ error: "Token not found in indexer" }, { status: 404 })
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL)

  // Auto-init token on-chain if it doesn't exist yet
  const factory = new ethers.Contract(FACTORY, [
    "function getToken(string) view returns (address)",
  ], provider)
  const tokenAddr = await factory.getToken(tickUpper)
  if (tokenAddr === ethers.ZeroAddress) {
    const signerWallet = new ethers.Wallet(SIGNER_PK, provider)
    const cm = new ethers.Contract(CLAIM_MANAGER, [
      "function initToken(string, uint256) external",
    ], signerWallet)
    const maxSupply = tokenInfo.maxSupply * (10n ** 18n)
    const tx = await cm.initToken(tickUpper, maxSupply)
    await tx.wait()
  }

  // Read nonce from the smart contract (source of truth)
  const cm = new ethers.Contract(CLAIM_MANAGER, [
    "function nonces(address) view returns (uint256)",
  ], provider)
  const onChainNonce = await cm.nonces(walletLower)
  const nonce = Number(onChainNonce)

  // Convert mbc-20 balance to ERC-20 amount (18 decimals)
  const totalAmount = totalBalance * (10n ** 18n)

  // Sign: keccak256(abi.encodePacked(wallet, tick, totalAmount, nonce, chainId))
  const signer = new ethers.Wallet(SIGNER_PK)
  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "string", "uint256", "uint256", "uint256"],
    [walletLower, tickUpper, totalAmount, nonce, CHAIN_ID]
  )
  const signature = await signer.signMessage(ethers.getBytes(messageHash))

  return NextResponse.json({
    wallet: walletLower,
    tick: tickUpper,
    totalAmount: totalAmount.toString(),
    nonce,
    chainId: CHAIN_ID,
    signature,
  })
}
