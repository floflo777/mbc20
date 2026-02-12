import Link from 'next/link'

export default function DeployPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Deploy Tokens On-Chain</h1>
        <p className="text-text-secondary">
          Deploy any fully-minted mbc-20 token on-chain. Burn $CLAW to deploy and earn 1% of all trading fees.
        </p>
      </div>

      {/* Coming Soon Overlay */}
      <div className="relative">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="bg-surface border border-border rounded-lg px-8 py-6 text-center shadow-lg">
            <div className="text-4xl mb-3">&#x1F680;</div>
            <h2 className="text-xl font-bold mb-2">Coming Soon</h2>
            <p className="text-text-secondary text-sm max-w-sm">
              V2 permissionless deployment is being finalized. Smart contracts are{' '}
              <a href="https://github.com/floflo777/mbc20-contracts" target="_blank" rel="noopener" className="text-accent hover:underline">open source</a>{' '}
              and verified on Etherscan.
            </p>
          </div>
        </div>

        {/* Blurred preview content */}
        <div className="pointer-events-none select-none space-y-6 opacity-40">
          {/* Wallet info preview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-sm text-text-secondary">Your $CLAW Balance</div>
              <div className="text-xl font-mono font-bold">---</div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-sm text-text-secondary">Deployment Cost</div>
              <div className="text-xl font-mono font-bold">1,000 CLAW</div>
              <div className="text-xs text-text-secondary mt-1">Burned permanently</div>
            </div>
          </div>

          {/* Token list preview */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface text-text-secondary text-xs font-medium border-b border-border uppercase tracking-wider">
              <div className="col-span-2">Tick</div>
              <div className="col-span-2 text-right">Supply</div>
              <div className="col-span-2 text-right">Holders</div>
              <div className="col-span-3 text-center">Status</div>
              <div className="col-span-3 text-right">Action</div>
            </div>
            <div className="divide-y divide-border">
              {['CLAW', 'MBC20', 'MOLTPUNK'].map((tick) => (
                <div key={tick} className="grid grid-cols-12 gap-4 px-4 py-4 items-center">
                  <div className="col-span-2 font-mono font-medium text-accent">${tick}</div>
                  <div className="col-span-2 text-right font-mono text-sm">21,000,000</div>
                  <div className="col-span-2 text-right font-mono text-sm">---</div>
                  <div className="col-span-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface text-text-secondary text-xs font-medium">
                      Off-chain
                    </span>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="px-3 py-1.5 bg-accent/50 text-white text-xs font-bold rounded-lg">Deploy</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-surface border border-border rounded-lg p-6 space-y-3">
            <h3 className="font-medium">How permissionless deployment works</h3>
            <ul className="text-sm text-text-secondary space-y-2">
              <li>1. Choose a fully-minted mbc-20 token to deploy on-chain</li>
              <li>2. Burn CLAW to pay the deployment cost</li>
              <li>3. The token is deployed as an ERC-20 on Base</li>
              <li>4. As the deployer, you earn 1% of all trading fees forever</li>
              <li>5. Airdrop tokens to all inscription holders</li>
              <li>6. Set the marketplace as a pool, then renounce ownership</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
