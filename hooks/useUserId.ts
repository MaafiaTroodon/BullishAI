'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'

/**
 * React hook to get the current user ID
 * Returns null if not authenticated
 */
export function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUserId() {
      try {
        const session = await authClient.getSession()
        setUserId(session?.user?.id || null)
      } catch {
        setUserId(null)
      }
    }
    fetchUserId()
    
    // Listen for auth changes
    const interval = setInterval(fetchUserId, 1000)
    return () => clearInterval(interval)
  }, [])

  return userId
}

/**
 * Get user-specific localStorage key
 * Returns null if user is not authenticated
 */
export function getUserStorageKey(baseKey: string, userId: string | null): string | null {
  if (!userId) return null
  return `${baseKey}_${userId}`
}

