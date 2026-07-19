/**
 * Reciprocal Rank Fusion (RRF) for hybrid retrieval.
 * Combines ranked lists from vector ANN and lexical search without needing
 * calibrated scores across modalities.
 */

export interface RankedHit {
  id: string;
  rank: number;
  score?: number;
}

export interface FusedHit {
  id: string;
  score: number;
  vectorRank?: number;
  lexicalRank?: number;
}

const RRF_K = 60;

export function reciprocalRankFusion(
  vectorHits: RankedHit[],
  lexicalHits: RankedHit[],
  limit: number,
): FusedHit[] {
  const scores = new Map<string, FusedHit>();

  for (const hit of vectorHits) {
    const existing = scores.get(hit.id) ?? { id: hit.id, score: 0 };
    existing.score += 1 / (RRF_K + hit.rank);
    existing.vectorRank = hit.rank;
    scores.set(hit.id, existing);
  }
  for (const hit of lexicalHits) {
    const existing = scores.get(hit.id) ?? { id: hit.id, score: 0 };
    existing.score += 1 / (RRF_K + hit.rank);
    existing.lexicalRank = hit.rank;
    scores.set(hit.id, existing);
  }

  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
