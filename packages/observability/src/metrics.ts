import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
  type CounterConfiguration,
  type HistogramConfiguration,
} from 'prom-client';

/**
 * A self-contained Prometheus metrics registry. Each process owns one registry
 * exposed at `/metrics`. Default Node.js process metrics (event loop lag, GC,
 * heap) are collected automatically alongside our custom application metrics.
 */
export class Metrics {
  readonly registry: Registry;

  constructor(defaultLabels: Record<string, string> = {}) {
    this.registry = new Registry();
    this.registry.setDefaultLabels(defaultLabels);
    collectDefaultMetrics({ register: this.registry });
  }

  counter<L extends string>(config: CounterConfiguration<L>): Counter<L> {
    return new Counter({ ...config, registers: [this.registry] });
  }

  histogram<L extends string>(config: HistogramConfiguration<L>): Histogram<L> {
    return new Histogram({ ...config, registers: [this.registry] });
  }

  contentType(): string {
    return this.registry.contentType;
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}

/** Latency buckets (seconds) tuned for API/RAG workloads spanning ms to tens of seconds. */
export const HTTP_LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
];

/**
 * The application metrics catalog: a single registry pre-declaring every
 * instrument the platform exports at `/metrics`. Centralizing definitions keeps
 * metric names, labels, and buckets consistent and prevents duplicate
 * registration (prom-client throws on collisions). HTTP instruments are driven
 * by the Fastify onResponse hook; AI instruments are driven by the usage
 * pipeline whenever a model call is recorded.
 */
export class AppMetrics {
  readonly metrics: Metrics;

  readonly httpRequestDuration: Histogram<'method' | 'route' | 'status_code'>;
  readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;

  readonly aiRequestsTotal: Counter<'organization' | 'provider' | 'model' | 'kind' | 'outcome'>;
  readonly aiRequestDuration: Histogram<'provider' | 'model' | 'kind'>;
  readonly aiTokensTotal: Counter<'organization' | 'provider' | 'model' | 'kind' | 'token_type'>;
  readonly aiCostMicrosTotal: Counter<'organization' | 'provider' | 'model' | 'kind'>;

  constructor(defaultLabels: Record<string, string> = {}) {
    this.metrics = new Metrics(defaultLabels);

    this.httpRequestDuration = this.metrics.histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: HTTP_LATENCY_BUCKETS,
    });
    this.httpRequestsTotal = this.metrics.counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.aiRequestsTotal = this.metrics.counter({
      name: 'ai_requests_total',
      help: 'Total AI model invocations recorded by the usage pipeline',
      labelNames: ['organization', 'provider', 'model', 'kind', 'outcome'],
    });
    this.aiRequestDuration = this.metrics.histogram({
      name: 'ai_request_duration_seconds',
      help: 'AI model call latency in seconds',
      labelNames: ['provider', 'model', 'kind'],
      buckets: HTTP_LATENCY_BUCKETS,
    });
    this.aiTokensTotal = this.metrics.counter({
      name: 'ai_tokens_total',
      help: 'Total tokens consumed by AI model calls',
      labelNames: ['organization', 'provider', 'model', 'kind', 'token_type'],
    });
    this.aiCostMicrosTotal = this.metrics.counter({
      name: 'ai_cost_micros_total',
      help: 'Total AI spend in micro-USD',
      labelNames: ['organization', 'provider', 'model', 'kind'],
    });
  }

  contentType(): string {
    return this.metrics.contentType();
  }

  async render(): Promise<string> {
    return this.metrics.render();
  }
}
