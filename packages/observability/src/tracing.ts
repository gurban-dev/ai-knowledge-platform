import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  environment: string;
}

let sdk: NodeSDK | undefined;

/**
 * Initialize OpenTelemetry tracing. MUST be called before any instrumented
 * module (http, pg, ioredis, fastify) is imported — i.e. from a process
 * preload/entry file — otherwise auto-instrumentation cannot patch them.
 *
 * No-ops when disabled so local/test runs pay zero cost.
 */
export function initTracing(config: TracingConfig): void {
  if (!config.enabled || sdk) return;

  const traceExporter = config.otlpEndpoint
    ? new OTLPTraceExporter({ url: `${config.otlpEndpoint.replace(/\/$/, '')}/v1/traces` })
    : undefined;

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion ?? '0.1.0',
      'deployment.environment': config.environment,
    }),
    ...(traceExporter ? { traceExporter } : {}),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs instrumentation is noisy and rarely useful; disable it.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
}

/** Flush and shut down the tracer on graceful termination. */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}
