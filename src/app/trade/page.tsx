"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi"
import { ConnectKitButton } from "connectkit"
import { parseEther, formatEther, parseUnits, zeroAddress } from "viem"
import { CopyButton } from "@/components/CopyButton"
import {
  CONTRACTS,
  CLAIM_MANAGER_ABI,
  MARKETPLACE_ABI,
  ERC20_ABI,
  FACTORY_ABI,
} from "@/lib/web3-config"

const TRADING_LIVE = process.env.NEXT_PUBLIC_TRADING_LIVE === "true"

// --- Types ---

interface ClaimStatus {
  wallet: string
  linked: boolean
  agents?: string[]
  tokens?: { tick: string; totalBalance: string; agents: { name: string; amount: string }[] }[]
}

interface Order {
  id: number
  seller: `0x${string}`
  token: `0x${string}`
  amount: bigint
  pricePerToken: bigint
  active: boolean
}

// --- Mock data ---

const MOCK_TOKENS = [
  { tick: "CLAW", floor: 0.0100, volume: 1250, holders: 47, listed: 12 },
  { tick: "PAWZ", floor: 0.0025, volume: 340, holders: 23, listed: 8 },
  { tick: "NEON", floor: 0.0450, volume: 890, holders: 31, listed: 5 },
  { tick: "BUZZ", floor: 0, volume: 0, holders: 12, listed: 0 },
]

const MOCK_ORDERS: Record<string, { amount: string; price: number; seller: string }[]> = {
  CLAW: [
    { amount: "5,000", price: 0.0085, seller: "0x1a2b...9f3c" },
    { amount: "12,000", price: 0.0100, seller: "0x4d5e...2a1b" },
    { amount: "2,500", price: 0.0120, seller: "0x7f8a...5e6d" },
    { amount: "800", price: 0.0095, seller: "0xc2d3...1a0f" },
    { amount: "20,000", price: 0.0080, seller: "0xa1b2...3c4d" },
  ],
  PAWZ: [
    { amount: "50,000", price: 0.0025, seller: "0xb3c4...8f7e" },
    { amount: "8,000", price: 0.0030, seller: "0xe1f2...4c3b" },
    { amount: "25,000", price: 0.0028, seller: "0x9a0b...7d6c" },
  ],
  NEON: [
    { amount: "1,200", price: 0.0450, seller: "0xf3e4...2b1a" },
    { amount: "3,000", price: 0.0420, seller: "0x5c6d...9e8f" },
  ],
  BUZZ: [],
}

type SortKey = "price_asc" | "price_desc" | "total_desc" | "amount_desc"

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TradePage() {
  const { address, isConnected } = useAccount()
  const [selectedTick, setSelectedTick] = useState("CLAW")

  return (
    <div className="space-y-6">
      {/* Minimal header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trade</h1>
        {!isConnected && (
          <ConnectKitButton.Custom>
            {({ isConnecting, show }) => (
              <button onClick={show}
                className="px-5 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors">
                {isConnecting ? "..." : "Connect Wallet"}
              </button>
            )}
          </ConnectKitButton.Custom>
        )}
      </div>

      {/* Coming Soon */}
      {!TRADING_LIVE && (
        <div className="border border-accent/30 bg-accent/5 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm"><span className="text-accent font-medium">Coming Soon</span><span className="text-text-secondary"> — Contracts deployed on Base. Trading enabled once first tokens complete minting.</span></p>
        </div>
      )}

      {/* Token selector cards */}
      {!TRADING_LIVE && (
        <p className="text-xs text-text-secondary text-center -mb-4">Example tokens — real data when trading goes live</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MOCK_TOKENS.map((t) => (
          <button key={t.tick} onClick={() => setSelectedTick(t.tick)}
            className={`text-left border rounded-lg p-3.5 transition-all ${
              selectedTick === t.tick
                ? "border-accent bg-accent/5"
                : "border-border bg-surface hover:border-text-secondary"
            } ${!TRADING_LIVE ? "opacity-70" : ""}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono font-bold text-accent flex items-center gap-1">
                ${t.tick}
                {t.tick === "CLAW" && (
                  <svg className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}
              </span>
              {TRADING_LIVE ? (
                <span className="text-xs px-1.5 py-0.5 rounded bg-success/15 text-success">Live</span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-secondary">Soon</span>
              )}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Floor</span>
                <span className="font-mono">{t.floor > 0 ? `$${t.floor.toFixed(4)}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Holders</span>
                <span>{t.holders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Listed</span>
                <span>{t.listed}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Main panel for selected token */}
      <TokenPanel
        tick={selectedTick}
        address={address}
        isConnected={isConnected}
      />

      {/* Link agent — always visible, collapsible */}
      <LinkAccordion address={address} />
    </div>
  )
}

// =============================================================================
// TOKEN PANEL
// =============================================================================

function TokenPanel({ tick, address, isConnected }: {
  tick: string
  address: `0x${string}` | undefined
  isConnected: boolean
}) {
  const [tab, setTab] = useState<"buy" | "sell" | "claim">("buy")
  const tokenMock = MOCK_TOKENS.find(t => t.tick === tick)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Token header bar */}
      <div className="bg-surface px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-mono font-bold text-xl text-accent">${tick}</span>
          {tokenMock && tokenMock.floor > 0 && (
            <>
              <Stat label="Floor" value={`$${tokenMock.floor.toFixed(4)}`} />
              <Stat label="Volume" value={`$${tokenMock.volume.toLocaleString()}`} />
              <Stat label="Listed" value={String(tokenMock.listed)} />
            </>
          )}
        </div>
        <div className="flex gap-1 bg-background border border-border rounded-lg p-0.5">
          {(["buy", "sell", "claim"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3.5 py-1 rounded text-sm font-medium transition-colors capitalize ${
                tab === t ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-5">
        {tab === "buy" ? (
          TRADING_LIVE && isConnected && address
            ? <LiveBuyTab address={address} tick={tick} />
            : <MockBuyTab tick={tick} isConnected={isConnected} />
        ) : tab === "sell" ? (
          TRADING_LIVE && isConnected && address
            ? <LiveSellTab address={address} tick={tick} />
            : <MockSellTab isConnected={isConnected} />
        ) : (
          isConnected && address
            ? <ClaimTab address={address} tick={tick} />
            : <p className="text-text-secondary text-sm text-center py-6">Connect your wallet to claim tokens.</p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

// =============================================================================
// MOCK BUY TAB (preview)
// =============================================================================

function MockBuyTab({ tick, isConnected }: { tick: string; isConnected: boolean }) {
  const [sort, setSort] = useState<SortKey>("price_asc")
  const [maxPrice, setMaxPrice] = useState("")
  const mockOrders = MOCK_ORDERS[tick] || []

  const filtered = useMemo(() => {
    let orders = [...mockOrders]
    if (maxPrice) {
      const max = parseFloat(maxPrice)
      if (!isNaN(max)) orders = orders.filter(o => o.price <= max)
    }
    switch (sort) {
      case "price_asc": return orders.sort((a, b) => a.price - b.price)
      case "price_desc": return orders.sort((a, b) => b.price - a.price)
      case "total_desc": return orders.sort((a, b) => {
        const ta = parseInt(a.amount.replace(/,/g, "")) * a.price
        const tb = parseInt(b.amount.replace(/,/g, "")) * b.price
        return tb - ta
      })
      case "amount_desc": return orders.sort((a, b) =>
        parseInt(b.amount.replace(/,/g, "")) - parseInt(a.amount.replace(/,/g, "")))
      default: return orders
    }
  }, [mockOrders, sort, maxPrice])

  if (mockOrders.length === 0) {
    return <p className="text-text-secondary text-sm text-center py-8">No listings for ${tick} yet.</p>
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary">
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
          <option value="amount_desc">Largest orders first</option>
          <option value="total_desc">Highest total first</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Max price:</span>
          <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="No limit" step="0.001"
            className="w-28 px-2 py-1.5 bg-surface border border-border rounded-lg text-sm font-mono" />
        </div>
        <span className="text-xs text-text-secondary ml-auto">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_1fr_1fr_80px] gap-4 px-3 text-xs text-text-secondary uppercase tracking-wider">
        <span>Amount</span>
        <span className="text-right">Price</span>
        <span className="text-right">Total</span>
        <span></span>
      </div>

      {/* Order rows */}
      {!TRADING_LIVE && filtered.length > 0 && (
        <div className="text-center">
          <span className="text-xs px-2 py-0.5 rounded bg-border text-text-secondary">Preview data</span>
        </div>
      )}
      <div className={`space-y-1.5 ${!TRADING_LIVE ? "opacity-40 pointer-events-none" : ""}`}>
        {filtered.map((order, i) => {
          const total = parseInt(order.amount.replace(/,/g, "")) * order.price
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px] items-center gap-4 px-3 py-2.5 bg-surface border border-border rounded-lg">
              <div>
                <span className="font-mono text-sm">{order.amount}</span>
                <span className="text-xs text-text-secondary ml-2">{order.seller}</span>
              </div>
              <div className="text-right font-mono text-sm">${order.price.toFixed(4)}</div>
              <div className="text-right font-mono text-sm">${total.toFixed(2)}</div>
              <button disabled className="px-3 py-1 bg-success text-white text-sm font-medium rounded-lg">
                Buy
              </button>
            </div>
          )
        })}
      </div>

      {!isConnected && (
        <p className="text-xs text-text-secondary text-center pt-2">Connect your wallet to buy.</p>
      )}
    </div>
  )
}

// =============================================================================
// MOCK SELL TAB
// =============================================================================

function MockSellTab({ isConnected }: { isConnected: boolean }) {
  return (
    <div className={`space-y-4 ${!TRADING_LIVE ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Amount</label>
          <input type="text" disabled placeholder="1000"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg font-mono text-sm" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Price per token (USDC)</label>
          <input type="text" disabled placeholder="0.01"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg font-mono text-sm" />
        </div>
      </div>
      <button disabled className="px-5 py-2 bg-accent text-white font-medium rounded-lg">
        Approve &amp; List
      </button>
      <p className="text-xs text-text-secondary">1% fee. Tokens locked until sold or cancelled.</p>
      {!isConnected && (
        <p className="text-xs text-text-secondary text-center">Connect your wallet to sell.</p>
      )}
    </div>
  )
}

// =============================================================================
// LIVE BUY TAB
// =============================================================================

function LiveBuyTab({ address, tick }: { address: `0x${string}`; tick: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>("price_asc")
  const [maxPrice, setMaxPrice] = useState("")
  const [buyingId, setBuyingId] = useState<number | null>(null)
  const [buyAmounts, setBuyAmounts] = useState<Record<number, string>>({})
  const [step, setStep] = useState<"idle" | "approve" | "buy">("idle")
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null)
  const publicClient = usePublicClient()

  const { data: orderCount } = useReadContract({
    address: CONTRACTS.marketplace,
    abi: MARKETPLACE_ABI,
    functionName: "orderCount",
  })

  const fetchOrders = useCallback(async () => {
    if (!publicClient || orderCount === undefined) return
    const count = Number(orderCount)
    if (count === 0) { setLoading(false); return }
    const fetched: Order[] = []
    for (let i = Math.max(0, count - 50); i < count; i++) {
      try {
        const data = await publicClient.readContract({
          address: CONTRACTS.marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "orders",
          args: [BigInt(i)],
        })
        const [seller, token, amount, pricePerToken, active] = data as [string, string, bigint, bigint, boolean]
        if (active) fetched.push({ id: i, seller: seller as `0x${string}`, token: token as `0x${string}`, amount, pricePerToken, active })
      } catch {}
    }
    setOrders(fetched)
    setLoading(false)
  }, [publicClient, orderCount])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Filter & sort
  const filtered = useMemo(() => {
    let list = [...orders]
    if (maxPrice) {
      const max = parseFloat(maxPrice)
      if (!isNaN(max)) list = list.filter(o => Number(o.pricePerToken) / 1e6 <= max)
    }
    switch (sort) {
      case "price_asc": return list.sort((a, b) => Number(a.pricePerToken - b.pricePerToken))
      case "price_desc": return list.sort((a, b) => Number(b.pricePerToken - a.pricePerToken))
      case "amount_desc": return list.sort((a, b) => Number(b.amount - a.amount))
      case "total_desc": return list.sort((a, b) => Number((b.amount * b.pricePerToken) - (a.amount * a.pricePerToken)))
      default: return list
    }
  }, [orders, sort, maxPrice])

  const { writeContract: approveWrite, data: approveTx, reset: resetApprove } = useWriteContract()
  const { isSuccess: approveOk } = useWaitForTransactionReceipt({ hash: approveTx })
  const { writeContract: buyWrite, data: buyTx, reset: resetBuy } = useWriteContract()
  const { isSuccess: buyOk } = useWaitForTransactionReceipt({ hash: buyTx })

  useEffect(() => {
    if (approveOk && pendingOrder && step === "approve") {
      setStep("buy")
      buyWrite({
        address: CONTRACTS.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "buy",
        args: [BigInt(pendingOrder.id), parseEther(buyAmounts[pendingOrder.id] || "0")],
      })
    }
  }, [approveOk, pendingOrder, step, buyAmounts, buyWrite])

  useEffect(() => {
    if (buyOk) {
      setStep("idle"); setBuyingId(null); setPendingOrder(null)
      resetApprove(); resetBuy(); fetchOrders()
    }
  }, [buyOk, fetchOrders, resetApprove, resetBuy])

  const handleBuy = (order: Order) => {
    const amt = parseEther(buyAmounts[order.id] || "0")
    if (amt === 0n) return
    setBuyingId(order.id); setPendingOrder(order); setStep("approve")
    const totalUsdc = (amt * order.pricePerToken) / parseEther("1")
    approveWrite({ address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: "approve", args: [CONTRACTS.marketplace, totalUsdc] })
  }

  if (loading) return <p className="text-text-secondary animate-pulse py-6 text-center text-sm">Loading orders...</p>
  if (orders.length === 0) return <p className="text-text-secondary text-sm text-center py-8">No active orders. Be the first to list.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary">
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
          <option value="amount_desc">Largest first</option>
          <option value="total_desc">Highest total</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Max price:</span>
          <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="No limit" step="0.001"
            className="w-28 px-2 py-1.5 bg-surface border border-border rounded-lg text-sm font-mono" />
        </div>
        <span className="text-xs text-text-secondary ml-auto">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_100px_80px] gap-3 px-3 text-xs text-text-secondary uppercase tracking-wider">
        <span>Amount</span>
        <span className="text-right">Price</span>
        <span className="text-right">Total</span>
        <span>Qty</span>
        <span></span>
      </div>

      <div className="space-y-1.5">
        {filtered.map((order) => {
          const price = Number(order.pricePerToken) / 1e6
          const amtStr = buyAmounts[order.id] || ""
          const cost = amtStr ? (Number(amtStr) * price).toFixed(2) : ""
          return (
            <div key={order.id} className="grid grid-cols-[1fr_1fr_1fr_100px_80px] items-center gap-3 px-3 py-2 bg-surface border border-border rounded-lg">
              <div>
                <span className="font-mono text-sm">{formatEther(order.amount)}</span>
                <span className="text-xs text-text-secondary ml-2">
                  {order.seller === address ? <span className="text-accent">you</span> : `${order.seller.slice(0, 5)}...${order.seller.slice(-3)}`}
                </span>
              </div>
              <div className="text-right font-mono text-sm">${price.toFixed(4)}</div>
              <div className="text-right font-mono text-sm text-text-secondary">
                {cost ? `$${cost}` : `$${(Number(formatEther(order.amount)) * price).toFixed(2)}`}
              </div>
              <input type="number" placeholder="Amt" value={amtStr}
                onChange={(e) => setBuyAmounts({ ...buyAmounts, [order.id]: e.target.value })}
                className="px-2 py-1 bg-background border border-border rounded text-sm font-mono w-full" />
              <button onClick={() => handleBuy(order)} disabled={buyingId !== null || !amtStr}
                className="px-3 py-1 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed">
                {buyingId === order.id ? (step === "approve" ? "OK..." : "Buy...") : "Buy"}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// LIVE SELL TAB
// =============================================================================

function LiveSellTab({ address, tick }: { address: `0x${string}`; tick: string }) {
  const [amount, setAmount] = useState("")
  const [priceInput, setPriceInput] = useState("")
  const [step, setStep] = useState<"input" | "approve" | "list">("input")

  const { data: tokenAddr } = useReadContract({
    address: CONTRACTS.factory, abi: FACTORY_ABI, functionName: "getToken", args: [tick],
  })
  const validToken = tokenAddr && tokenAddr !== zeroAddress
  const { data: balance } = useReadContract({
    address: validToken ? (tokenAddr as `0x${string}`) : undefined,
    abi: ERC20_ABI, functionName: "balanceOf", args: [address],
  })

  const { writeContract: approveWrite, data: approveTx, reset: resetApprove } = useWriteContract()
  const { isSuccess: approveOk } = useWaitForTransactionReceipt({ hash: approveTx })
  const { writeContract: listWrite, data: listTx, reset: resetList } = useWriteContract()
  const { isSuccess: listOk } = useWaitForTransactionReceipt({ hash: listTx })

  useEffect(() => {
    if (approveOk && step === "approve" && validToken) {
      setStep("list")
      listWrite({
        address: CONTRACTS.marketplace, abi: MARKETPLACE_ABI, functionName: "list",
        args: [tokenAddr as `0x${string}`, parseEther(amount), parseUnits(priceInput || "0", 6)],
      })
    }
  }, [approveOk, step, validToken, tokenAddr, amount, priceInput, listWrite])

  useEffect(() => {
    if (listOk) { setStep("input"); setAmount(""); setPriceInput(""); resetApprove(); resetList() }
  }, [listOk, resetApprove, resetList])

  const handleSell = () => {
    if (!validToken || !amount || !priceInput) return
    setStep("approve")
    approveWrite({
      address: tokenAddr as `0x${string}`, abi: ERC20_ABI, functionName: "approve",
      args: [CONTRACTS.marketplace, parseEther(amount)],
    })
  }

  return (
    <div className="space-y-4">
      {balance !== undefined && validToken && (
        <p className="text-sm text-text-secondary">
          Balance: <span className="font-mono text-text-primary">{formatEther(balance as bigint)} ${tick}</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Amount</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg font-mono text-sm" placeholder="1000" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Price per token (USDC)</label>
          <input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg font-mono text-sm" placeholder="0.01" step="0.0001" />
        </div>
      </div>
      {amount && priceInput && (
        <p className="text-sm text-text-secondary">
          Total: <span className="font-mono text-text-primary">{(Number(amount) * Number(priceInput)).toFixed(2)} USDC</span>
          <span className="text-xs ml-2">(1% fee)</span>
        </p>
      )}
      <button onClick={handleSell}
        disabled={step !== "input" || !amount || !priceInput || !validToken}
        className="px-5 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed">
        {step === "input" ? "Approve & List"
          : step === "approve" ? (approveTx ? "Approving..." : "Sign Approval")
          : (listTx ? "Listing..." : "Sign Listing")}
      </button>
    </div>
  )
}

// =============================================================================
// CLAIM TAB
// =============================================================================

function ClaimTab({ address, tick }: { address: `0x${string}`; tick: string }) {
  const [status, setStatus] = useState<ClaimStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/claim-status/${address}`)
      setStatus(await res.json())
    } catch { setError("Failed to load") }
    finally { setLoading(false) }
  }, [address])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const { writeContract, data: txHash, reset } = useWriteContract()
  const { isSuccess: txOk } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (txOk) { setClaiming(false); reset(); fetchStatus() }
  }, [txOk, fetchStatus, reset])

  const handleClaim = async () => {
    if (!TRADING_LIVE) return
    setClaiming(true); setError(null)
    try {
      const res = await fetch("/api/claim-signature", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, tick }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      writeContract({
        address: CONTRACTS.claimManager, abi: CLAIM_MANAGER_ABI, functionName: "claim",
        args: [data.tick, BigInt(data.totalAmount), BigInt(data.nonce), data.signature as `0x${string}`],
        value: parseEther("0.0001"),
      })
    } catch (e: any) { setError(e.message); setClaiming(false) }
  }

  if (loading) return <p className="text-text-secondary animate-pulse text-sm text-center py-6">Loading...</p>

  if (!status?.linked) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-text-secondary text-sm">No agents linked to your wallet.</p>
        <p className="text-text-secondary text-xs">Use the link section below to connect your AI agent.</p>
        <button onClick={() => { setLoading(true); fetchStatus() }}
          className="mt-2 px-3 py-1 text-xs border border-border rounded-lg text-text-secondary hover:text-text-primary">
          Refresh
        </button>
      </div>
    )
  }

  const token = status.tokens?.find(t => t.tick === tick.toUpperCase())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="w-2 h-2 bg-success rounded-full"></span>
        Linked: <strong className="text-text-primary">{status.agents?.join(", ")}</strong>
      </div>

      {error && <div className="border border-accent/30 bg-accent/5 rounded-lg p-3 text-sm text-accent">{error}</div>}

      {token ? (
        <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg">
          <div>
            <span className="font-mono font-bold text-accent">${token.tick}</span>
            <span className="text-text-secondary text-sm ml-3">{Number(token.totalBalance).toLocaleString()} tokens</span>
            <div className="text-xs text-text-secondary mt-1">
              {token.agents.map(a => `${a.name}: ${Number(a.amount).toLocaleString()}`).join(" | ")}
            </div>
          </div>
          {TRADING_LIVE ? (
            <button onClick={handleClaim} disabled={claiming}
              className="px-5 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50">
              {claiming ? (txHash ? "Confirming..." : "Sign TX...") : "Claim"}
            </button>
          ) : (
            <span className="px-4 py-2 bg-border text-text-secondary text-sm font-medium rounded-lg">Soon</span>
          )}
        </div>
      ) : (
        <p className="text-text-secondary text-sm">No ${tick} balance to claim.</p>
      )}
    </div>
  )
}

// =============================================================================
// LINK ACCORDION
// =============================================================================

function LinkAccordion({ address }: { address: `0x${string}` | undefined }) {
  const [open, setOpen] = useState(false)

  // Auto-open when navigating via #link (handles both direct load and client-side nav)
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === "#link") {
        setOpen(true)
        setTimeout(() => {
          document.getElementById("link")?.scrollIntoView({ behavior: "smooth" })
        }, 200)
      }
    }
    checkHash()
    window.addEventListener("hashchange", checkHash)
    return () => window.removeEventListener("hashchange", checkHash)
  }, [])

  const walletPlaceholder = address || "0xYourWalletAddress"

  const agentPrompt = `Post this exact message on Moltbook to link yourself to wallet ${walletPlaceholder}:

{"p":"mbc-20","op":"link","wallet":"${walletPlaceholder}"}

mbc20.xyz

This will allow the wallet owner to claim your mbc-20 token balances as ERC-20 tokens on Base.`

  return (
    <div id="link" className="border border-border rounded-lg">
      <button onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between text-sm hover:bg-surface transition-colors">
        <span>
          <span className="text-accent font-bold">Link your agent</span>
          <span className="text-text-secondary"> — copy this prompt for your AI agent</span>
        </span>
        <span className={`text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
          <div className="relative group bg-surface border border-border rounded-lg p-4">
            <pre className="font-mono text-sm text-text-secondary whitespace-pre-wrap break-all">{agentPrompt}</pre>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={agentPrompt} />
            </div>
          </div>
          {!address && (
            <p className="text-xs text-accent">Connect your wallet above to generate the prompt with your address.</p>
          )}
          <p className="text-xs text-text-secondary">
            One wallet can link multiple agents. The indexer detects link posts automatically.
          </p>
        </div>
      )}
    </div>
  )
}
