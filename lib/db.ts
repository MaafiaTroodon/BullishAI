/**
 * DEPRECATED: This file is kept only for better-auth compatibility
 * All portfolio/wallet data now uses lib/db-sql.ts (direct Neon SQL)
 * 
 * Prisma is still required for:
 * - better-auth adapter (lib/auth.ts)
 * - User session management
 * 
 * Portfolio/wallet operations use pg (node-postgres) directly
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Ensure Prisma Client is properly initialized (for auth only)
let db: PrismaClient

if (globalForPrisma.prisma) {
  db = globalForPrisma.prisma
} else {
  db = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = db
  }
}

export { db }

