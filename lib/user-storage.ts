/**
 * User-specific localStorage utilities
 * Ensures each user has isolated storage to prevent multi-tenancy breaches
 */

/**
 * Get the current user ID from the session (client-side)
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { authClient } = await import('@/lib/auth-client')
    const session = await authClient.getSession()
    return session?.user?.id || null
  } catch {
    return null
  }
}

/**
 * Get user-specific localStorage key
 * Returns null if user is not authenticated (prevents storing data for unauthenticated users)
 */
export async function getUserStorageKey(baseKey: string): Promise<string | null> {
  const userId = await getCurrentUserId()
  if (!userId) {
    // Don't use localStorage for unauthenticated users
    return null
  }
  return `${baseKey}_${userId}`
}

/**
 * Get user-specific localStorage item
 * Returns null if user is not authenticated or item doesn't exist
 */
export async function getUserStorageItem<T = any>(baseKey: string): Promise<T | null> {
  const storageKey = await getUserStorageKey(baseKey)
  if (!storageKey) return null
  
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Set user-specific localStorage item
 * Only works if user is authenticated
 */
export async function setUserStorageItem<T = any>(baseKey: string, value: T): Promise<boolean> {
  const storageKey = await getUserStorageKey(baseKey)
  if (!storageKey) return false
  
  try {
    localStorage.setItem(storageKey, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Remove user-specific localStorage item
 */
export async function removeUserStorageItem(baseKey: string): Promise<boolean> {
  const storageKey = await getUserStorageKey(baseKey)
  if (!storageKey) return false
  
  try {
    localStorage.removeItem(storageKey)
    return true
  } catch {
    return false
  }
}

/**
 * React hook for user-specific storage (for use in components)
 * Returns a function that gets the user-specific key synchronously if userId is provided
 */
export function useUserStorageKey(baseKey: string, userId: string | null | undefined): string | null {
  if (!userId) return null
  return `${baseKey}_${userId}`
}

