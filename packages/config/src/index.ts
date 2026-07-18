import { envSchema, type Env } from './env.js';

export type { Env } from './env.js';
export { envSchema } from './env.js';

/**
 * Strongly-typed, namespaced application configuration derived from validated env.
 * Consumers read `config.auth.accessTtl` rather than reaching into `process.env`,
 * which keeps env access centralized and the surface easy to mock in tests.
 */
export interface AppConfig {
  readonly env: Env['NODE_ENV'];
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly logLevel: Env['LOG_LEVEL'];
  readonly server: {
    readonly host: string;
    readonly port: number;
    readonly publicUrl: string;
    readonly corsOrigins: string[];
  };
  readonly database: {
    readonly url: string;
    readonly testUrl?: string;
  };
  readonly redis: {
    readonly url: string;
  };
  readonly auth: {
    readonly accessSecret: string;
    readonly refreshSecret: string;
    readonly accessTtl: number;
    readonly refreshTtl: number;
    readonly issuer: string;
    readonly audience: string;
    readonly passwordHashMemoryCost: number;
  };
  readonly ai: {
    readonly openaiApiKey?: string;
    readonly anthropicApiKey?: string;
    readonly embeddingModel: string;
    readonly embeddingDimensions: number;
    readonly chatModel: string;
  };
  readonly observability: {
    readonly otelEnabled: boolean;
    readonly otelEndpoint?: string;
    readonly serviceName: string;
    readonly sentryDsn?: string;
  };
  readonly rateLimit: {
    readonly max: number;
    readonly windowMs: number;
  };
}

export class ConfigValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

function shape(env: Env): AppConfig {
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    logLevel: env.LOG_LEVEL,
    server: {
      host: env.API_HOST,
      port: env.API_PORT,
      publicUrl: env.API_PUBLIC_URL,
      corsOrigins: env.CORS_ORIGINS,
    },
    database: {
      url: env.DATABASE_URL,
      ...(env.TEST_DATABASE_URL ? { testUrl: env.TEST_DATABASE_URL } : {}),
    },
    redis: { url: env.REDIS_URL },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      passwordHashMemoryCost: env.PASSWORD_HASH_MEMORY_COST,
    },
    ai: {
      ...(env.OPENAI_API_KEY ? { openaiApiKey: env.OPENAI_API_KEY } : {}),
      ...(env.ANTHROPIC_API_KEY ? { anthropicApiKey: env.ANTHROPIC_API_KEY } : {}),
      embeddingModel: env.EMBEDDING_MODEL,
      embeddingDimensions: env.EMBEDDING_DIMENSIONS,
      chatModel: env.CHAT_MODEL,
    },
    observability: {
      otelEnabled: env.OTEL_ENABLED,
      ...(env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? { otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT }
        : {}),
      serviceName: env.OTEL_SERVICE_NAME,
      ...(env.SENTRY_DSN ? { sentryDsn: env.SENTRY_DSN } : {}),
    },
    rateLimit: {
      max: env.RATE_LIMIT_MAX,
      windowMs: env.RATE_LIMIT_WINDOW,
    },
  };
}

/**
 * Parse and validate configuration from a raw env source (defaults to
 * `process.env`). Throws {@link ConfigValidationError} with all issues listed.
 * Pure and side-effect free so it can be called deterministically in tests.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new ConfigValidationError(issues);
  }
  return shape(parsed.data);
}

let cached: AppConfig | undefined;

/** Lazily load and memoize the process-wide config. */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

/** Reset the memoized config (test-only). */
export function resetConfigCache(): void {
  cached = undefined;
}
