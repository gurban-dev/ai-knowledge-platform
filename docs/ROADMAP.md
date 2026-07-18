# Roadmap

The platform is delivered in vertical slices. Each slice is complete — UI, API, database,
validation, tests, docs, error handling, logging, monitoring — before the next begins.

## ✅ Phase 0 — Foundation

- pnpm + Turborepo monorepo, strict shared TS/ESLint configs, Prettier, EditorConfig.
- `@akp/core`, `@akp/config`, `@akp/observability` shared packages (with unit tests).
- Docker Compose (Postgres+pgvector, Redis), Postgres init (extensions + test DB).
- GitHub Actions CI: lint · typecheck · unit · integration (with service containers).

## ✅ Phase 1 — Data model

- Complete Prisma schema: organizations, users, memberships, sessions, API keys, invites,
  data sources, documents, vector chunks, conversations, messages, citations, ingestion
  jobs, evaluations, usage events, audit logs.
- pgvector `vector(1536)` column with HNSW cosine index; GIN trigram index for lexical search.
- Hand-authored initial migration; idempotent dev seed.

## ✅ Phase 2 — API core + Auth/Org/RBAC/Audit

- Fastify app factory, DI container, repository pattern, request context.
- Plugins: security (Helmet/CORS), Redis rate limiting, OpenAPI/Swagger, Prometheus metrics,
  central error boundary.
- Health probes (`/health/live`, `/health/ready`), `/metrics`.
- **Auth:** register (org + owner), login, refresh with rotation + reuse detection, logout,
  `/me`. Argon2id passwords, hashed refresh tokens, JWT access tokens.
- **Organizations:** current org, member directory (RBAC-gated).
- **Audit:** typed action catalog, best-effort audit recording.
- Unit tests (crypto, JWT, slug, auth service) + integration tests (full auth flow, RBAC).

## ⏳ Phase 3 — Web application

- Next.js App Router, Tailwind + shadcn/ui, React Query + Zustand, RHF + Zod.
- Auth flows (login/register/refresh), protected routes, org switcher.
- Admin shell: members, audit log viewer, org settings.
- Accessibility (WCAG AA), responsive layout, Playwright E2E.

## ⏳ Phase 4 — Ingestion & workers

- Data source connectors (upload first; then Drive/Notion/Confluence/GitHub/Slack).
- BullMQ queues + workers, `apps/worker`, retry/backoff, dead-letter handling.
- Document parsing, content-hash dedup, chunking strategies, embedding generation.
- Ingestion status + observability; usage/cost accounting.

## ⏳ Phase 5 — Retrieval & chat

- Hybrid retrieval (pgvector ANN + trigram lexical) with score fusion.
- Cross-encoder reranking. Prompt templates, conversation memory.
- Streaming chat over WebSockets/SSE with inline **citations** and spans.

## ⏳ Phase 6 — Evaluation & quality

- Evaluation runs: faithfulness, answer relevance, context precision/recall.
- Hallucination detection; regression tracking over time.
- Quality dashboards (Recharts): retrieval quality, latency, tokens, cost.

## ⏳ Phase 7 — MCP server & tools

- MCP server exposing org knowledge + tools to AI agents, secured by API keys + scopes.
- Tool registry, per-tool authorization, audit of agent actions.

## ⏳ Phase 8 — Infrastructure & hardening

- Dockerfiles per service, NGINX reverse proxy.
- Terraform (GCP): Cloud SQL, Memorystore, GKE, secrets.
- Kubernetes manifests, HPA, readiness/liveness wiring, blue/green.
- Load testing, security review, SLOs + alerting.
