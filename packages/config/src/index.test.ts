import { describe, expect, it } from 'vitest';
import { ConfigValidationError, loadConfig } from './index.js';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
} satisfies NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('applies defaults and coerces types', () => {
    const config = loadConfig(baseEnv);
    expect(config.server.port).toBe(4000);
    expect(config.auth.accessTtl).toBe(900);
    expect(config.isTest).toBe(true);
    expect(config.server.corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('parses comma-separated CORS origins', () => {
    const config = loadConfig({ ...baseEnv, CORS_ORIGINS: 'https://a.com, https://b.com' });
    expect(config.server.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
  });

  it('rejects short JWT secrets with a descriptive issue', () => {
    expect(() => loadConfig({ ...baseEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(
      ConfigValidationError,
    );
  });

  it('rejects a missing database url', () => {
    const { DATABASE_URL: _omit, ...rest } = baseEnv;
    expect(() => loadConfig(rest)).toThrow(/DATABASE_URL/);
  });

  it('rejects placeholder secrets in production', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me-min-32-chars',
        JWT_REFRESH_SECRET: 'b'.repeat(40),
        ENCRYPTION_ACTIVE_KEY_ID: 'prod',
        ENCRYPTION_KEYS: 'prod:dGVzdC1wcm9kLWVuY3J5cHRpb24ta2V5LTEyMzQ1Njc=',
      }),
    ).toThrow(/placeholder/);
  });

  it('rejects identical access/refresh secrets in production', () => {
    const secret = 'x'.repeat(40);
    expect(() =>
      loadConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: secret,
        JWT_REFRESH_SECRET: secret,
        ENCRYPTION_ACTIVE_KEY_ID: 'prod',
        ENCRYPTION_KEYS: 'prod:dGVzdC1wcm9kLWVuY3J5cHRpb24ta2V5LTEyMzQ1Njc=',
      }),
    ).toThrow(/must differ/);
  });

  it('exposes storage, retrieval, and queue settings', () => {
    const config = loadConfig(baseEnv);
    expect(config.storage.backend).toBe('local');
    expect(config.ai.retrieval.vectorK).toBe(40);
    expect(config.queue.prefix).toBe('akp');
    expect(config.mcp.port).toBe(4100);
  });
});
