import { describe, expect, it } from 'vitest';
import { IdPrefix, isId, newId } from './ids.js';

describe('newId', () => {
  it('produces prefixed, unique ids', () => {
    const a = newId(IdPrefix.user);
    const b = newId(IdPrefix.user);
    expect(a).toMatch(/^usr_[0-9A-Za-z]{24}$/);
    expect(a).not.toBe(b);
  });

  it('validates ids against a prefix', () => {
    const id = newId(IdPrefix.organization);
    expect(isId(id, IdPrefix.organization)).toBe(true);
    expect(isId(id, IdPrefix.user)).toBe(false);
    expect(isId('not-an-id', IdPrefix.organization)).toBe(false);
    expect(isId(123, IdPrefix.organization)).toBe(false);
  });
});
