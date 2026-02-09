'use client'

import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="px-2 py-1 text-xs font-medium bg-border hover:bg-text-secondary/20 rounded transition-colors"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
