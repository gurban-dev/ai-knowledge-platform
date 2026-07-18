import { PrismaClient, Prisma } from '@prisma/client';

export interface PrismaClientOptions {
  databaseUrl?: string;
  /** Emit query/error events for wiring into the app logger. */
  log?: boolean;
}

/**
 * Construct a configured PrismaClient. We avoid Prisma's stdout logging in favor
 * of event-based logging so the app can route queries through its structured
 * logger with redaction and sampling.
 */
export function createPrismaClient(options: PrismaClientOptions = {}): PrismaClient {
  return new PrismaClient({
    ...(options.databaseUrl
      ? { datasources: { db: { url: options.databaseUrl } } }
      : {}),
    log: options.log
      ? [
          { level: 'warn', emit: 'event' },
          { level: 'error', emit: 'event' },
        ]
      : [{ level: 'error', emit: 'event' }],
  });
}

/**
 * Process-wide singleton. In development, Next.js/tsx hot-reload can otherwise
 * spawn a new client on every reload and exhaust the connection pool, so we
 * stash it on `globalThis`.
 */
const globalForPrisma = globalThis as unknown as { __akpPrisma?: PrismaClient };

export function getPrismaClient(options: PrismaClientOptions = {}): PrismaClient {
  if (!globalForPrisma.__akpPrisma) {
    globalForPrisma.__akpPrisma = createPrismaClient(options);
  }
  return globalForPrisma.__akpPrisma;
}

export { PrismaClient, Prisma };
