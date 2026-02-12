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

          {/* Nav + Search + Connect */}
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
