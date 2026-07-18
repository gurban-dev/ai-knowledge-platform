import { pino, type Logger, type LoggerOptions } from 'pino';
import { SENSITIVE_KEY_PATTERNS } from '@akp/core';

export type { Logger } from 'pino';

export interface LoggerConfig {
  level: string;
  serviceName: string;
  /** Pretty-print for local dev; JSON lines everywhere else. */
  pretty?: boolean;
}

/**
 * Build the pino redaction paths. We redact common credential-bearing fields in
 * both the top-level object and under `req.headers`/`payload` so secrets never
 * reach log sinks. This complements @akp/core's `redact()` used for ad-hoc data.
 */
function redactionPaths(): string[] {
  const roots = ['', 'req.headers.', 'payload.', 'body.', 'context.'];
  const paths = new Set<string>();
  for (const root of roots) {
    for (const key of SENSITIVE_KEY_PATTERNS) {
      // pino requires literal paths; add the exact key and a wildcard variant.
      paths.add(`${root}${key}`);
    }
  }
  // Always redact the Authorization header regardless of casing normalization.
  paths.add('req.headers.authorization');
  paths.add('req.headers.cookie');
  return [...paths];
}

/** Create the root application logger. One per process; derive children per request. */
export function createLogger(config: LoggerConfig): Logger {
  const options: LoggerOptions = {
    level: config.level,
    base: { service: config.serviceName },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: redactionPaths(),
      censor: '[REDACTED]',
    },
  };

  if (config.pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      },
    });
  }

  return pino(options);
}
