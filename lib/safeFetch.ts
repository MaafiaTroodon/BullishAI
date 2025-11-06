/**
 * Safe fetch wrapper that ensures:
 * - Uses absolute URLs (never relative paths that could resolve to page routes)
 * - Checks response status before parsing
 * - Validates Content-Type header
 * - Provides descriptive error messages
 */

export async function safeFetch(path: string, options?: RequestInit): Promise<Response> {
  // Build absolute URL
  let absoluteUrl: string
  if (path.startsWith('http://') || path.startsWith('https://')) {
    absoluteUrl = path
  } else {
    // Use NEXT_PUBLIC_API_BASE_URL if set, otherwise use window.location.origin
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    absoluteUrl = new URL(path, baseUrl).toString()
  }

  const res = await fetch(absoluteUrl, { ...options, cache: 'no-store' })
  
  // Check response status
  if (!res.ok) {
    const statusText = res.statusText || 'Unknown error'
    throw new Error(`API error ${res.status} ${statusText} from ${absoluteUrl}`)
  }

  // Check Content-Type header
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    // Read text once to log it
    const text = await res.text()
    const preview = text.substring(0, 200)
    console.error(`Non-JSON response from ${absoluteUrl}:`, preview)
    throw new Error(`Non-JSON response from API: ${preview}`)
  }

  return res
}

/**
 * Safe JSON fetcher for use with SWR
 * Returns null on error (doesn't throw) so SWR can handle it gracefully
 */
export async function safeJsonFetcher(url: string): Promise<any> {
  try {
    const res = await safeFetch(url)
    return res.json()
  } catch (error: any) {
    console.error('Fetcher error:', error.message || error)
    return null
  }
}

