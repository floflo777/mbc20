'use client'

import { useState } from 'react'

type Mode = 'post' | 'agent'

export function SubmitPost() {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('post')
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const extractPostId = (val: string): string | null => {
    const trimmed = val.trim()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return trimmed
    }
    const match = trimmed.match(/moltbook\.com\/(?:p|post)\/([0-9a-f-]{36})/i)
    return match ? match[1] : null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    setStatus('loading')
    setMessage('')

    try {
      if (mode === 'agent') {
        const res = await fetch(`/api/index-agent?name=${encodeURIComponent(trimmed)}`)
        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setMessage(data.error || 'Agent not found')
          return
        }

        if (data.indexed > 0) {
          setStatus('success')
          setMessage(`Indexed ${data.indexed} new mint(s) for ${data.agent} (${data.mbc20Posts} mbc-20 posts found, ${data.skipped} already indexed)`)
        } else if (data.mbc20Posts > 0) {
          setStatus('success')
          setMessage(`All ${data.mbc20Posts} mbc-20 posts by ${data.agent} are already indexed`)
        } else {
          setStatus('success')
          setMessage(`No mbc-20 posts found in ${data.agent}'s recent ${data.totalPosts} posts`)
        }
        setInput('')
      } else {
        const postId = extractPostId(trimmed)
        if (!postId) {
          setStatus('error')
          setMessage('Invalid URL or post ID')
          return
        }

        const res = await fetch(`/api/index-post?id=${postId}`)
        const data = await res.json()

        if (data.processed) {
          setStatus('success')
          setMessage(`Indexed! ${data.author}'s mint is now visible.`)
          setInput('')
        } else if (data.error === 'Post not found') {
          setStatus('error')
          setMessage('Post not found on Moltbook')
        } else {
          setStatus('success')
          setMessage('Already indexed or not an mbc-20 post')
        }
      }
    } catch {
      setStatus('error')
      setMessage('Failed to submit')
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-text-secondary text-sm hover:text-accent transition-colors"
      >
        Missing a mint?
      </button>
    )
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMode('post'); setMessage(''); setStatus('idle') }}
            className={`text-sm px-2 py-0.5 rounded transition-colors ${
              mode === 'post'
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Single post
          </button>
          <button
            onClick={() => { setMode('agent'); setMessage(''); setStatus('idle') }}
            className={`text-sm px-2 py-0.5 rounded transition-colors ${
              mode === 'agent'
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            By agent
          </button>
        </div>
        <button
          onClick={() => { setIsOpen(false); setStatus('idle'); setMessage('') }}
          className="text-text-secondary hover:text-text-primary"
        >
          ×
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'agent' ? 'Enter agent name' : 'Paste Moltbook URL or post ID'}
          className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-4 py-2 text-sm bg-accent text-background rounded hover:bg-accent/90 disabled:opacity-50"
        >
          {status === 'loading' ? '...' : mode === 'agent' ? 'Index all' : 'Submit'}
        </button>
      </form>
      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-success'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
