/**
 * Structure-aware recursive chunking (recursive-v1).
 * Prefer splitting on paragraph/sentence boundaries to keep semantic units intact.
 */

export interface ChunkOptions {
  /** Target size in characters (approx. tokens * 4). */
  maxChars?: number;
  overlapChars?: number;
}

export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

const DEFAULT_MAX = 1200;
const DEFAULT_OVERLAP = 150;

const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''] as const;

/** Rough token estimate (~4 chars/token for English). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP;
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const parts = splitRecursive(normalized, maxChars);
  const chunks: TextChunk[] = [];
  let index = 0;

  for (let i = 0; i < parts.length; i++) {
    let content = parts[i]!;
    if (i > 0 && overlapChars > 0) {
      const prev = parts[i - 1]!;
      const overlap = prev.slice(Math.max(0, prev.length - overlapChars));
      content = `${overlap}${content}`.slice(0, maxChars + overlapChars);
    }
    content = content.trim();
    if (!content) continue;
    chunks.push({
      index,
      content,
      tokenCount: estimateTokens(content),
    });
    index += 1;
  }
  return chunks;
}

function splitRecursive(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  for (const sep of SEPARATORS) {
    if (sep === '') {
      const hard: string[] = [];
      for (let i = 0; i < text.length; i += maxChars) {
        hard.push(text.slice(i, i + maxChars));
      }
      return hard;
    }
    if (!text.includes(sep)) continue;
    const pieces = text.split(sep);
    const merged: string[] = [];
    let current = '';
    for (const piece of pieces) {
      const candidate = current ? `${current}${sep}${piece}` : piece;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) merged.push(...splitRecursive(current, maxChars));
        current = piece;
      }
    }
    if (current) merged.push(...splitRecursive(current, maxChars));
    return merged;
  }
  return [text];
}
