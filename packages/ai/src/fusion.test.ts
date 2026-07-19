import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './fusion.js';

describe('reciprocalRankFusion', () => {
  it('boosts items present in both lists', () => {
    const fused = reciprocalRankFusion(
      [
        { id: 'a', rank: 1 },
        { id: 'b', rank: 2 },
      ],
      [
        { id: 'b', rank: 1 },
        { id: 'c', rank: 2 },
      ],
      10,
    );
    expect(fused[0]?.id).toBe('b');
    expect(fused.map((h) => h.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
