import { describe, expect, it } from 'vitest';
import { ABSTENTION_MESSAGE, assessGrounding, shouldAbstain } from './grounding.js';

describe('assessGrounding', () => {
  it('flags answers unsupported by context', () => {
    const result = assessGrounding(
      'The CEO of Acme is Alice Wonderland who lives on Mars',
      ['Acme was founded in 2010 and sells widgets.'],
    );
    expect(result.grounded).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('accepts grounded answers', () => {
    const result = assessGrounding(
      'Acme was founded in 2010 and sells widgets.',
      ['Acme was founded in 2010 and sells widgets to enterprises.'],
    );
    expect(result.grounded).toBe(true);
  });

  it('abstains on low retrieval score', () => {
    expect(shouldAbstain({ topScore: 0.01, groundingConfidence: 0.9 })).toBe(true);
    expect(ABSTENTION_MESSAGE).toContain("don't have enough");
  });
});
