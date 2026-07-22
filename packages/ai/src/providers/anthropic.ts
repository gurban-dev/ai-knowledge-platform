import { DependencyFailureError } from '@akp/core';
import { chatCostMicros, rerankCostMicros } from '../pricing.js';
import type {
  AiProvider,
  ChatRequest,
  ChatResult,
  EmbeddingRequest,
  EmbeddingResult,
  RerankRequest,
  RerankResult,
} from '../types.js';
import { FakeAiProvider } from './fake.js';

/**
 * Anthropic chat provider. Embeddings/rerank are not first-class Anthropic
 * APIs — those call through to a configured fallback (typically OpenAI or Fake).
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly embedFallback: AiProvider;

  constructor(
    private readonly apiKey: string,
    embedFallback?: AiProvider,
    private readonly timeoutMs = 60_000,
  ) {
    this.embedFallback = embedFallback ?? new FakeAiProvider();
  }

  embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return this.embedFallback.embed(request);
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const started = Date.now();
    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const messages = request.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens ?? 1024,
          temperature: request.temperature ?? 0.2,
          system: system || undefined,
          messages,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new DependencyFailureError(
          `Anthropic chat failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string;
        stop_reason?: string;
      };
      const content = data.content?.find((c) => c.type === 'text')?.text ?? '';
      const promptTokens = data.usage?.input_tokens ?? 0;
      const completionTokens = data.usage?.output_tokens ?? 0;
      const model = data.model ?? request.model;
      return {
        content,
        model,
        promptTokens,
        completionTokens,
        latencyMs: Date.now() - started,
        costMicros: chatCostMicros(model, promptTokens, completionTokens),
        finishReason: data.stop_reason ?? 'stop',
      };
    } catch (error) {
      if (error instanceof DependencyFailureError) throw error;
      throw new DependencyFailureError(
        `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async rerank(request: RerankRequest): Promise<RerankResult> {
    const started = Date.now();
    const result = await this.embedFallback.rerank(request);
    return {
      ...result,
      latencyMs: Date.now() - started,
      costMicros: rerankCostMicros(result.model, 1),
    };
  }
}
