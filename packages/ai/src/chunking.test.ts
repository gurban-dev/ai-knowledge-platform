import { describe, expect, it } from 'vitest';
import { chunkText, estimateTokens } from './chunking.js';

describe('chunkText', () => {
  it('returns empty for blank input', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('keeps short text as a single chunk', () => {
    const chunks = chunkText('Hello world.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain('Hello');
    expect(chunks[0]?.tokenCount).toBe(estimateTokens(chunks[0]!.content));
  });

  it('splits long text under maxChars', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ${'word '.repeat(20)}`).join(
      '\n\n',
    );
    const chunks = chunkText(text, { maxChars: 200, overlapChars: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });
});
