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

    // Observability
    OTEL_ENABLED: bool.default('false'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_SERVICE_NAME: z.string().default('akp-api'),
    SENTRY_DSN: z.string().optional(),

    // Rate limiting
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60_000),
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
    }
  });

export type Env = z.infer<typeof envSchema>;
