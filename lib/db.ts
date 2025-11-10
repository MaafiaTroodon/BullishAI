import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Ensure Prisma Client is properly initialized
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

