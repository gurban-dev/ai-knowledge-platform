# Architecture

This document describes the system design, the reasoning behind key decisions, and the
conventions every contributor is expected to follow.

## Goals & non-functional requirements

- **Production-ready, not a prototype.** Every feature ships with UI/API, persistence,
  validation, tests, docs, error handling, logging, and monitoring.
- **Secure by default.** OWASP-aligned auth, MFA, least-privilege RBAC, document ACLs,
  tenant isolation (repository scoping + Postgres RLS), field encryption, prompt-injection
  guards, PII redaction, full audit trails (append-only).
- **Observable.** Structured logs, Prometheus metrics (HTTP + AI), distributed tracing,
  health probes, and SLO definitions.
- **Scalable & maintainable.** Stateless API, Redis-backed queues/rate limits, feature-based
  modules, provider failover, plan quotas and spend budgets.

## High-level topology

```
          ┌───────────┐        ┌──────────────────┐
Browser ─▶ │  Next.js  │ ─────▶ │   Fastify  API   │ ─┬─▶ PostgreSQL + pgvector (+ RLS)
          │  (web)    │  REST  │  (apps/api)      │  │
          └───────────┘  /SSE  └──────────────────┘  ├─▶ Redis (cache, rate limit, BullMQ)
                                        │             │
AI agents ─── MCP / API key ────────────┤             └─▶ BullMQ workers (apps/worker)
                                        │                     │
                                   apps/mcp                   ├─ ingest / embed
                                                              ├─ webhook delivery
                                                              └─ retention sweep
                                              OpenAI / Anthropic / Fake (failover registry)
                                              Local FS or GCS object storage
```

## Packages

- `@akp/core` — errors, Result, ids, RBAC, scopes, redaction, encryption, PII, prompt-guard
- `@akp/config` — Zod-validated env → typed `AppConfig`
- `@akp/observability` — pino, OTEL preload, Prometheus `AppMetrics`
- `@akp/db` — Prisma schema/migrations/client, vector helpers
- `@akp/ai` — providers, registry/failover, chunking, RRF fusion, grounding, prompts, pricing
- `@akp/storage` — local + GCS object storage adapters

## API layering

```
routes (HTTP + Zod) → services (use-cases) → repositories (Prisma only)
```

Composition root: `apps/api/src/container.ts`.

## AuthN / AuthZ

- Passwords: Argon2id
- Access JWT (15m) + opaque refresh with rotation + reuse detection
- MFA (TOTP, encrypted secret, recovery codes)
- API keys: hashed, scoped, optional IP allowlist + per-key rate limit
- Document ACLs at retrieval time (USER/TEAM/ROLE subjects)
- Postgres RLS via `SET LOCAL app.current_org_id`

## RAG pipeline

1. Embed query
2. Hybrid retrieve (pgvector ANN + trigram) → Reciprocal Rank Fusion
3. Filter by document ACL
4. Cross-encoder/lexical rerank
5. Grounding check + abstention threshold
6. Prompt-injection scan on user question
7. Generate with versioned prompt; store citations + provenance metadata

## Multi-tenancy & billing

Shared schema + `organizationId`. Entitlements via `subscriptions` (docs/members/keys).
Monthly spend tracked in `budget_periods` with hard-stop enforcement.

## Testing

- Unit: Vitest (services, ACL, crypto, AI helpers)
- Integration: Fastify `inject()` + real Postgres/Redis
- Web E2E: Playwright smoke
