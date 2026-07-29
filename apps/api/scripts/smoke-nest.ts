import 'reflect-metadata';
import { loadConfig } from '@akp/config';
import { getPrismaClient } from '@akp/db';
import { createLogger } from '@akp/observability';
import { Redis } from 'ioredis';
import { buildApp } from '../src/app.js';
import { buildContainer } from '../src/container.js';
import { inject } from '../src/nest/test-http.js';

async function main(): Promise<void> {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    PASSWORD_HASH_MEMORY_COST: '8192',
  });
  const logger = createLogger({ level: 'silent', serviceName: 'smoke' });
  const prisma = getPrismaClient({ databaseUrl: config.database.url });
  const redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 500,
    enableOfflineQueue: false,
  });

  const container = buildContainer({ config, logger, prisma, redis });
  const app = await buildApp({ container });
  console.log('nest_ready', Boolean(app.getHttpServer()));

  const live = await inject(app, { method: 'GET', url: '/health/live' });
  console.log('health_live', live.statusCode, live.json());

  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
