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
