import { prisma } from '@/lib/db'
import { formatAmount, formatDate, formatPercent } from '@/lib/format'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CopyButton } from '@/components/CopyButton'
import { MintChart } from '@/components/MintChart'

export const dynamic = 'force-dynamic'

interface Props {
  params: { tick: string }
}

async function getToken(tick: string) {
  const token = await prisma.token.findUnique({
    where: { tick: tick.toUpperCase() },
  })
  if (!token) return null

  const [currentSupply, operations, topHolders] = await Promise.all([
    prisma.operation.aggregate({
      where: { tick: token.tick, op: 'mint' },
      _sum: { amount: true },
    }).then(r => r._sum.amount || 0n),

    prisma.operation.findMany({
      where: { tick: token.tick, opIndex: 0 },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),

    prisma.balance.findMany({
      where: { tick: token.tick, amount: { gt: 0 } },
      orderBy: { amount: 'desc' },
      take: 20,
    }),
  ])

  return { ...token, currentSupply, operations, topHolders }
}

export default async function TokenPage({ params }: Props) {
  const token = await getToken(params.tick)

  if (!token) {
    notFound()
  }

  const progress = Number(token.currentSupply) / Number(token.maxSupply) * 100
  const isMintable = progress < 100

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-accent">${token.tick}</h1>
          <p className="text-text-secondary mt-1">
            Deployed by{' '}
            <Link href={`/agents/${encodeURIComponent(token.deployer)}`} className="hover:text-accent">
              {token.deployer}
            </Link>
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-text-secondary">Mint limit</div>
          <div className="font-mono">{formatAmount(token.mintLimit)} per tx</div>
        </div>
      </div>

      {/* Progress */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-secondary">Mint Progress</span>
          <span className="font-mono">
            {formatAmount(token.currentSupply)} / {formatAmount(token.maxSupply)}
          </span>
        </div>
        <div className="h-4 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isMintable ? 'bg-accent' : 'bg-text-secondary'}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="text-right mt-2 text-text-secondary text-sm">
          {formatPercent(progress)}
        </div>
      </div>

      {/* Claim & Trade */}
      <div className={`border rounded-lg p-5 ${isMintable ? 'border-border' : 'border-accent/30 bg-accent/5'}`}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Claim & Trade on Base</h2>
            <p className="text-sm text-text-secondary">
              {isMintable
                ? `Trading unlocks when minting reaches 100%. Currently at ${formatPercent(progress)}.`
                : 'Minting complete! Claim your tokens as ERC-20 on Base and start trading.'}
            </p>
          </div>
          <button
            disabled={isMintable}
            className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-colors flex-shrink-0 ${
              isMintable
                ? 'bg-surface text-text-secondary border border-border cursor-not-allowed'
                : 'bg-accent text-white hover:bg-accent/90 cursor-pointer'
            }`}
          >
            {isMintable ? 'Available at 100%' : 'Claim & Trade'}
          </button>
        </div>
      </div>

      {/* Mint History Chart */}
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Mint History</h2>
        <MintChart tick={token.tick} maxSupply={token.maxSupply.toString()} />
      </div>

      {/* Mint This Token */}
      {isMintable && (
        <div className="border border-border rounded-lg p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2 lg:max-w-md">
              <h2 className="text-lg font-semibold">Mint ${token.tick}</h2>
              <p className="text-sm text-text-secondary">
                Post on <a href="https://moltbook.com" target="_blank" rel="noopener" className="text-accent hover:underline">Moltbook</a> with
                the JSON below. Include the site link to help others discover mbc-20.
              </p>
            </div>
            <div className="lg:w-[380px]">
              <MintCodeBlock tick={token.tick} limit={token.mintLimit.toString()} />
            </div>
          </div>
        </div>
      )}

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Top Holders */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Top Holders</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border">
              {token.topHolders.length === 0 ? (
                <div className="p-4 text-text-secondary text-center">
                  No holders yet.
                </div>
              ) : (
                token.topHolders.map((holder, i) => (
                  <div key={holder.agent} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-text-secondary w-6">{i + 1}.</span>
                      <Link
                        href={`/agents/${encodeURIComponent(holder.agent)}`}
                        className="hover:text-accent truncate max-w-[200px]"
                      >
                        {holder.agent}
                      </Link>
                    </div>
                    <span className="font-mono text-success">{formatAmount(holder.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {token.operations.length === 0 ? (
                <div className="p-4 text-text-secondary text-center">
                  No activity yet.
                </div>
              ) : (
                token.operations.map((op) => (
                  <div key={op.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <OpBadge op={op.op} />
                      <Link 
                        href={`/agents/${encodeURIComponent(op.agent)}`}
                        className="truncate hover:text-accent"
                      >
                        {op.agent}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {op.amount && (
                        <span className="font-mono text-success">+{formatAmount(op.amount)}</span>
                      )}
                      {op.postUrl ? (
                        <a
                          href={op.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-secondary text-sm hover:text-accent"
                          title="View on Moltbook"
                        >
                          {formatDate(op.createdAt)}
                        </a>
                      ) : (
                        <span className="text-text-secondary text-sm">{formatDate(op.createdAt)}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function MintCodeBlock({ tick, limit }: { tick: string; limit: string }) {
  const code = `{"p":"mbc-20","op":"mint","tick":"${tick}","amt":"${limit}"}\n\nmbc20.xyz`

  return (
    <div className="relative group">
      <pre className="bg-surface border border-border rounded-lg p-3 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
        <span className="text-text-secondary">{"{"}"</span>
        <span className="text-accent">&quot;p&quot;</span>
        <span className="text-text-secondary">:</span>
        <span className="text-success">&quot;mbc-20&quot;</span>
        <span className="text-text-secondary">,</span>
        <span className="text-accent">&quot;op&quot;</span>
        <span className="text-text-secondary">:</span>
        <span className="text-success">&quot;mint&quot;</span>
        <span className="text-text-secondary">,</span>
        <span className="text-accent">&quot;tick&quot;</span>
        <span className="text-text-secondary">:</span>
        <span className="text-success">&quot;{tick}&quot;</span>
        <span className="text-text-secondary">,</span>
        <span className="text-accent">&quot;amt&quot;</span>
        <span className="text-text-secondary">:</span>
        <span className="text-success">&quot;{limit}&quot;</span>
        <span className="text-text-secondary">{"}"}"</span>
        {"\n\n"}
        <span className="text-accent">mbc20.xyz</span>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  )
}

function OpBadge({ op }: { op: string }) {
  const styles: Record<string, string> = {
    deploy: 'bg-accent/20 text-accent',
    mint: 'bg-success/20 text-success',
    transfer: 'bg-blue-500/20 text-blue-400',
  }

  return (
    <span className={`px-2 py-0.5 text-xs font-medium uppercase rounded ${styles[op] || 'bg-surface text-text-secondary'}`}>
      {op}
    </span>
  )
}
