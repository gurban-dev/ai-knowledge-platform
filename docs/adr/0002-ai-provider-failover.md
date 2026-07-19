# ADR 0002 — AI provider registry with circuit-breaker failover

## Status
Accepted

## Context
Chat and embedding calls depend on external LLM providers. Single-provider outages
must not take down interactive product surfaces.

## Decision
Introduce `@akp/ai` `AiProviderRegistry`:
- Ordered provider list (OpenAI → Anthropic → Fake)
- Circuit breaker per provider
- Deterministic `FakeAiProvider` for CI/offline and last-resort degraded mode

## Consequences
- Cost accounting remains accurate per provider/model
- Fake fallback may reduce answer quality; UI should surface degraded mode when used
- Embedding dimension/model changes require re-embed jobs (`embedding_model`/`embedding_version`)
