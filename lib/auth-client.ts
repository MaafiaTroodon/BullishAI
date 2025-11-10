"use client"

import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' 
    ? window.location.origin 
    : (process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"),
  basePath: "/api/auth",
})

// Type helper for session
export type Session = Awaited<ReturnType<typeof authClient.getSession>>

