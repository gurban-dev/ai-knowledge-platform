/**
 * Keys whose values must never appear in logs, traces, or error payloads.
 * Matching is case-insensitive and substring-based to catch variants like
 * `accessToken`, `refresh_token`, `x-api-key`, etc.
 */
export const SENSITIVE_KEY_PATTERNS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'x-api-key',
  'ssn',
  'creditcard',
  'card_number',
] as const;

const REDACTED = '[REDACTED]';

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Recursively redact sensitive fields from an arbitrary value, returning a deep
 * clone safe for structured logging. Guards against cycles and caps depth to
 * avoid pathological inputs.
 */
export function redact<T>(value: T, maxDepth = 8): T {
  return redactInternal(value, maxDepth, new WeakSet()) as T;
}

function redactInternal(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth <= 0) return '[Truncated]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, depth - 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redactInternal(val, depth - 1, seen);
  }
  return out;
}
