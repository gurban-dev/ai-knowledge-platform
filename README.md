# AI Knowledge Automation Platform

A production-grade **B2B SaaS platform** that lets organizations securely connect their
internal knowledge (docs, wikis, Drive, Notion, Confluence, GitHub, Slack, databases,
internal APIs) to AI — with first-class **observability into retrieval quality, accuracy,
hallucinations, latency, token usage, and cost**.

> This is not a demo or tutorial. It is built as real production software: strict
> TypeScript, clean feature-based architecture, dependency injection, the repository
> pattern, comprehensive validation, structured logging, metrics, tracing, audit trails,
> and automated tests, all wired into CI.

---

## Status

The platform is being built in coherent, production-grade vertical slices. Each slice is
complete (schema → API → validation → tests → docs → observability) before the next begins.

| Phase | Scope | State |
| ----- | ----- | ----- |
| 0 | Monorepo foundation, shared packages (`core`, `config`, `observability`), CI, Docker | ✅ Done |
| 1 | Full relational + vector data model (Prisma + pgvector) | ✅ Done |
| 2 | API core: Fastify app, plugins, error handling, OpenAPI, health/metrics, **Auth + Organizations + RBAC + Audit** | ✅ Done |
| 3 | Web app (Next.js): auth flows, org/member management, admin shell | ⏳ Next |
| 4 | Knowledge ingestion + workers (BullMQ), chunking, embeddings | ⏳ Planned |
| 5 | Retrieval (hybrid vector + lexical), reranking, streaming chat, citations | ⏳ Planned |
| 6 | Evaluation framework, hallucination detection, quality dashboards | ⏳ Planned |
| 7 | MCP server, API keys, tool exposure | ⏳ Planned |
| 8 | Infra: Terraform (GCP), Kubernetes manifests, NGINX, autoscaling | ⏳ Planned |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for detail and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the system design.

---

## Tech stack

**Backend:** Node.js · Fastify · TypeScript (strict) · Zod · Prisma · PostgreSQL + pgvector ·
Redis · BullMQ · JWT/OAuth · OpenAPI/Swagger
**Frontend:** Next.js (App Router) · React · TypeScript · Tailwind · shadcn/ui · React Query ·
Zustand · React Hook Form · Recharts
**AI:** OpenAI · Anthropic · RAG · hybrid retrieval · cross-encoder reranking · MCP
**Observability:** OpenTelemetry · Prometheus metrics · pino structured logs · Sentry · health probes
**Infra:** Docker · Docker Compose · GitHub Actions · Terraform · GCP · Kubernetes-ready · NGINX
**Testing:** Vitest · Supertest-style `inject` integration tests · Playwright (web)

---

## Repository layout

```
apps/
  api/            Fastify REST + WS API (feature modules, DI, repositories)
  web/            Next.js frontend            (Phase 3)
  worker/         BullMQ background workers    (Phase 4)
packages/
  core/           Framework-agnostic domain kernel (errors, Result, ids, RBAC, redaction)
  config/         Zod-validated, typed environment configuration (fail-fast)
  observability/  pino logging, OpenTelemetry tracing, Prometheus metrics
  db/             Prisma schema, client, migrations, pgvector helpers, seed
  tsconfig/       Shared strict TypeScript configs
  eslint-config/  Shared flat ESLint config
infra/
  docker/         Postgres init scripts, service Dockerfiles
  terraform/      GCP infrastructure           (Phase 8)
  k8s/            Kubernetes manifests          (Phase 8)
```

---

## Getting started

### Prerequisites

- **Node.js ≥ 20.11** (`nvm use` respects `.nvmrc`)
- **pnpm ≥ 9** (`corepack enable`)
- **Docker** + Docker Compose (for Postgres + Redis)

### 1. Install & configure

```bash
corepack enable
pnpm install
cp .env.example .env        # adjust secrets as needed
```

### 2. Start infrastructure

```bash
pnpm docker:up              # Postgres (pgvector) + Redis
```

### 3. Prepare the database

```bash
pnpm db:generate            # generate the Prisma client
pnpm db:deploy              # apply migrations
pnpm db:seed                # optional: demo org + users
```

Seeded credentials (development only):

- `owner@acme.test` / `Password123!`
- `member@acme.test` / `Password123!`

### 4. Run the API

```bash
pnpm --filter @akp/api dev
```

- API: <http://localhost:4000>
- Interactive OpenAPI docs: <http://localhost:4000/docs>
- Liveness: <http://localhost:4000/health/live> · Readiness: `/health/ready` · Metrics: `/metrics`

---

## Quality gates

```bash
pnpm typecheck          # strict TypeScript across all packages
pnpm lint               # ESLint (flat config, type-aware)
pnpm test               # unit tests (Vitest) — builds deps first via Turbo
pnpm test:integration   # integration tests (require a running Postgres + TEST_DATABASE_URL)
pnpm format:check       # Prettier
```

Integration tests **self-skip** unless `TEST_DATABASE_URL` is set, so a fresh checkout and
the unit suite stay green without infrastructure. CI (`.github/workflows/ci.yml`) runs the
full matrix including a real Postgres + Redis.

---

## Example: register and call the API

```bash
# Create an organization + owner
curl -sX POST http://localhost:4000/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"admin@corp.com","password":"Sup3rSecret!","name":"Admin","organizationName":"Corp"}'

# -> { user, organization, role: "OWNER", tokens: { accessToken, refreshToken, ... } }

# Use the access token
curl -s http://localhost:4000/v1/auth/me -H "authorization: Bearer <accessToken>"
```

## License

See [`LICENSE`](LICENSE).
