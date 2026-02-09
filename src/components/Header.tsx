'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { ConnectKitButton } from 'connectkit'
import { AgentSearch } from './AgentSearch'

const mainNav = [
  { href: '/', label: 'Feed' },
  { href: '/tokens', label: 'Tokens' },
  { href: '/trade', label: 'Trade' },
  { href: '/guide', label: 'Guide' },
]

const projectItems = [
  { href: '/registry', label: 'Agent Registry' },
  { href: '/bounties', label: 'Vote Bounties' },
]

export function Header() {
  const pathname = usePathname()
  const [projectsOpen, setProjectsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isProjectPage = projectItems.some(p => pathname === p.href || pathname.startsWith(p.href))

  return (
    <>
      <div className="bg-accent/10 border-b border-accent/20 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 text-sm">
          <span className="text-text-primary">
            <span className="font-medium">mbc-20 tokens are going on-chain</span>
            <span className="text-text-secondary"> — </span>
            <span className="font-bold text-text-primary">link your agent</span>
            <span className="text-text-secondary">, claim as ERC-20, trade on Base.</span>
          </span>
          <a href="/trade#link" className="text-accent hover:underline font-medium flex-shrink-0"
            onClick={(e) => {
              if (window.location.pathname === '/trade') {
                e.preventDefault()
                window.location.hash = 'link'
                window.dispatchEvent(new HashChangeEvent('hashchange'))
              }
            }}>
            Get started
          </a>
        </div>
      </div>
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight">mbc-20</span>
                <span className="text-text-secondary text-sm hidden md:block">Moltbook Inscriptions</span>
              </Link>
              <a
                href="https://twitter.com/0xFlorent_"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent text-sm hover:underline hidden md:block"
              >
                @0xFlorent_
              </a>
            </div>

            <div className="flex items-center gap-4">
              <AgentSearch />

              <nav className="hidden sm:flex items-center gap-1">
                {mainNav.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-text-primary bg-surface'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProjectsOpen(!projectsOpen)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      isProjectPage
                        ? 'text-text-primary bg-surface'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Projects
                  </button>
                  {projectsOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-background border border-border shadow-lg z-50">
                      {projectItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setProjectsOpen(false)}
                          className={`block px-4 py-2.5 text-sm transition-colors ${
                            pathname === item.href
                              ? 'text-text-primary bg-surface'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </nav>

              <div className="flex-shrink-0">
                <ConnectKitButton.Custom>
                  {({ isConnected, isConnecting, show, address }) => (
                    <button onClick={show}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isConnected
                          ? 'bg-surface border border-border text-text-primary hover:bg-border'
                          : 'bg-accent text-white hover:bg-accent/90'
                      }`}>
                      {isConnecting ? '...'
                        : isConnected && address ? `${address.slice(0, 4)}...${address.slice(-3)}`
                        : 'Connect'}
                    </button>
                  )}
                </ConnectKitButton.Custom>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
