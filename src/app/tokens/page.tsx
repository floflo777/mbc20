import { prisma } from "@/lib/db"
import { formatAmount, formatPercent } from "@/lib/format"
import Link from "next/link"

export const dynamic = "force-dynamic"

const TOKENS_PER_PAGE = 10
const FEATURED_TICK = "CLAW"

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
        where: { tick: token.tick, op: "mint" },
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

  return {
    tokens: paginated,
    totalCount,
    totalPages,
  }
}

export default async function TokensPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const params = searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1)
  const { tokens, totalCount, totalPages } = await getTokens(page)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tokens</h1>
        <span className="text-text-secondary">{totalCount} deployed</span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface text-text-secondary text-sm font-medium border-b border-border">
          <div className="col-span-2">Tick</div>
          <div className="col-span-3">Progress</div>
          <div className="col-span-2 text-right">Supply</div>
          <div className="col-span-2 text-right">Max</div>
          <div className="col-span-2 text-right">Holders</div>
          <div className="col-span-1 text-right">Mints</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {tokens.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              No tokens deployed yet.
            </div>
          ) : (
            tokens.map((token) => {
              const progress =
                (Number(token.currentSupply) / Number(token.maxSupply)) * 100
              const mintCount = token._count.operations
              const holderCount = token._count.balances
              const isFeatured = token.tick === FEATURED_TICK

              return (
                <Link
                  key={token.tick}
                  href={`/tokens/${token.tick}`}
                  className={`grid grid-cols-12 gap-4 px-4 py-4 hover:bg-surface transition-colors ${
                    isFeatured ? "bg-yellow-500/5" : ""
                  }`}
                >
                  <div className="col-span-2 font-mono font-medium text-accent flex items-center gap-1.5">
                    {token.tick}
                    {isFeatured && (
                      <svg
                        className="w-4 h-4 text-yellow-500 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
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
        <div className="flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/tokens?page=${page - 1}`}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface transition-colors"
              >
                Previous
              </Link>
            )}
            {renderPageNumbers(page, totalPages)}
            {page < totalPages && (
              <Link
                href={`/tokens?page=${page + 1}`}
                className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function renderPageNumbers(current: number, total: number) {
  const pages: (number | "...")[] = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push("...")
    for (
      let i = Math.max(2, current - 1);
      i <= Math.min(total - 1, current + 1);
      i++
    ) {
      pages.push(i)
    }
    if (current < total - 2) pages.push("...")
    pages.push(total)
  }

  return pages.map((p, i) =>
    p === "..." ? (
      <span key={`dots-${i}`} className="px-2 text-text-secondary">
        ...
      </span>
    ) : (
      <Link
        key={p}
        href={`/tokens?page=${p}`}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          p === current
            ? "bg-accent text-white font-medium"
            : "border border-border hover:bg-surface"
        }`}
      >
        {p}
      </Link>
    )
  )
}

function ProgressBar({ value }: { value: number }) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary font-mono w-12 text-right">
        {formatPercent(clampedValue, 0)}
      </span>
    </div>
  )
}
