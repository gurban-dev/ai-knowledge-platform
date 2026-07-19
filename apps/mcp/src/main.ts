import { Redis } from 'ioredis';
import { getConfig } from '@akp/config';
import { createPrismaClient } from '@akp/db';
import { createLogger } from '@akp/observability';
import { buildMcpServer } from './server.js';

async function main(): Promise<void> {
  const config = getConfig();
  const logger = createLogger({
    serviceName: 'akp-mcp',
    level: config.logLevel,
    pretty: !config.isProduction,
  });
  const prisma = createPrismaClient({ databaseUrl: config.database.url });
  const redis = new Redis(config.redis.url, { maxRetriesPerRequest: null });

  const app = await buildMcpServer({
    prisma,
    redis,
    logger,
    apiBaseUrl: config.server.publicUrl,
  });

  await app.listen({ host: config.mcp.host, port: config.mcp.port });
  logger.info({ port: config.mcp.port }, 'AKP MCP server listening');

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
