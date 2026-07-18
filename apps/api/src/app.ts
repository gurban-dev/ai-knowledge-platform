import { fastify, type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { IdPrefix, newId } from '@akp/core';
import type { AppContainer } from './container.js';
import containerPlugin from './plugins/container.js';
import requestContextPlugin from './plugins/request-context.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import securityPlugin from './plugins/security.js';
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import swaggerPlugin from './plugins/swagger.js';
import metricsPlugin from './plugins/metrics.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { organizationRoutes } from './modules/organizations/organization.routes.js';

export interface BuildAppOptions {
  container: AppContainer;
}

/**
 * Construct a fully-wired Fastify instance. Kept free of side effects (no
 * `listen`) so tests can build the app and drive it via `inject()` without
 * binding a port. Plugin registration order encodes cross-cutting dependencies;
 * `fastify-plugin` metadata enforces the rest.
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { container } = options;

  const app = fastify({
    logger: container.logger,
    disableRequestLogging: false,
    // Prefixed, sortable request ids for correlation across logs/traces.
    genReqId: () => newId(IdPrefix.session).replace('ses_', 'req_'),
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024, // 5 MB; document upload uses a dedicated route later.
    ajv: { customOptions: { coerceTypes: false } },
  });

  // Zod drives both request validation and response serialization.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Cross-cutting concerns (order matters where not enforced by fp deps).
  await app.register(containerPlugin, { container });
  await app.register(errorHandlerPlugin);
  await app.register(requestContextPlugin);
  await app.register(securityPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);
  await app.register(metricsPlugin);

  // Feature routes.
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(organizationRoutes, { prefix: '/v1/organizations' });

  await app.ready();
  return app;
}
