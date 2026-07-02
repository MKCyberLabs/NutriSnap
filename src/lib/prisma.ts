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
      url: process.env.DATABASE_URL || "postgresql://nutrisnap:nutrisnap_pass@db:5432/nutrisnap"
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
