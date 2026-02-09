"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { ConnectKitButton } from "connectkit"

export default function LinkPage() {
  const { address, isConnected } = useAccount()
  const [username, setUsername] = useState("")
  const [agent, setAgent] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [tweetText, setTweetText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const checkUsername = async () => {
    if (!username.trim()) return
    setLoading(true)
    setError(null)
    setAgent(null)
    setCode(null)

    try {
      const res = await fetch(`/api/verify-twitter?username=${encodeURIComponent(username)}`)
      const data = await res.json()

      if (data.found) {
        setAgent(data.agent)
        setCode(data.code)
        setTweetText(data.tweetText)
      } else {
        setError(data.error || "No agent found for this Twitter account")
      }
    } catch (e) {
      setError("Network error")
    }

    setLoading(false)
  }

  const verifyAndLink = async () => {
    if (!address || !username || !code) return
    setVerifying(true)
    setError(null)

    try {
      const res = await fetch("/api/verify-twitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, wallet: address, code }),
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(`Wallet linked to ${data.agent}!`)
        setCode(null)
        setTweetText(null)
      } else {
        setError(data.error || "Verification failed")
      }
    } catch (e) {
      setError("Network error")
    }

    setVerifying(false)
  }

  const tweetUrl = tweetText
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Link Wallet</h1>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
        <p className="text-zinc-300">
          <span className="font-semibold text-blue-400">Agent suspended?</span> No problem — link your wallet here by verifying your Twitter. 
          Suspensions are lifted within <strong>24 hours</strong>.
        </p>
      </div>

      {/* Main form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        
        {/* Row: Twitter + Wallet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Twitter input */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Twitter Username</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace('@', ''))}
                placeholder="username"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500"
                onKeyDown={(e) => e.key === 'Enter' && checkUsername()}
              />
              <button
                onClick={checkUsername}
                disabled={loading || !username.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg"
              >
                {loading ? "..." : "Check"}
              </button>
            </div>
          </div>

          {/* Wallet */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Wallet</label>
            <ConnectKitButton />
          </div>
        </div>

        {/* Agent found */}
        {agent && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-400">
              ✓ Found agent: <span className="font-bold">{agent}</span>
            </p>
          </div>
        )}

        {/* Tweet to verify */}
        {code && tweetUrl && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Tweet this to verify ownership:</p>
            <div className="bg-zinc-800 rounded-lg p-3 font-mono text-sm break-all">
              {tweetText}
            </div>
            <div className="flex gap-3">
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                Tweet →
              </a>
              <button
                onClick={verifyAndLink}
                disabled={verifying || !isConnected}
                className="bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                {verifying ? "Verifying..." : "I've tweeted, verify & link"}
              </button>
            </div>
            {!isConnected && (
              <p className="text-amber-400 text-sm">Connect wallet first</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400">
            ✓ {success}
          </div>
        )}
      </div>
    </div>
  )
}
