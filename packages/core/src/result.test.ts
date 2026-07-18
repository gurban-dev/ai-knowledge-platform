import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, map, ok, unwrap } from './result.js';

describe('Result', () => {
  it('constructs ok and err variants', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it('narrows with type guards', () => {
    const good = ok(42);
    const bad = err(new Error('x'));
    expect(isOk(good)).toBe(true);
    expect(isErr(bad)).toBe(true);
  });

  it('unwraps values and throws on error', () => {
    expect(unwrap(ok('v'))).toBe('v');
    expect(() => unwrap(err(new Error('nope')))).toThrow('nope');
  });

  it('maps only the ok branch', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    const e = err<string>('fail');
    expect(map(e, (n: number) => n * 3)).toBe(e);
  });
});
