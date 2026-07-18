import { Prisma } from '@prisma/client';

/**
 * pgvector helpers. Prisma cannot type the `vector` column, so vector reads and
 * writes go through raw SQL. Centralizing them here keeps the escaping and
 * formatting correct and testable.
 */

/** Serialize a JS number[] into pgvector's textual literal form: `[1,2,3]`. */
export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length === 0) {
    throw new Error('Cannot serialize an empty embedding');
  }
  for (const value of embedding) {
    if (!Number.isFinite(value)) {
      throw new Error('Embedding contains a non-finite value');
    }
  }
  return `[${embedding.join(',')}]`;
}

/** Parse a pgvector textual literal back into a number[]. */
export function fromVectorLiteral(literal: string): number[] {
  const trimmed = literal.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    throw new Error(`Malformed vector literal: ${literal}`);
  }
  const inner = trimmed.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((part) => {
    const n = Number(part);
    if (!Number.isFinite(n)) throw new Error(`Malformed vector component: ${part}`);
    return n;
  });
}

/**
 * Build a parameterized cosine-distance ORDER BY fragment for KNN search.
 * pgvector's `<=>` operator is cosine distance (0 = identical, 2 = opposite);
 * similarity = 1 - distance.
 */
export function cosineDistanceExpr(column: string, embedding: number[]): Prisma.Sql {
  // The column name is a trusted constant (never user input); the embedding is
  // interpolated as a parameter cast to vector.
  return Prisma.sql`${Prisma.raw(column)} <=> ${toVectorLiteral(embedding)}::vector`;
}
