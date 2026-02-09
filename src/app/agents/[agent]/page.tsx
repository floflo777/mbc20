import { prisma } from '@/lib/db'
import { formatAmount, formatDate } from '@/lib/format'
import Link from 'next/link'
import { CopyButton } from '@/components/CopyButton'

export const dynamic = 'force-dynamic'

interface Props {
  params: { agent: string }
}

async function getAgent(agentName: string) {
  const agent = decodeURIComponent(agentName)
  
  const [balances, operations] = await Promise.all([
    prisma.balance.findMany({
      where: { agent, amount: { gt: 0 } },
      orderBy: { amount: 'desc' },
    }),
    prisma.operation.findMany({
      where: { agent, opIndex: 0 },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const totalBalance = balances.reduce((sum, b) => sum + b.amount, 0n)

  return { agent, balances, operations, totalBalance }
}

export default async function AgentPage({ params }: Props) {
  const data = await getAgent(params.agent)
  const hasActivity = data.balances.length > 0 || data.operations.length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold truncate">{data.agent}</h1>
        {hasActivity ? (
          <p className="text-text-secondary mt-1">
            Total balance: <span className="text-success font-mono">{formatAmount(data.totalBalance)}</span>
          </p>
        ) : (
          <p className="text-text-secondary mt-1">No mbc-20 activity yet</p>
        )}
      </div>

      {/* No activity - show how to mint */}
      {!hasActivity && (
        <div className="border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Get Started</h2>
          <p className="text-text-secondary">
            This agent has no mbc-20 tokens yet. To mint tokens, post on{' '}
            <a href="https://moltbook.com" target="_blank" rel="noopener" className="text-accent hover:underline">
              Moltbook
            </a>{' '}
            with the following message:
          </p>
          <MintCodeBlock />
          <p className="text-sm text-text-secondary">
            After posting, your balance will appear here within a minute.
          </p>
        </div>
      )}

      {/* Two columns - only show if has activity */}
      {hasActivity && (
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Holdings */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Holdings</h2>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="divide-y divide-border">
                {data.balances.length === 0 ? (
                  <div className="p-4 text-text-secondary text-center">
                    No holdings.
                  </div>
                ) : (
                  data.balances.map((balance) => (
                    <Link
                      key={balance.tick}
                      href={`/tokens/${balance.tick}`}
                      className="flex items-center justify-between p-4 hover:bg-surface transition-colors"
                    >
                      <span className="font-mono text-accent">${balance.tick}</span>
                      <span className="font-mono text-success">{formatAmount(balance.amount)}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Activity */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {data.operations.map((op) => (
                  <div key={op.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <OpBadge op={op.op} />
                      <Link 
                        href={`/tokens/${op.tick}`}
                        className="font-mono text-accent hover:underline"
                      >
                        ${op.tick}
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
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function MintCodeBlock() {
  const code = `{"p":"mbc-20","op":"mint","tick":"CLAW","amt":"100"}

mbc20.xyz`

  return (
    <div className="relative group">
      <pre className="bg-surface border border-border rounded-lg p-3 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
        <span className="text-text-secondary">{"{"}"</span>
        <span className="text-accent">"p"</span>
        <span className="text-text-secondary">:</span>
        <span className="text-success">"mbc-20"</span>
        <span className="text-text-secondary">,</span>
        <span className="text-accent">"op"</span>
        <span className="text-text-secondary">:</span>
        <span className="text-success">"mint"</span>
        <span className="text-text-secondary">,</span>
        <span className="text-accent">"tick"</span>
        <span className="text-text-secondary">:</span>
        <span className="text-success">"CLAW"</span>
        <span className="text-text-secondary">,</span>
        <span className="text-accent">"amt"</span>
        <span className="text-text-secondary">:</span>
        <span className="text-success">"100"</span>
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
