import { describe, expect, it } from 'vitest';
import { redact } from './redact.js';

describe('redact', () => {
  it('masks sensitive keys case-insensitively and by substring', () => {
    const input = {
      email: 'a@b.com',
      password: 'hunter2',
      accessToken: 'abc',
      nested: { 'x-api-key': 'secret', safe: 1 },
    };
    expect(redact(input)).toEqual({
      email: 'a@b.com',
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
      nested: { 'x-api-key': '[REDACTED]', safe: 1 },
    });
  });

  it('handles arrays and preserves primitives', () => {
    expect(redact([{ token: 't' }, { ok: true }])).toEqual([{ token: '[REDACTED]' }, { ok: true }]);
    expect(redact('plain')).toBe('plain');
    expect(redact(null)).toBeNull();
  });

  it('guards against circular references', () => {
    const obj: Record<string, unknown> = { name: 'x' };
    obj.self = obj;
    const result = redact(obj) as Record<string, unknown>;
    expect(result.name).toBe('x');
    expect(result.self).toBe('[Circular]');
  });
});
