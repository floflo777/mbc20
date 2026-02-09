'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AgentSearch() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      router.push(`/agents/${encodeURIComponent(trimmed)}`)
      setQuery('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search agent..."
        className="w-32 sm:w-40 px-3 py-1.5 text-sm bg-surface border border-border rounded-l focus:outline-none focus:border-accent placeholder:text-text-secondary"
      />
      <button
        type="submit"
        className="px-3 py-1.5 text-sm bg-accent text-background font-medium rounded-r hover:bg-accent/90 transition-colors"
      >
        Go
      </button>
    </form>
  )
}
