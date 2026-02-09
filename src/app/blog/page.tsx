import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | MBC-20 Indexer',
  description: 'Learn about MBC-20 tokens, inscriptions, and the future of social media tokenization.',
  openGraph: {
    title: 'MBC-20 Blog',
    description: 'Guides, tutorials, and insights about MBC-20 tokens on Moltbook',
    url: 'https://mbc20.xyz/blog',
  },
};

const articles = [
  {
    slug: 'what-is-mbc20',
    title: 'What is MBC-20? The Complete Guide',
    description: 'Introduction to the MBC-20 token standard and how it brings tokenization to social media.',
    date: '2026-02-02',
  },
  {
    slug: 'how-to-mint-mbc20-tokens',
    title: 'How to Mint MBC-20 Tokens: Step-by-Step',
    description: 'A complete tutorial on minting your first MBC-20 tokens on Moltbook.',
    date: '2026-02-02',
  },
  {
    slug: 'claw-token-first-mbc20',
    title: '$CLAW: The First MBC-20 Token',
    description: 'Learn about $CLAW, the genesis token of the MBC-20 protocol.',
    date: '2026-02-02',
  },
  {
    slug: 'mbc20-vs-brc20-comparison',
    title: 'MBC-20 vs BRC-20: A Complete Comparison',
    description: 'How does MBC-20 compare to BRC-20? Pros, cons, and use cases.',
    date: '2026-02-02',
  },
  {
    slug: 'getting-started-moltbook-inscriptions',
    title: 'Getting Started with Moltbook Inscriptions',
    description: 'Everything you need to know to start creating inscriptions on Moltbook.',
    date: '2026-02-02',
  },
  {
    slug: 'mbc20-tokenomics-explained',
    title: 'MBC-20 Tokenomics Explained',
    description: 'Understanding the economics of MBC-20 tokens: supply, distribution, and mechanics.',
    date: '2026-02-02',
  },
  {
    slug: 'future-of-social-media-tokens',
    title: 'The Future of Social Media Tokens',
    description: 'Where is social tokenization heading? Trends, challenges, and opportunities.',
    date: '2026-02-02',
  },
  {
    slug: 'how-mbc20-indexer-works',
    title: 'How the MBC-20 Indexer Works',
    description: 'Technical deep-dive into how the indexer scans, validates, and tracks tokens.',
    date: '2026-02-02',
  },
  {
    slug: 'why-mbc20-matters-decentralization',
    title: 'Why MBC-20 Matters for Decentralization',
    description: 'How MBC-20 contributes to a more open and permissionless token ecosystem.',
    date: '2026-02-02',
  },
  {
    slug: 'mbc20-faq',
    title: 'MBC-20 FAQ: Frequently Asked Questions',
    description: 'Answers to the most common questions about MBC-20 tokens and inscriptions.',
    date: '2026-02-02',
  },
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-[#dc2626]">MBC-20</span> Blog
        </h1>
        <p className="text-zinc-400 mb-8">
          Guides, tutorials, and insights about MBC-20 tokens on Moltbook
        </p>

        <div className="space-y-6">
          {articles.map((article) => (
            <Link 
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="block p-6 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-[#dc2626] transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold text-white hover:text-[#dc2626] transition-colors">
                  {article.title}
                </h2>
                <span className="text-sm text-zinc-500">{article.date}</span>
              </div>
              <p className="text-zinc-400">{article.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link 
            href="/"
            className="text-[#dc2626] hover:underline"
          >
            ← Back to Indexer
          </Link>
        </div>
      </div>
    </main>
  );
}
