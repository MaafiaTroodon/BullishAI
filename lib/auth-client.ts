"use client"

import { createAuthClient } from "better-auth/react"

// Get base URL - prioritize environment variable, then window.location, then fallback
function getBaseURL(): string {
  if (typeof window !== 'undefined') {
    // Use window.location.origin in browser
    return window.location.origin
  }
  // Server-side: use environment variable or fallback
  return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  basePath: "/api/auth",
})

// Type helper for session
export type Session = Awaited<ReturnType<typeof authClient.getSession>>

