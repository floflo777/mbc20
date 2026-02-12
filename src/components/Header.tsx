'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectKitButton } from 'connectkit'
import { AgentSearch } from './AgentSearch'

const navItems = [
  { href: '/', label: 'Feed' },
  { href: '/tokens', label: 'Tokens' },
  { href: '/deploy', label: 'Deploy' },
  { href: '/trade', label: 'Trade' },
  { href: '/link', label: 'Link' },
  { href: '/guide', label: 'Guide' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl font-bold tracking-tight">mbc-20</span>
          </Link>

          {/* Nav + Search + GitHub + Connect */}
          <div className="flex items-center gap-1">
            <nav className="flex items-center gap-1 mr-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                      isActive
                        ? 'text-text-primary bg-surface'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="mr-3">
              <AgentSearch />
            </div>

            <a
              href="https://github.com/floflo777/mbc20"
              target="_blank"
              rel="noopener noreferrer"
              className="mr-2 p-1.5 rounded text-text-secondary hover:text-text-primary transition-colors"
              title="GitHub"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>

            <ConnectKitButton.Custom>
              {({ isConnected, isConnecting, show, address }) => (
                <button
                  onClick={show}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isConnected
                      ? 'bg-surface border border-border text-text-primary hover:bg-border'
                      : 'bg-accent text-white hover:bg-accent/90'
                  }`}
                >
                  {isConnecting
                    ? '...'
                    : isConnected && address
                      ? `${address.slice(0, 4)}...${address.slice(-3)}`
                      : 'Connect'}
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        </div>
      </div>
    </header>
  )
}
