import { PrismaClient } from '@prisma/client'

// Versioned global cache. Bump PRISMA_CACHE_VERSION whenever the Prisma
// schema gains new models mid-session — this releases the stale
// PrismaClient instance held in globalThis so a fresh one (with the new
// model accessors) is created. Without this, a long-running dev server
// keeps the OLD client in memory even after `prisma generate` runs.
const PRISMA_CACHE_VERSION = 'v2-commcloud'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaCacheVersion?: string
}

if (
  globalForPrisma.prisma &&
  globalForPrisma.prismaCacheVersion !== PRISMA_CACHE_VERSION
) {
  void globalForPrisma.prisma.$disconnect().catch(() => {})
  globalForPrisma.prisma = undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? [] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.prismaCacheVersion = PRISMA_CACHE_VERSION
}
