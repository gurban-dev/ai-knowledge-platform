import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { loadConfig } from '@akp/config';
import { createPrismaClient, type PrismaClient } from '@akp/db';
import { createLogger } from '@akp/observability';
import { buildApp } from '../../src/app.js';
import { buildContainer } from '../../src/container.js';

/** Integration tests run only when a test database is configured. */
export const INTEGRATION_ENABLED = Boolean(process.env.TEST_DATABASE_URL);

export interface TestHarness {
  app: FastifyInstance;
  prisma: PrismaClient;
  redis: Redis;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Spin up the real Fastify app wired to the test Postgres + Redis. Tests drive
 * it through `app.inject()` (no network socket) for speed and determinism.
 */
export async function createHarness(): Promise<TestHarness> {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-000000000000000000000',
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-11111111111111111111',
    // Keep hashing cheap in tests.
    PASSWORD_HASH_MEMORY_COST: '8192',
  });

  const logger = createLogger({ level: 'silent', serviceName: 'akp-api-test' });
  const prisma = createPrismaClient({ databaseUrl });
  const redis = new Redis(config.redis.url, { maxRetriesPerRequest: null, lazyConnect: false });

  const container = buildContainer({ config, logger, prisma, redis });
  const app = await buildApp({ container });

  const reset = async (): Promise<void> => {
    // Truncate all domain tables; CASCADE handles FK order. Restart identity is
    // unnecessary since ids are app-generated.
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "tool_invocations", "budget_periods", "subscriptions", "scim_tokens",
        "sso_connections", "stored_objects", "prompt_templates",
        "collection_documents", "collections", "team_memberships", "teams",
        "document_acls", "document_versions",
        "idempotency_keys", "message_feedback", "webhook_deliveries", "webhook_endpoints",
        "audit_logs", "usage_events", "evaluation_results", "evaluations",
        "ingestion_jobs", "citations", "messages", "conversations",
        "document_chunks", "documents", "data_sources", "invites",
        "api_keys", "sessions", "memberships", "users", "organizations"
      RESTART IDENTITY CASCADE;
    `);
    await redis.flushdb();
  };

  const close = async (): Promise<void> => {
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
  };

  return { app, prisma, redis, reset, close };
}
