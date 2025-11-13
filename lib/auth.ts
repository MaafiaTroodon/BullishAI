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
  // Priority: explicit env var > NEXT_PUBLIC (for client-side) > default
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL
  }
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    return process.env.NEXT_PUBLIC_BETTER_AUTH_URL
  }
  // For production on Netlify, use the deployment URL
  if (process.env.NETLIFY || process.env.VERCEL_URL) {
    const netlifyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
    if (netlifyUrl) {
      return netlifyUrl
    }
    const vercelUrl = process.env.VERCEL_URL
    if (vercelUrl) {
      return `https://${vercelUrl}`
    }
  }
  // Default to localhost for development
  return "http://localhost:3000"
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
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  // Trust origins for production deployments
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3003",
    "https://bullishai.netlify.app",
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS 
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map(o => o.trim())
      : []
    ),
  ],
})

export type Session = typeof auth.$Infer.Session

