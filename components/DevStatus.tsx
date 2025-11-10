'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export function DevStatus() {
  const [status, setStatus] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return

    // Only fetch in development, and handle 404 gracefully
    const controller = new AbortController()
    fetch('/api/_debug', { signal: controller.signal })
      .then(r => {
        if (!r.ok) {
          // API doesn't exist or not available, don't show status
          setShow(false)
          return null
        }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setStatus(data)
        // Show if any env is false or provider is fail
        const hasIssues = 
          Object.values(data.env || {}).some(v => !v) ||
          Object.values(data.providers || {}).some(v => v === 'fail')
        setShow(hasIssues)
      })
      .catch((err) => {
        // Silently fail - don't show status if API doesn't exist or request was aborted
        if (err.name !== 'AbortError') {
          // Only log non-abort errors
          setShow(false)
        }
      })
    
    return () => {
      controller.abort()
    }
  }, [])

  if (!show || !status) return null

  return (
    <div className="bg-yellow-900/20 border-b border-yellow-600 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-2 text-yellow-400 text-sm">
        <AlertTriangle className="h-4 w-4" />
        <span>Dev: Missing env vars or failed providers - Check .env.local</span>
      </div>
    </div>
  )
}

