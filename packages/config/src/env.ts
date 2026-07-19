import { z } from 'zod';

/**
 * Raw environment schema. Everything the platform reads from `process.env` is
 * declared, coerced, and validated here so misconfiguration fails loudly at
 * boot rather than surfacing as a confusing runtime error later.
 */

const nodeEnv = z.enum(['development', 'test', 'production']).default('development');
const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

/** Comma-separated string -> trimmed non-empty array. */
const csv = z
  .string()
  .transform((value) => value.split(',').map((s) => s.trim()).filter(Boolean));

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z
  .object({
    NODE_ENV: nodeEnv,
    LOG_LEVEL: logLevel.default('info'),

    // Server
    API_HOST: z.string().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().max(65535).default(4000),
    API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
    CORS_ORIGINS: csv.default('http://localhost:3000'),

    // Database
    DATABASE_URL: z.string().url(),
    TEST_DATABASE_URL: z.string().url().optional(),

    // Redis
    REDIS_URL: z.string().url(),

    // Auth
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
    JWT_ISSUER: z.string().min(1).default('akp'),
    JWT_AUDIENCE: z.string().min(1).default('akp-api'),
    PASSWORD_HASH_MEMORY_COST: z.coerce.number().int().min(8192).default(19_456),

    // AI providers
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
    CHAT_MODEL: z.string().default('gpt-4o'),
    // Force deterministic fake provider (CI/offline). Auto-enabled when no keys.
    AI_FORCE_FAKE: bool.default('false'),
    // Retrieval defaults
    RETRIEVAL_VECTOR_K: z.coerce.number().int().positive().default(40),
    RETRIEVAL_LEXICAL_K: z.coerce.number().int().positive().default(40),
    RETRIEVAL_RERANK_K: z.coerce.number().int().positive().default(8),
    RETRIEVAL_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.12),
    GROUNDING_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.35),

    // Object storage
    STORAGE_BACKEND: z.enum(['local', 'gcs']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().default('.data/objects'),
    STORAGE_BUCKET: z.string().default('akp-documents'),
    STORAGE_GCS_ACCESS_TOKEN: z.string().optional(),

    // Queue / workers
    QUEUE_PREFIX: z.string().default('akp'),
    INGEST_CONCURRENCY: z.coerce.number().int().positive().default(4),
    WEBHOOK_CONCURRENCY: z.coerce.number().int().positive().default(8),

    // Billing (Stripe optional; metering works without it)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Web app
    WEB_PUBLIC_URL: z.string().url().default('http://localhost:3000'),

    // MCP
    MCP_HOST: z.string().default('0.0.0.0'),
    MCP_PORT: z.coerce.number().int().positive().max(65535).default(4100),

    // Observability
    OTEL_ENABLED: bool.default('false'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_SERVICE_NAME: z.string().default('akp-api'),
    SENTRY_DSN: z.string().optional(),

    // Security and compliance
    SECURITY_REQUIRE_MFA: bool.default('false'),
    SECURITY_ALLOW_SSO: bool.default('true'),
    SECURITY_API_KEY_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
    INCIDENT_RUNBOOK_URL: z.string().url().default('https://example.com/runbooks/akp'),
    INCIDENT_CHANNEL: z.string().min(1).default('#akp-incident-response'),
    // Backup/DR reporting. Populated by infrastructure; the API reports what it
    // is told rather than fabricating values.
    BACKUP_PROVIDER: z.string().optional(),
    BACKUP_LAST_RESTORE_TEST_AT: z.string().datetime().optional(),

    // Service-level objectives (definitions surfaced by the API; burn-rate is
    // computed by the monitoring stack from the /metrics endpoint).
    SLO_AVAILABILITY_TARGET: z.string().default('99.9%'),
    SLO_LATENCY_BUDGET_MS: z.coerce.number().int().positive().default(750),
    SLO_ERROR_BUDGET_MINUTES: z.coerce.number().int().positive().default(43),
    SLO_BURN_ALERT: z.string().default('burn-rate > 14.4 over 1h'),

    // Field encryption (envelope encryption for secrets at rest).
    // ENCRYPTION_KEYS is a comma-separated list of `keyId:base64Key` (each key
    // decoding to 32 bytes). ENCRYPTION_ACTIVE_KEY_ID selects the write key;
    // other keys remain available for decryption to support rotation.
    ENCRYPTION_ACTIVE_KEY_ID: z.string().min(1).default('dev'),
    ENCRYPTION_KEYS: z
      .string()
      .min(1)
      .default('dev:YWtwLWRldi1lbmNyeXB0aW9uLWtleS0wMDAwMDAwMDE='),

    // Multi-factor authentication
    MFA_ISSUER: z.string().min(1).default('AKP'),

    // Webhooks (outbound event delivery)
    WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(6),
    WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

    // Idempotency (safe retries for mutating requests)
    IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),

    // Data retention sweeps (audit/usage/idempotency housekeeping)
    RETENTION_SWEEP_ENABLED: bool.default('false'),

    // Rate limiting
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60_000),
    // Default per-API-key request budget (per minute) when a key sets none.
    API_KEY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      const weak = ['change-me', 'dev-access-secret', 'dev-refresh-secret'];
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (weak.some((w) => env[key].includes(w))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} looks like a development placeholder; set a strong secret in production`,
          });
        }
      }
      if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
        });
      }
      // The bundled development key must never be used in production.
      if (
        env.ENCRYPTION_ACTIVE_KEY_ID === 'dev' ||
        env.ENCRYPTION_KEYS.includes('YWtwLWRldi1lbmNyeXB0aW9uLWtleS0wMDAwMDAwMDE=')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENCRYPTION_KEYS'],
          message:
            'ENCRYPTION_KEYS/ENCRYPTION_ACTIVE_KEY_ID use the development default; provide real keys in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
