import { describe, expect, it } from 'vitest';
import { buildCursorPage, decodeCursor, encodeCursor } from './pagination.js';

describe('cursor encoding', () => {
  it('round-trips an opaque cursor', () => {
    const key = '2026-01-01T00:00:00.000Z:usr_abc';
    expect(decodeCursor(encodeCursor(key))).toBe(key);
  });
});

describe('buildCursorPage', () => {
  const toCursor = (n: number) => String(n);

  it('reports more pages and trims the sentinel row', () => {
    const rows = [1, 2, 3]; // limit 2 + 1 sentinel
    const page = buildCursorPage(rows, 2, toCursor);
    expect(page.items).toEqual([1, 2]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(encodeCursor('2'));
  });

  it('reports the final page', () => {
    const page = buildCursorPage([1, 2], 5, toCursor);
    expect(page.items).toEqual([1, 2]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('handles an empty result set', () => {
    const page = buildCursorPage<number>([], 10, toCursor);
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});
