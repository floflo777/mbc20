export const metadata = {
  title: 'Disclaimer | mbc-20',
  description: 'Terms of use and disclaimer for the mbc-20 protocol.',
}

export default function DisclaimerPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Disclaimer & Terms of Use</h1>
        <p className="text-text-secondary mt-2">Last updated: February 2025</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Protocol Nature</h2>
        <p className="text-text-secondary">
          mbc-20 is an experimental inscription protocol built on Moltbook. The on-chain marketplace
          operates as a set of immutable smart contracts deployed on Base (L2). There is no company,
          no admin, and no central operator behind the protocol.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">No Financial Advice</h2>
        <p className="text-text-secondary">
          Nothing on this website constitutes financial, investment, legal, or tax advice.
          mbc-20 tokens have no guaranteed value. Do not invest money you cannot afford to lose.
          You are solely responsible for your own decisions.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Immutable Contracts</h2>
        <p className="text-text-secondary">
          The smart contracts (ClaimManager, MBC20Factory, Marketplace) are deployed without any
          admin keys, pause functionality, or upgrade mechanism. Once deployed, they cannot be
          modified, paused, or shut down by anyone. This is by design for trustlessness, but it
          also means bugs cannot be patched after deployment.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">No Custody</h2>
        <p className="text-text-secondary">
          This website is a frontend interface to on-chain contracts. We never hold, custody, or
          control your tokens or funds. All transactions are executed directly between your wallet
          and the smart contracts. You retain full control of your assets at all times.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Risks</h2>
        <ul className="space-y-2 text-text-secondary list-disc list-inside">
          <li>Smart contracts may contain undiscovered bugs despite testing</li>
          <li>Token prices can go to zero — there is no price floor or guarantee</li>
          <li>Blockchain transactions are irreversible</li>
          <li>Gas fees are required for all on-chain operations</li>
          <li>The indexer that tracks mbc-20 inscriptions may have downtime or errors</li>
          <li>Moltbook (the underlying platform) is a third-party service outside our control</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Protocol Fees</h2>
        <p className="text-text-secondary">
          A small fee in ETH is charged on each token claim. A 1% fee is charged on each
          marketplace trade in USDC. These fees are sent to a hardcoded treasury address in the
          smart contracts and cannot be changed.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Tax Obligations</h2>
        <p className="text-text-secondary">
          Users are responsible for reporting and paying taxes on any gains from trading mbc-20
          tokens in accordance with their local jurisdiction. In France, cryptocurrency-to-fiat
          conversions are subject to a 30% flat tax (form 2086) and crypto accounts must be
          declared on form 3916-bis.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Limitation of Liability</h2>
        <p className="text-text-secondary">
          This protocol and website are provided &quot;as is&quot; without warranty of any kind.
          The developers shall not be liable for any loss of funds, data, or other damages
          resulting from the use of this protocol. Use at your own risk.
        </p>
      </section>

      <div className="border border-accent/50 bg-accent/5 rounded-lg p-4">
        <p className="text-sm text-text-secondary">
          By using this website and interacting with the mbc-20 smart contracts, you acknowledge
          that you have read, understood, and agree to these terms.
        </p>
      </div>
    </div>
  )
}
