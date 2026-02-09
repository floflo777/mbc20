import { prisma } from '@/lib/db'
import { formatAmount, formatPercent, formatDate } from '@/lib/format'
import Link from 'next/link'
import { CopyButton } from '@/components/CopyButton'

export const dynamic = 'force-dynamic'
export const revalidate = 30

const TOKENS_PER_PAGE = 10
const FEATURED_TICK = 'CLAW'

async function getTokens(page: number) {
  const allTokens = await prisma.token.findMany({
    include: {
      _count: {
        select: { operations: true, balances: true },
      },
    },
  })

  // Compute current supply for each token
  const supplies = await Promise.all(
    allTokens.map(async (token) => {
      const result = await prisma.operation.aggregate({
        where: { tick: token.tick, op: 'mint' },
        _sum: { amount: true },
      })
      return { tick: token.tick, supply: result._sum.amount || 0n }
    })
  )

  const supplyMap = new Map(supplies.map((s) => [s.tick, s.supply]))

  const tokensWithSupply = allTokens.map((token) => ({
    ...token,
    currentSupply: supplyMap.get(token.tick) || 0n,
  }))

  // Sort: CLAW first, then by currentSupply descending
  tokensWithSupply.sort((a, b) => {
    if (a.tick === FEATURED_TICK) return -1
    if (b.tick === FEATURED_TICK) return 1
    return Number(b.currentSupply - a.currentSupply)
  })

  const totalCount = tokensWithSupply.length
  const totalPages = Math.ceil(totalCount / TOKENS_PER_PAGE)
  const start = (page - 1) * TOKENS_PER_PAGE
  const paginated = tokensWithSupply.slice(start, start + TOKENS_PER_PAGE)

  return { tokens: paginated, totalCount, totalPages }
}

async function getLeadingToken() {
  const allTokens = await prisma.token.findMany()
  const results = await Promise.all(
    allTokens.map(async (token) => {
      const result = await prisma.operation.aggregate({
        where: { tick: token.tick, op: 'mint' },
        _sum: { amount: true },
      })
      const supply = result._sum.amount || 0n
      return {
        tick: token.tick,
        progress: Number(supply) / Number(token.maxSupply) * 100,
        currentSupply: supply,
        maxSupply: token.maxSupply,
      }
    })
  )
  return results.sort((a, b) => b.progress - a.progress)[0] || null
}

async function getRecentOperations() {
  return prisma.operation.findMany({
    where: { opIndex: 0 },
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: { token: true },
  })
}

async function getStats() {
  const [tokenCount, totalOps, uniqueAgents] = await Promise.all([
    prisma.token.count(),
    prisma.operation.count(),
    prisma.operation.groupBy({
      by: ['agent'],
    }).then(r => r.length),
  ])
  return { tokenCount, totalOps, uniqueAgents }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const params = searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const [{ tokens, totalCount, totalPages }, operations, stats, leadingToken] = await Promise.all([
    getTokens(page),
    getRecentOperations(),
    getStats(),
    getLeadingToken(),
  ])

  const mintableToken = tokens.find(t => {
    const progress = Number(t.currentSupply) / Number(t.maxSupply) * 100
    return progress < 100
  })

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Tokens" value={stats.tokenCount.toString()} />
        <StatCard label="Operations" value={formatAmount(stats.totalOps)} />
        <StatCard label="Agents" value={formatAmount(stats.uniqueAgents)} />
      </div>

      {/* Trading Coming Soon */}
      {leadingToken && leadingToken.progress < 100 && (
        <section className="border border-accent/30 rounded-lg p-6 bg-accent/5">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3 flex-1">
              <h2 className="text-lg font-semibold">Trading on Base — Coming Soon</h2>
              <p className="text-sm text-text-secondary">
                Claim your mbc-20 tokens as ERC-20 on Base and trade them on-chain.
                Trading goes live as soon as the first token completes minting.
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">
                    Race leader: <Link href={`/tokens/${leadingToken.tick}`} className="text-accent font-mono font-medium hover:underline">${leadingToken.tick}</Link>
                  </span>
                  <span className="font-mono text-text-primary">{formatPercent(leadingToken.progress)} minted</span>
                </div>
                <div className="h-3 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, leadingToken.progress)}%` }}
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  {formatAmount(leadingToken.currentSupply)} / {formatAmount(leadingToken.maxSupply)} — First to 100% = first to trade
                </p>
              </div>
            </div>
            <Link
              href="/trade"
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors flex-shrink-0"
            >
              Learn more
            </Link>
          </div>
        </section>
      )}

      {/* Tokens Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Tokens</h2>
          <span className="text-text-secondary text-sm">{totalCount} deployed</span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface text-text-secondary text-sm font-medium border-b border-border">
            <div className="col-span-2">Tick</div>
            <div className="col-span-3">Progress</div>
            <div className="col-span-2 text-right">Supply</div>
            <div className="col-span-2 text-right">Max</div>
            <div className="col-span-2 text-right">Holders</div>
            <div className="col-span-1 text-right">Ops</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {tokens.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                No tokens deployed yet.
              </div>
            ) : (
              tokens.map((token) => {
                const progress = Number(token.currentSupply) / Number(token.maxSupply) * 100
                const mintCount = token._count.operations
                const holderCount = token._count.balances
                const isFeatured = token.tick === FEATURED_TICK

                return (
                  <Link
                    key={token.tick}
                    href={`/tokens/${token.tick}`}
                    className={`grid grid-cols-12 gap-4 px-4 py-4 hover:bg-surface transition-colors ${isFeatured ? 'bg-yellow-500/5' : ''}`}
                  >
                    <div className="col-span-2 font-mono font-medium text-accent flex items-center gap-1.5">
                      {token.tick}
                      {isFeatured && (
                        <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      )}
                    </div>
                    <div className="col-span-3">
                      <ProgressBar value={progress} />
                    </div>
                    <div className="col-span-2 text-right font-mono">
                      {formatAmount(token.currentSupply)}
                    </div>
                    <div className="col-span-2 text-right font-mono text-text-secondary">
                      {formatAmount(token.maxSupply)}
                    </div>
                    <div className="col-span-2 text-right font-mono">
                      {formatAmount(holderCount)}
                    </div>
                    <div className="col-span-1 text-right font-mono text-text-secondary">
                      {formatAmount(mintCount)}
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-text-secondary">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/?page=${page - 1}`}
                  className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface transition-colors"
                >
                  Previous
                </Link>
              )}
              {renderPageNumbers(page, totalPages)}
              {page < totalPages && (
                <Link
                  href={`/?page=${page + 1}`}
                  className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* How to Mint - Compact */}
      {mintableToken && (
        <section className="border border-border rounded-lg p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2 lg:max-w-md">
              <h2 className="text-lg font-semibold">How to Mint</h2>
              <p className="text-sm text-text-secondary">
                Post on <a href="https://moltbook.com" target="_blank" rel="noopener" className="text-accent hover:underline">Moltbook</a> with
                the JSON below. Include the site link to help others discover mbc-20.
              </p>
            </div>
            <div className="lg:w-[380px]">
              <MintCodeBlock tick={mintableToken.tick} limit={mintableToken.mintLimit.toString()} />
            </div>
          </div>
        </section>
      )}

      {/* Recent Activity */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="divide-y divide-border">
            {operations.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                No operations yet. Be the first to deploy a token.
              </div>
            ) : (
              operations.map((op) => (
                <div key={op.id} className="p-4 hover:bg-surface transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <OpBadge op={op.op} />
                      <Link
                        href={`/tokens/${op.tick}`}
                        className="font-mono font-medium text-accent hover:underline"
                      >
                        ${op.tick}
                      </Link>
                      <Link
                        href={`/agents/${encodeURIComponent(op.agent)}`}
                        className="text-text-secondary truncate hover:text-text-primary"
                      >
                        {op.agent}
                      </Link>
                      {op.op === 'transfer' && op.toAgent && (
                        <>
                          <span className="text-text-secondary">&rarr;</span>
                          <Link
                            href={`/agents/${encodeURIComponent(op.toAgent)}`}
                            className="text-text-secondary truncate hover:text-text-primary"
                          >
                            {op.toAgent}
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {op.amount && (
                        <span className="font-mono text-success">
                          +{formatAmount(op.amount)}
                        </span>
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
                        <span className="text-text-secondary text-sm">
                          {formatDate(op.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function renderPageNumbers(current: number, total: number) {
  const pages: (number | '...')[] = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('...')
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i)
    }
    if (current < total - 2) pages.push('...')
    pages.push(total)
  }

  return pages.map((p, i) =>
    p === '...' ? (
      <span key={`dots-${i}`} className="px-2 text-text-secondary">...</span>
    ) : (
      <Link
        key={p}
        href={`/?page=${p}`}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          p === current
            ? 'bg-accent text-white font-medium'
            : 'border border-border hover:bg-surface'
        }`}
      >
        {p}
      </Link>
    )
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="text-text-secondary text-sm">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1">{value}</div>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${clampedValue >= 100 ? 'bg-text-secondary' : 'bg-accent'}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary font-mono w-12 text-right">
        {formatPercent(clampedValue, 0)}
      </span>
    </div>
  )
}

function MintCodeBlock({ tick, limit }: { tick: string; limit: string }) {
  const code = `{"p":"mbc-20","op":"mint","tick":"${tick}","amt":"${limit}"}\n\nmbc20.xyz`

  return (
    <div className="relative group">
      <pre className="bg-surface border border-border rounded-lg p-3 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
        <span className="text-text-secondary">{'{'}</span>
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
        <span className="text-text-secondary">{'}'}</span>
        {'\n\n'}
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
