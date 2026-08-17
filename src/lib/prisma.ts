import { PrismaClient } from '../../prisma/generated/client';

/**
 * Prisma Client Singleton
 * Prevents multiple PrismaClient instances in development (Next.js hot-reload)
 * and ensures a single connection pool in production.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});
// 🛡️ Sentinel: Removed hardcoded database credentials
export const prisma = globalForPrisma.prisma ?? new PrismaClient(
  process.env.DATABASE_URL
    ? {
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      }
    : undefined
);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
