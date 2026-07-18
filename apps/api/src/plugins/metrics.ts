import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { HTTP_LATENCY_BUCKETS, Metrics } from '@akp/observability';

/**
 * Prometheus metrics: per-request latency histogram and total counter labeled
 * by method, route (template, not raw path, to avoid label cardinality blowup),
 * and status code. Exposes `GET /metrics` in the platform text format.
 */
const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  const metrics = new Metrics({ service: fastify.container.config.observability.serviceName });

  const requestDuration = metrics.histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: HTTP_LATENCY_BUCKETS,
  });

  const requestTotal = metrics.counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    // routeOptions.url is the templated path (e.g. /v1/auth/:id); fall back to 'unknown'.
    const route = request.routeOptions.url ?? 'unknown';
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    requestDuration.observe(labels, reply.elapsedTime / 1000);
    requestTotal.inc(labels);
    done();
  });

  fastify.get(
    '/metrics',
    { schema: { hide: true }, config: { rateLimit: false } },
    async (_request, reply) => {
      void reply.header('content-type', metrics.contentType());
      return metrics.render();
    },
  );
};

export default fp(metricsPlugin, { name: 'metrics', dependencies: ['container'] });
