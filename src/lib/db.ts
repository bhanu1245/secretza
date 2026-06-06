/**
 * Prisma Database Client
 *
 * Production connection pooling notes:
 * - SQLite: No connection pooling needed (file-based, single-writer).
 * - PostgreSQL: Use a connection pooler (e.g., PgBouncer, Supabase pooler, or
 *   @prisma/pg-worker) in front of Prisma. Append ?pgbouncer=true to your
 *   DATABASE_URL when using PgBouncer in transaction mode. Set
 *   connection_limit in the pooler config to control concurrency.
 * - The PrismaClient itself maintains an internal connection pool whose size
 *   is governed by the database's max_connections setting.
 */
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production';

  const enableQueryLog = process.env.PRISMA_LOG_QUERIES === 'true';

  return new PrismaClient({
    log: isProduction || !enableQueryLog
      ? ['error', 'warn']
      : ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
