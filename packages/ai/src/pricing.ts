/**
 * Approximate provider pricing in micro-USD per 1K tokens.
 * Used for usage accounting and budget enforcement. Update when pricing changes.
 */
const EMBEDDING_PER_1K: Record<string, number> = {
  'text-embedding-3-large': 130,
  'text-embedding-3-small': 20,
  fake: 0,
};

const CHAT_INPUT_PER_1K: Record<string, number> = {
  'gpt-4o': 2_500,
  'gpt-4o-mini': 150,
  'claude-3-5-sonnet-latest': 3_000,
  fake: 0,
};

const CHAT_OUTPUT_PER_1K: Record<string, number> = {
  'gpt-4o': 10_000,
  'gpt-4o-mini': 600,
  'claude-3-5-sonnet-latest': 15_000,
  fake: 0,
};

const RERANK_PER_QUERY: Record<string, number> = {
  'cross-encoder-fake': 0,
  'rerank-english-v3.0': 2_000,
};

export function embeddingCostMicros(model: string, tokens: number): number {
  const rate = EMBEDDING_PER_1K[model] ?? EMBEDDING_PER_1K['text-embedding-3-large']!;
  return Math.ceil((tokens / 1000) * rate);
}

export function chatCostMicros(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const inRate = CHAT_INPUT_PER_1K[model] ?? CHAT_INPUT_PER_1K['gpt-4o']!;
  const outRate = CHAT_OUTPUT_PER_1K[model] ?? CHAT_OUTPUT_PER_1K['gpt-4o']!;
  return Math.ceil((promptTokens / 1000) * inRate + (completionTokens / 1000) * outRate);
}

export function rerankCostMicros(model: string, queries: number): number {
  const rate = RERANK_PER_QUERY[model] ?? 1_000;
  return rate * queries;
}
