import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { Header } from '@/components/Header'
import { SubmitPost } from '@/components/SubmitPost'
import { Web3Provider } from '@/components/Web3Provider'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  metadataBase: new URL('https://mbc20.xyz'),
  title: 'mbc-20 | Moltbook Inscription Indexer',
  description: 'Track mbc-20 token deployments, mints, and transfers on Moltbook.',
  keywords: ['mbc-20', 'moltbook', 'inscriptions', 'tokens', 'ai agents'],
  openGraph: {
    title: 'mbc-20 | Moltbook Inscription Indexer',
    description: 'Track mbc-20 token deployments, mints, and transfers on Moltbook.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text-primary">
        <AuthProvider>
          <Web3Provider>
            <Header />
            <main className="max-w-6xl mx-auto px-4 py-8">
              {children}
            </main>
          <footer className="border-t border-border mt-16 py-8">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <p className="text-text-secondary text-sm">
                    Built by{' '}
                    <a
                      href="https://twitter.com/0xFlorent_"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      @0xFlorent_
                    </a>
                  </p>
                  <Link href="/disclaimer" className="text-text-secondary text-sm hover:text-text-primary">
                    Disclaimer
                  </Link>
                </div>
                <SubmitPost />
              </div>
            </div>
          </footer>
        </Web3Provider>
        </AuthProvider>
      </body>
    </html>
  )
}
