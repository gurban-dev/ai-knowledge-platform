# Architecture

This document describes the system design, the reasoning behind key decisions, and the
conventions every contributor is expected to follow.

## Goals & non-functional requirements

- **Production-ready, not a prototype.** Every feature ships with UI/API, persistence,
  validation, tests, docs, error handling, logging, and monitoring.
- **Secure by default.** OWASP-aligned auth, least-privilege RBAC, tenant isolation,
  input validation and sanitization, secret redaction, full audit trails.
- **Observable.** Structured logs, metrics, distributed tracing, and health probes are
  part of the platform, not an afterthought.
- **Scalable & maintainable.** Stateless API, Redis-backed shared state, feature-based
  modules, clean boundaries, strict TypeScript.

## High-level topology

```
          ┌───────────┐        ┌──────────────────┐
Browser ─▶ │  Next.js  │ ─────▶ │   Fastify  API   │ ─┬─▶ PostgreSQL + pgvector
          │  (web)    │  REST  │  (apps/api)      │  │
          └───────────┘  /WS   └──────────────────┘  ├─▶ Redis (cache, rate limit, queues)
                                        │             │
AI agents ─── MCP / API key ────────────┘             └─▶ BullMQ workers (apps/worker)
                                                            │
                                              OpenAI / Anthropic, embeddings, rerankers
```

All services emit OpenTelemetry traces and Prometheus metrics; logs are JSON via pino.

## Monorepo & dependency graph

pnpm workspaces + Turborepo. Apps depend on packages; packages depend only on `core`/
`config`/`tsconfig`. Turbo encodes the build/test/lint task graph (`test` depends on
`^build`, so workspace packages are compiled before dependents run).

- `@akp/core` — framework-agnostic domain kernel: the error taxonomy (`AppError` +
  machine-readable `ErrorCode`), `Result`, cursor pagination, prefixed ids, the RBAC role
  hierarchy, and log redaction. Has no runtime dependency on any framework.
- `@akp/config` — a single Zod schema validates and coerces all environment variables and
  produces a typed, namespaced `AppConfig`. **Fail-fast**: misconfiguration crashes at boot
  with every problem listed, never at 3am in a code path.
- `@akp/observability` — pino logger factory (with redaction), OpenTelemetry NodeSDK setup,
  and a Prometheus metrics registry.
- `@akp/db` — Prisma schema, generated client singleton, hand-written initial migration
  (including the pgvector HNSW index), and vector (de)serialization helpers.

## API design (`apps/api`)

### Layering

```
routes (HTTP + Zod schemas)      thin: validation, status codes, no business logic
   └─▶ services (use-cases)      business rules, transactions, orchestration
          └─▶ repositories       the ONLY place that touches Prisma
                 └─▶ Prisma      persistence
```

- **Feature modules** (`modules/auth`, `modules/organizations`, `modules/audit`, …) own
  their routes, service, repository, and schemas. This keeps related code together and
  makes the codebase navigable as it grows to dozens of features.
- **Dependency injection** via a single composition root (`container.ts`). Nothing else
  constructs services or repositories, so the entire object graph is explicit and trivially
  swappable in tests.
- **Repository pattern** isolates persistence. `BaseRepository.withTx(tx)` rebinds a
  repository to a Prisma transaction so a service can compose multiple repositories inside
  one atomic `$transaction` (e.g. registration creates org + user + membership atomically).

### Validation & OpenAPI

Zod is the single source of truth. `fastify-type-provider-zod` uses the same schemas for
runtime request validation, response serialization, **and** OpenAPI generation
(`/docs`), so documentation cannot drift from behavior.

### Error handling

All errors funnel through one error boundary (`plugins/error-handler.ts`) which normalizes
domain errors, Zod validation failures, and framework errors into a stable envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "statusCode": 422, "requestId": "req_..." } }
```

5xx errors are logged with full context and their messages masked; 4xx errors are returned
as-is. Every response carries an `x-request-id` for support correlation.

### Cross-cutting plugins

`container` → `error-handler` → `request-context` → `security` (Helmet + strict CORS) →
`auth` → `rate-limit` (Redis-backed) → `swagger` → `metrics`. `fastify-plugin` metadata
enforces inter-plugin dependencies.

## Authentication & authorization

- **Passwords:** Argon2id (memory-hard). Never logged or returned.
- **Access tokens:** short-lived (15 min) stateless HS256 JWTs carrying `sub`, `org`,
  `role`, `sid`. Verified without a DB round-trip.
- **Refresh tokens:** opaque, high-entropy, **hashed at rest** (SHA-256), single-use with
  rotation. Presenting an already-rotated (revoked) refresh token triggers **reuse
  detection**, which revokes the entire session family — the standard OWASP mitigation for
  stolen refresh tokens.
- **RBAC:** a hierarchical role model (`OWNER > ADMIN > MEMBER > VIEWER`) lives in `@akp/core`;
  `fastify.requireRole(role)` enforces "at least this role" as a preHandler.
- **API keys:** organization-scoped, hashed at rest, for programmatic + MCP access (Phase 7).

## Multi-tenancy

Shared-schema isolation: every tenant-scoped table carries `organizationId` (indexed), and
the repository layer is responsible for scoping every query to the caller's organization.
This favors operational simplicity over schema-per-tenant while keeping strong isolation,
provided query scoping is disciplined (hence centralized in repositories).

## Data model highlights

- Application-generated, prefixed ids (`org_`, `usr_`, `doc_`…) — self-describing in logs,
  no cross-type mixups, no dependence on DB sequences.
- `document_chunks.embedding vector(1536)` with an **HNSW** cosine index for ANN search and
  a **GIN trigram** index on content for the lexical half of hybrid retrieval.
- `sessions` model refresh-token lineage (`replacedById`) for reuse detection.
- `usage_events` store cost in **integer micro-USD** to avoid floating-point drift when
  aggregating spend.
- `audit_logs` capture actor, action, resource, IP/UA, and structured metadata.

## Observability

- **Logs:** pino JSON with automatic redaction of credential-bearing fields; per-request
  child loggers keyed by `requestId`.
- **Metrics:** Prometheus at `/metrics` — request duration histogram + counter labeled by
  method, **route template** (not raw path, to bound cardinality), and status; plus default
  Node process metrics.
- **Tracing:** OpenTelemetry auto-instrumentation (http, pg, ioredis, fastify). Initialized
  in a preload before instrumented modules load; exports OTLP when enabled.
- **Health:** `/health/live` (never fails on dependencies — for k8s liveness) and
  `/health/ready` (checks Postgres + Redis — gates traffic).

## Testing strategy

- **Unit tests** (Vitest) for pure logic and services with mocked repositories — fast, no I/O.
- **Integration tests** drive the real Fastify app via `inject()` against a real Postgres +
  Redis, resetting state between tests. They self-skip without `TEST_DATABASE_URL`.
- **Contract/E2E** (Playwright for web) arrive with their respective phases.

## Conventions

- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …).
- Small, composable functions; composition over inheritance.
- Comments explain **intent/trade-offs**, never restate the code.
- Public APIs are documented; every feature is validated, tested, logged, and monitored.
