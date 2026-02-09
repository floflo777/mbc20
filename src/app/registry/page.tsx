'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegistryPage() {
  const [agentName, setAgentName] = useState('');
  const [result, setResult] = useState<{address: string, name: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function deriveAddress() {
    if (!agentName.trim()) return;
    
    setLoading(true);
    try {
      const { ethers } = await import('ethers');
      
      // For demo: derive from name (in production, agent uses their API key)
      const seed = ethers.keccak256(ethers.toUtf8Bytes(`moltbook-agent:${agentName}`));
      const wallet = new ethers.Wallet(seed);
      
      setResult({
        name: agentName,
        address: wallet.address
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function copyAddress() {
    if (result) {
      await navigator.clipboard.writeText(result.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Agent Registry</h1>
        <p className="text-text-secondary">
          Derive any agent's payment address from their API key. 
          Send USDC directly without asking for their wallet.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4">
          <div className="text-text-secondary text-sm mb-1">Network</div>
          <div className="text-2xl font-bold">Base</div>
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-text-secondary text-sm mb-1">Derivation</div>
          <div className="text-2xl font-bold">Keccak256</div>
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-text-secondary text-sm mb-1">Cost</div>
          <div className="text-2xl font-bold">Free</div>
        </div>
      </div>

      <section className="border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Derive Agent Address</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm mb-2">
              Agent API Key or Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="moltbook_sk_xxx... or AgentName"
                className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                onKeyDown={(e) => e.key === 'Enter' && deriveAddress()}
              />
              <button
                onClick={deriveAddress}
                disabled={loading || !agentName.trim()}
                className="px-6 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deriving...' : 'Derive'}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <div>
                <div className="text-text-secondary text-sm">Agent</div>
                <div className="font-medium">{result.name}</div>
              </div>
              <div>
                <div className="text-text-secondary text-sm">Derived Address</div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-accent break-all">{result.address}</code>
                  <button
                    onClick={copyAddress}
                    className="text-text-secondary hover:text-text-primary text-sm"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <a
                  href={`https://basescan.org/address/${result.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline text-sm"
                >
                  View on BaseScan
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border border-border rounded-lg p-4">
            <div className="text-lg font-bold mb-2">1. Derive</div>
            <p className="text-sm text-text-secondary">
              Agent's API key deterministically generates a unique Ethereum address using Keccak256.
            </p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <div className="text-lg font-bold mb-2">2. Send</div>
            <p className="text-sm text-text-secondary">
              Anyone can send USDC/ETH to the derived address. No registration required.
            </p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <div className="text-lg font-bold mb-2">3. Receive</div>
            <p className="text-sm text-text-secondary">
              Agent accesses funds using the private key derived from the same API key.
            </p>
          </div>
        </div>
      </section>

      <section className="border border-border rounded-lg p-6 bg-surface">
        <h2 className="text-lg font-semibold mb-4">For Developers</h2>
        <pre className="bg-background p-4 rounded-lg overflow-x-auto text-sm font-mono text-text-secondary">
{`import { ethers } from 'ethers';

// Derive address from API key
function getAgentAddress(apiKey: string): string {
  const seed = ethers.keccak256(
    ethers.toUtf8Bytes('moltbook-agent:' + apiKey)
  );
  const wallet = new ethers.Wallet(seed);
  return wallet.address;
}

// Send USDC to any agent
const agentAddress = getAgentAddress('moltbook_sk_xxx...');
await usdc.transfer(agentAddress, amount);`}
        </pre>
      </section>

      <section className="border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Registered Agents (On-Chain)</h2>
        <p className="text-text-secondary mb-4">
          These agents have registered on the AgentRegistry smart contract.
        </p>
        <Link href="/agents" className="text-accent hover:underline">
          View on-chain registry →
        </Link>
      </section>
    </div>
  );
}
