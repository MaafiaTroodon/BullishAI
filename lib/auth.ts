import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { PrismaClient } from "@prisma/client"

// Use singleton pattern for Prisma in serverless environments
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Determine baseURL dynamically based on environment
function getBaseURL(): string {
  // Priority: explicit env var > Netlify/Vercel auto-detection > default
  if (process.env.BETTER_AUTH_URL) {
    const url = process.env.BETTER_AUTH_URL
    if (process.env.NODE_ENV === 'production') {
      console.log('[Auth] Using BETTER_AUTH_URL:', url)
    }
    return url
  }
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    const url = process.env.NEXT_PUBLIC_BETTER_AUTH_URL
    if (process.env.NODE_ENV === 'production') {
      console.log('[Auth] Using NEXT_PUBLIC_BETTER_AUTH_URL:', url)
    }
    return url
  }
  // For production on Netlify, use the deployment URL
  if (process.env.NETLIFY) {
    const netlifyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
    if (netlifyUrl) {
      const url = netlifyUrl.startsWith('http') ? netlifyUrl : `https://${netlifyUrl}`
      if (process.env.NODE_ENV === 'production') {
        console.log('[Auth] Using Netlify auto-detected URL:', url)
      }
      return url
    }
  }
  // For Vercel
  if (process.env.VERCEL_URL) {
    const url = `https://${process.env.VERCEL_URL}`
    if (process.env.NODE_ENV === 'production') {
      console.log('[Auth] Using Vercel auto-detected URL:', url)
    }
    return url
  }
  // Default to localhost for development
  const defaultUrl = "http://localhost:3000"
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Auth] WARNING: Using default localhost URL in production! Set BETTER_AUTH_URL environment variable.')
  }
  return defaultUrl
}

const baseURL = getBaseURL()

// Log the final baseURL in production for debugging
if (process.env.NODE_ENV === 'production') {
  console.log('[Auth] Final baseURL:', baseURL)
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  secret: process.env.BETTER_AUTH_SECRET || "change-me-in-production",
  baseURL,
  basePath: "/api/auth",
})

export type Session = typeof auth.$Infer.Session

