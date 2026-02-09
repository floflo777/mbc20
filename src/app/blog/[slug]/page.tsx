import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import fs from 'fs';
import path from 'path';

const articleMeta: Record<string, { title: string; description: string }> = {
  'what-is-mbc20': {
    title: 'What is MBC-20? The Complete Guide',
    description: 'Introduction to the MBC-20 token standard and how it brings tokenization to social media.',
  },
  'how-to-mint-mbc20-tokens': {
    title: 'How to Mint MBC-20 Tokens: Step-by-Step',
    description: 'A complete tutorial on minting your first MBC-20 tokens on Moltbook.',
  },
  'claw-token-first-mbc20': {
    title: '$CLAW: The First MBC-20 Token',
    description: 'Learn about $CLAW, the genesis token of the MBC-20 protocol.',
  },
  'mbc20-vs-brc20-comparison': {
    title: 'MBC-20 vs BRC-20: A Complete Comparison',
    description: 'How does MBC-20 compare to BRC-20? Pros, cons, and use cases.',
  },
  'getting-started-moltbook-inscriptions': {
    title: 'Getting Started with Moltbook Inscriptions',
    description: 'Everything you need to know to start creating inscriptions on Moltbook.',
  },
  'mbc20-tokenomics-explained': {
    title: 'MBC-20 Tokenomics Explained',
    description: 'Understanding the economics of MBC-20 tokens: supply, distribution, and mechanics.',
  },
  'future-of-social-media-tokens': {
    title: 'The Future of Social Media Tokens',
    description: 'Where is social tokenization heading? Trends, challenges, and opportunities.',
  },
  'how-mbc20-indexer-works': {
    title: 'How the MBC-20 Indexer Works',
    description: 'Technical deep-dive into how the indexer scans, validates, and tracks tokens.',
  },
  'why-mbc20-matters-decentralization': {
    title: 'Why MBC-20 Matters for Decentralization',
    description: 'How MBC-20 contributes to a more open and permissionless token ecosystem.',
  },
  'mbc20-faq': {
    title: 'MBC-20 FAQ: Frequently Asked Questions',
    description: 'Answers to the most common questions about MBC-20 tokens and inscriptions.',
  },
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = articleMeta[slug];
  
  if (!meta) {
    return { title: 'Article Not Found' };
  }

  return {
    title: `${meta.title} | MBC-20 Blog`,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://mbc20.xyz/blog/${slug}`,
      type: 'article',
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(articleMeta).map((slug) => ({ slug }));
}

function parseMarkdown(content: string): string {
  // Simple markdown to HTML conversion
  let html = content
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-zinc-800 p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1 rounded">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-8 mb-4 text-white">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-10 mb-4 text-[#dc2626]">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mb-6 text-white">$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#dc2626] hover:underline">$1</a>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => /^[-:]+$/.test(c.trim()))) {
        return ''; // Skip separator row
      }
      const isHeader = cells.every(c => c.trim().length > 0);
      const cellTag = 'td';
      return `<tr>${cells.map(c => `<${cellTag} class="border border-zinc-700 px-4 py-2">${c.trim()}</${cellTag}>`).join('')}</tr>`;
    })
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-zinc-700 my-8" />')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4 text-zinc-300">')
    // Checkmarks and X
    .replace(/✅/g, '<span class="text-green-500">✅</span>')
    .replace(/❌/g, '<span class="text-red-500">❌</span>');

  // Wrap in paragraph if not starting with tag
  if (!html.startsWith('<')) {
    html = `<p class="mb-4 text-zinc-300">${html}</p>`;
  }

  return html;
}

export default async function BlogArticle({ params }: Props) {
  const { slug } = await params;
  const meta = articleMeta[slug];
  
  if (!meta) {
    notFound();
  }

  // Read markdown file
  const filePath = path.join(process.cwd(), 'content', 'blog', `${slug}.md`);
  let content = '';
  
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    notFound();
  }

  const htmlContent = parseMarkdown(content);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <nav className="mb-8">
          <Link href="/blog" className="text-[#dc2626] hover:underline">
            ← Back to Blog
          </Link>
        </nav>

        <article 
          className="prose prose-invert prose-zinc max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        <div className="mt-12 pt-8 border-t border-zinc-800">
          <h3 className="text-lg font-semibold mb-4">Related Articles</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(articleMeta)
              .filter(([s]) => s !== slug)
              .slice(0, 3)
              .map(([s, m]) => (
                <Link 
                  key={s}
                  href={`/blog/${s}`}
                  className="px-3 py-1 bg-zinc-800 rounded text-sm hover:bg-[#dc2626] transition-colors"
                >
                  {m.title.split(':')[0]}
                </Link>
              ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="text-zinc-400 hover:text-white"
          >
            Explore MBC-20 Tokens →
          </Link>
        </div>
      </div>
    </main>
  );
}
