/**
 * Cursor-based pagination primitives. We use opaque cursors (base64-encoded)
 * rather than offset/limit because offset pagination degrades on large tables
 * and produces inconsistent results under concurrent writes.
 */
export interface CursorPage<T> {
  items: T[];
  /** Cursor to pass as `cursor` to fetch the next page, or null if exhausted. */
  nextCursor: string | null;
  /** Whether more items exist after this page. */
  hasMore: boolean;
}

export interface PaginationParams {
  limit: number;
  cursor?: string | undefined;
}

const CURSOR_ENCODING = 'base64url';

/** Encode an opaque forward cursor from a stable, monotonic key (e.g. `${createdAt}:${id}`). */
export function encodeCursor(key: string): string {
  return Buffer.from(key, 'utf8').toString(CURSOR_ENCODING);
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, CURSOR_ENCODING).toString('utf8');
}

/**
 * Build a {@link CursorPage} from a set of rows fetched with `limit + 1` items.
 * The extra row (if present) signals more pages and is dropped from the result.
 */
export function buildCursorPage<T>(
  rows: T[],
  limit: number,
  toCursor: (item: T) => string,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(toCursor(last)) : null,
  };
}
