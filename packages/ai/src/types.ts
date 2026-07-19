/** Shared AI provider contracts used by API and workers. */

export interface EmbeddingRequest {
  texts: string[];
  model: string;
  dimensions: number;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  promptTokens: number;
  latencyMs: number;
  costMicros: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costMicros: number;
  finishReason: string;
}

export interface RerankRequest {
  query: string;
  documents: string[];
  topN: number;
  model?: string;
}

export interface RerankHit {
  index: number;
  score: number;
}

export interface RerankResult {
  hits: RerankHit[];
  model: string;
  latencyMs: number;
  costMicros: number;
}

export interface AiProvider {
  readonly name: string;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
  chat(request: ChatRequest): Promise<ChatResult>;
  rerank(request: RerankRequest): Promise<RerankResult>;
}

export interface ProviderHealth {
  name: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}
