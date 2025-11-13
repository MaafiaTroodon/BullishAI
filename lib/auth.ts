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
    return process.env.BETTER_AUTH_URL
  }
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    return process.env.NEXT_PUBLIC_BETTER_AUTH_URL
  }
  // For production on Netlify, use the deployment URL
  if (process.env.NETLIFY) {
    const netlifyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
    if (netlifyUrl) {
      return netlifyUrl.startsWith('http') ? netlifyUrl : `https://${netlifyUrl}`
    }
  }
  // For Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Default to localhost for development
  return "http://localhost:3000"
}

const baseURL = getBaseURL()

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

