import { describe, expect, it } from 'vitest';
import { fromVectorLiteral, toVectorLiteral } from './vector.js';

describe('toVectorLiteral', () => {
  it('serializes a numeric vector to pgvector literal form', () => {
    expect(toVectorLiteral([1, 2, 3])).toBe('[1,2,3]');
    expect(toVectorLiteral([0.1, -0.2, 0.3])).toBe('[0.1,-0.2,0.3]');
  });

  it('rejects empty and non-finite vectors', () => {
    expect(() => toVectorLiteral([])).toThrow(/empty/);
    expect(() => toVectorLiteral([1, NaN])).toThrow(/non-finite/);
    expect(() => toVectorLiteral([Infinity])).toThrow(/non-finite/);
  });
});

describe('fromVectorLiteral', () => {
  it('round-trips through serialization', () => {
    const v = [0.5, 1.25, -3];
    expect(fromVectorLiteral(toVectorLiteral(v))).toEqual(v);
  });

  it('parses an empty vector literal', () => {
    expect(fromVectorLiteral('[]')).toEqual([]);
  });

  it('rejects malformed literals', () => {
    expect(() => fromVectorLiteral('1,2,3')).toThrow(/Malformed/);
    expect(() => fromVectorLiteral('[a,b]')).toThrow(/Malformed/);
  });
});
