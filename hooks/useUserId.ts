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
        setUserId((session as any)?.user?.id || null)
      } catch (error) {
        // Silently fail - user is not logged in
        setUserId(null)
      }
    }
    
    // Initial fetch
    fetchUserId()
    
    // Only poll if we're in development or if user is logged in
    // In production, rely on authClient.useSession() which handles updates better
    if (process.env.NODE_ENV === 'development') {
      // Listen for auth changes - reduce polling to every 10 seconds to avoid excessive requests
      const interval = setInterval(fetchUserId, 10000)
      return () => clearInterval(interval)
    }
    
    // In production, don't poll - let useSession handle it
    // Just fetch once on mount
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

