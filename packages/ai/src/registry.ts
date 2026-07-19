import { DependencyFailureError, ServiceUnavailableError } from '@akp/core';
import type {
  AiProvider,
  ChatRequest,
  ChatResult,
  EmbeddingRequest,
  EmbeddingResult,
  ProviderHealth,
  RerankRequest,
  RerankResult,
} from './types.js';

interface CircuitState {
  failures: number;
  openUntil: number;
}

/**
 * Multi-provider registry with circuit-breaker failover.
 * Primary provider is tried first; on failure (or open circuit) the next
 * healthy provider is used. This is how we survive OpenAI/Anthropic outages
 * without failing interactive chat.
 */
export class AiProviderRegistry implements AiProvider {
  readonly name = 'registry';
  private readonly circuits = new Map<string, CircuitState>();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(
    private readonly providers: AiProvider[],
    options?: { failureThreshold?: number; cooldownMs?: number },
  ) {
    if (providers.length === 0) {
      throw new Error('AiProviderRegistry requires at least one provider');
    }
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.cooldownMs = options?.cooldownMs ?? 30_000;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return this.withFailover((p) => p.embed(request));
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    return this.withFailover((p) => p.chat(request));
  }

  async rerank(request: RerankRequest): Promise<RerankResult> {
    return this.withFailover((p) => p.rerank(request));
  }

  async healthCheck(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = [];
    for (const provider of this.providers) {
      const started = Date.now();
      try {
        await provider.embed({
          texts: ['ping'],
          model: 'health-check',
          dimensions: 8,
        });
        results.push({ name: provider.name, healthy: true, latencyMs: Date.now() - started });
      } catch (error) {
        results.push({
          name: provider.name,
          healthy: false,
          latencyMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }

  private async withFailover<T>(fn: (provider: AiProvider) => Promise<T>): Promise<T> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      if (this.isOpen(provider.name)) {
        errors.push(`${provider.name}: circuit open`);
        continue;
      }
      try {
        const result = await fn(provider);
        this.recordSuccess(provider.name);
        return result;
      } catch (error) {
        this.recordFailure(provider.name);
        errors.push(
          `${provider.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    throw new ServiceUnavailableError(`All AI providers unavailable: ${errors.join('; ')}`);
  }

  private isOpen(name: string): boolean {
    const state = this.circuits.get(name);
    if (!state) return false;
    if (Date.now() < state.openUntil) return true;
    // Half-open: allow a probe.
    state.failures = this.failureThreshold - 1;
    state.openUntil = 0;
    return false;
  }

  private recordSuccess(name: string): void {
    this.circuits.set(name, { failures: 0, openUntil: 0 });
  }

  private recordFailure(name: string): void {
    const state = this.circuits.get(name) ?? { failures: 0, openUntil: 0 };
    state.failures += 1;
    if (state.failures >= this.failureThreshold) {
      state.openUntil = Date.now() + this.cooldownMs;
    }
    this.circuits.set(name, state);
  }
}

export function assertProviderConfigured(provider: AiProvider | undefined, label: string): AiProvider {
  if (!provider) {
    throw new DependencyFailureError(`${label} AI provider is not configured`);
  }
  return provider;
}
