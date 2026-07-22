import { createHash } from 'node:crypto';
import { chatCostMicros, embeddingCostMicros, rerankCostMicros } from '../pricing.js';
import type {
  AiProvider,
  ChatRequest,
  ChatResult,
  EmbeddingRequest,
  EmbeddingResult,
  RerankRequest,
  RerankResult,
} from '../types.js';

/**
 * Deterministic offline provider for local development and CI.
 * Produces stable embeddings from content hashes so hybrid retrieval tests
 * remain reproducible without network calls or API keys.
 */
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake';

  // eslint-disable-next-line @typescript-eslint/require-await
  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const started = Date.now();
    const embeddings = request.texts.map((text) => hashEmbedding(text, request.dimensions));
    const promptTokens = request.texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
    return {
      embeddings,
      model: request.model || 'fake',
      promptTokens,
      latencyMs: Date.now() - started,
      costMicros: embeddingCostMicros('fake', promptTokens),
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async chat(request: ChatRequest): Promise<ChatResult> {
    const started = Date.now();
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    const context = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const content =
      context.trim().length > 0
        ? `Based on the provided context: ${summarize(context)}\n\nAnswer: ${lastUser?.content ?? ''}`
        : `I don't have enough grounded information to answer: ${lastUser?.content ?? ''}`;
    const promptTokens = request.messages.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0);
    const completionTokens = Math.ceil(content.length / 4);
    return {
      content,
      model: request.model || 'fake',
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - started,
      costMicros: chatCostMicros('fake', promptTokens, completionTokens),
      finishReason: 'stop',
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async rerank(request: RerankRequest): Promise<RerankResult> {
    const started = Date.now();
    const q = request.query.toLowerCase();
    const scored = request.documents.map((doc, index) => {
      const d = doc.toLowerCase();
      let score = 0;
      for (const term of q.split(/\s+/).filter(Boolean)) {
        if (d.includes(term)) score += 1;
      }
      return { index, score: score / Math.max(1, q.split(/\s+/).length) };
    });
    scored.sort((a, b) => b.score - a.score);
    return {
      hits: scored.slice(0, request.topN),
      model: request.model ?? 'cross-encoder-fake',
      latencyMs: Date.now() - started,
      costMicros: rerankCostMicros('cross-encoder-fake', 1),
    };
  }
}

function hashEmbedding(text: string, dimensions: number): number[] {
  const digest = createHash('sha256').update(text).digest();
  const out = new Array<number>(dimensions);
  for (let i = 0; i < dimensions; i++) {
    const byte = digest[i % digest.length]!;
    // Normalize to unit-ish range for cosine similarity.
    out[i] = (byte / 255) * 2 - 1;
  }
  // L2 normalize
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

function summarize(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
}
