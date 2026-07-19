import { DependencyFailureError } from '@akp/core';
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
 * OpenAI-compatible HTTP provider (embeddings + chat).
 * Reranking falls back to a local lexical score when no dedicated rerank
 * endpoint is configured — production deployments can point `baseUrl` at a
 * gateway that exposes a rerank route.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.openai.com/v1',
    private readonly timeoutMs = 60_000,
  ) {}

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const started = Date.now();
    const body = await this.post('/embeddings', {
      model: request.model,
      input: request.texts,
      dimensions: request.dimensions,
    });
    const data = body as {
      data: Array<{ embedding: number[]; index: number }>;
      usage?: { prompt_tokens?: number };
      model?: string;
    };
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const model = data.model ?? request.model;
    return {
      embeddings: sorted.map((d) => d.embedding),
      model,
      promptTokens,
      latencyMs: Date.now() - started,
      costMicros: embeddingCostMicros(model, promptTokens),
    };
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const started = Date.now();
    const body = await this.post('/chat/completions', {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1024,
    });
    const data = body as {
      choices: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const content = data.choices[0]?.message?.content ?? '';
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const model = data.model ?? request.model;
    return {
      content,
      model,
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - started,
      costMicros: chatCostMicros(model, promptTokens, completionTokens),
      finishReason: data.choices[0]?.finish_reason ?? 'stop',
    };
  }

  async rerank(request: RerankRequest): Promise<RerankResult> {
    // OpenAI has no first-party cross-encoder; use deterministic lexical scoring.
    const started = Date.now();
    const qTerms = request.query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = request.documents
      .map((doc, index) => {
        const d = doc.toLowerCase();
        const score =
          qTerms.reduce((s, t) => s + (d.includes(t) ? 1 : 0), 0) / Math.max(1, qTerms.length);
        return { index, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, request.topN);
    return {
      hits,
      model: request.model ?? 'lexical-fallback',
      latencyMs: Date.now() - started,
      costMicros: rerankCostMicros('lexical-fallback', 1),
    };
  }

  private async post(path: string, payload: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new DependencyFailureError(`OpenAI ${path} failed (${res.status}): ${text.slice(0, 200)}`);
      }
      return await res.json();
    } catch (error) {
      if (error instanceof DependencyFailureError) throw error;
      throw new DependencyFailureError(
        `OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
