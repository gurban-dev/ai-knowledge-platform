export * from './types.js';
export * from './pricing.js';
export * from './chunking.js';
export * from './fusion.js';
export * from './grounding.js';
export * from './prompts.js';
export * from './registry.js';
export * from './providers/fake.js';
export * from './providers/openai.js';
export * from './providers/anthropic.js';

import { AnthropicProvider } from './providers/anthropic.js';
import { FakeAiProvider } from './providers/fake.js';
import { OpenAiProvider } from './providers/openai.js';
import { AiProviderRegistry } from './registry.js';
import type { AiProvider } from './types.js';

export interface CreateAiRegistryOptions {
  openaiApiKey?: string | undefined;
  anthropicApiKey?: string | undefined;
  /** Force the deterministic fake provider (tests / offline). */
  forceFake?: boolean | undefined;
}

/** Build a failover-aware provider registry from environment configuration. */
export function createAiRegistry(options: CreateAiRegistryOptions): AiProvider {
  if (options.forceFake || (!options.openaiApiKey && !options.anthropicApiKey)) {
    return new AiProviderRegistry([new FakeAiProvider()]);
  }

  const providers: AiProvider[] = [];
  if (options.openaiApiKey) {
    providers.push(new OpenAiProvider(options.openaiApiKey));
  }
  if (options.anthropicApiKey) {
    const embedFallback = options.openaiApiKey
      ? new OpenAiProvider(options.openaiApiKey)
      : new FakeAiProvider();
    providers.push(new AnthropicProvider(options.anthropicApiKey, embedFallback));
  }
  // Always keep fake as last-resort degraded mode so interactive UX survives.
  providers.push(new FakeAiProvider());
  return new AiProviderRegistry(providers);
}
