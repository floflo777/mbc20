import { prisma } from '@/lib/db'
import { formatAmount } from '@/lib/format'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getDeployableTokens() {
  const tokens = await prisma.token.findMany({
    include: {
      _count: {
        select: { operations: true, balances: true },
      },
    },
  })

  const tokenData = await Promise.all(
    tokens.map(async (token) => {
      const [supplyResult, burnResult] = await Promise.all([
        prisma.balance.aggregate({
          where: { tick: token.tick },
          _sum: { amount: true },
        }),
        prisma.operation.aggregate({
          where: { tick: token.tick, op: 'burn' },
          _sum: { amount: true },
        }),
      ])
      return {
        tick: token.tick,
        maxSupply: token.maxSupply,
        mintLimit: token.mintLimit,
        deployer: token.deployer,
        currentSupply: supplyResult._sum.amount || 0n,
        burned: burnResult._sum.amount || 0n,
        holders: token._count.balances,
        operations: token._count.operations,
        createdAt: token.createdAt,
      }
    })
  )

  // Sort: fully minted first, then by holders desc
  tokenData.sort((a, b) => {
    const aMinted = Number(a.currentSupply) >= Number(a.maxSupply)
    const bMinted = Number(b.currentSupply) >= Number(b.maxSupply)
    if (aMinted && !bMinted) return -1
    if (!aMinted && bMinted) return 1
    return b.holders - a.holders
  })

  return tokenData
}

export default async function DeployPage() {
  const tokens = await getDeployableTokens()

  const fullyMinted = tokens.filter(t => Number(t.currentSupply) >= Number(t.maxSupply))
  const minting = tokens.filter(t => Number(t.currentSupply) < Number(t.maxSupply))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Deploy On-Chain</h1>
          <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent font-medium">
            V2 — Coming Soon
          </span>
        </div>
        <p className="text-text-secondary text-sm mt-1">
          Deploy any fully-minted mbc-20 token as an ERC-20 on Base. Burn $CLAW to deploy and earn 1% of all trading fees forever.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-2xl mb-2">1</div>
          <h3 className="font-medium text-sm mb-1">Burn CLAW</h3>
          <p className="text-xs text-text-secondary">
            Pay 1,000 $CLAW (burned permanently) to deploy any fully-minted token on Base.
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-2xl mb-2">2</div>
          <h3 className="font-medium text-sm mb-1">Airdrop to Holders</h3>
          <p className="text-xs text-text-secondary">
            Batch airdrop ERC-20 tokens to all inscription holders. Only the deployer can airdrop.
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-2xl mb-2">3</div>
          <h3 className="font-medium text-sm mb-1">Earn 1% Fees</h3>
          <p className="text-xs text-text-secondary">
            As deployer, you earn 1% of every trade. The other 1% is burned. Then renounce ownership.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <div className="text-xl font-mono font-bold">{fullyMinted.length}</div>
          <div className="text-xs text-text-secondary mt-1">Ready to Deploy</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <div className="text-xl font-mono font-bold">1,000</div>
          <div className="text-xs text-text-secondary mt-1">CLAW per Deploy</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <div className="text-xl font-mono font-bold">1%</div>
          <div className="text-xs text-text-secondary mt-1">Fee to Deployer</div>
        </div>
      </div>

      {/* Ready to deploy */}
      {fullyMinted.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">Ready to Deploy</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface text-text-secondary text-xs font-medium border-b border-border uppercase tracking-wider">
              <div className="col-span-2">Tick</div>
              <div className="col-span-2 text-right">Supply</div>
              <div className="col-span-2 text-right">Holders</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-4 text-right">Action</div>
            </div>

            <div className="divide-y divide-border">
              {fullyMinted.map((token) => {
                const isClaw = token.tick === 'CLAW'

                return (
                  <div key={token.tick} className="grid grid-cols-12 gap-4 px-4 py-4 items-center">
                    <div className="col-span-2">
                      <Link href={`/tokens/${token.tick}`} className="font-mono font-medium text-accent hover:underline flex items-center gap-1.5">
                        ${token.tick}
                        {isClaw && (
                          <svg className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        )}
                      </Link>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm">
                      {formatAmount(token.maxSupply)}
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm">
                      {formatAmount(token.holders)}
                    </div>
                    <div className="col-span-2 text-center">
                      {isClaw ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                          On-chain (V1)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                          Off-chain
                        </span>
                      )}
                    </div>
                    <div className="col-span-4 text-right">
                      {isClaw ? (
                        <Link href="/trade" className="px-3 py-1.5 bg-success/10 text-success text-xs font-medium rounded-lg hover:bg-success/20 transition-colors">
                          Trade
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="px-3 py-1.5 bg-accent/30 text-white/50 text-xs font-bold rounded-lg cursor-not-allowed"
                          title="V2 deployment coming soon"
                        >
                          Deploy — Soon
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Still minting */}
      {minting.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">Still Minting</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface text-text-secondary text-xs font-medium border-b border-border uppercase tracking-wider">
              <div className="col-span-2">Tick</div>
              <div className="col-span-3">Progress</div>
              <div className="col-span-2 text-right">Minted</div>
              <div className="col-span-2 text-right">Max</div>
              <div className="col-span-2 text-right">Holders</div>
              <div className="col-span-1 text-right">Limit</div>
            </div>

            <div className="divide-y divide-border">
              {minting.map((token) => {
                const progress = Number(token.currentSupply) / Number(token.maxSupply) * 100

                return (
                  <Link key={token.tick} href={`/tokens/${token.tick}`}
                    className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-surface/60 transition-colors">
                    <div className="col-span-2 font-mono font-medium text-accent">
                      ${token.tick}
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                      <span className="text-xs text-text-secondary font-mono w-12 text-right">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm">
                      {formatAmount(token.currentSupply)}
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm text-text-secondary">
                      {formatAmount(token.maxSupply)}
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm">
                      {formatAmount(token.holders)}
                    </div>
                    <div className="col-span-1 text-right font-mono text-sm text-text-secondary">
                      {formatAmount(token.mintLimit)}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Open source */}
      <div className="border border-border rounded-lg p-5 bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Open Source Contracts</h3>
            <p className="text-sm text-text-secondary mt-1">
              V2 contracts (FactoryV2, ClaimManagerV2, MBC20TokenV2) are fully auditable on GitHub.
            </p>
          </div>
          <a href="https://github.com/floflo777/mbc20" target="_blank" rel="noopener"
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors flex-shrink-0">
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  )
}
