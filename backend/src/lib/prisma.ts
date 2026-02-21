import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasourceUrl: config.DATABASE_URL,
    log:
      config.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : config.NODE_ENV === 'test'
          ? [{ emit: 'stdout', level: 'error' }]
          : [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
  });

  client.$connect().catch((err: unknown) => {
    console.error('[Prisma] Failed to connect to database:', err);
    process.exit(1);
  });

  return client;
}

/**
 * Singleton PrismaClient instance.
 *
 * In development, the client is stored on globalThis to survive hot-reloads
 * via tsx watch without creating multiple database connections.
 * In production, a single instance is created and reused.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma when the process shuts down.
 */
async function shutdown(): Promise<void> {
  console.log('[Prisma] Disconnecting client...');
  await prisma.$disconnect();
  console.log('[Prisma] Disconnected.');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default prisma;
