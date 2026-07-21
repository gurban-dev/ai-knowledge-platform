# AI Knowledge Automation Platform

A production-grade B2B SaaS platform that lets organizations securely connect their

internal knowledge to AI—with first-class observability into retrieval quality,

accuracy, hallucinations, latency, token usage, and cost.

## Status

| Phase | Scope | State |

|------:|-------|:-----:|

| 0 | Monorepo foundation, shared packages, CI, Docker | ✅ Done |

| 1 | Relational + vector data model (Prisma + pgvector) | ✅ Done |

| 2 | API core: Auth, Orgs, RBAC, Audit, MFA, API keys | ✅ Done |

| 3 | Web app (Next.js): auth, chat, documents, usage | ✅ Done |

| 4 | Ingestion workers (BullMQ), chunking, embeddings | ✅ Done |

| 5 | Hybrid retrieval, reranking, chat, citations, grounding | ✅ Done |

| 6 | Evaluations, usage/cost, budgets, quality signals | ✅ Done |

| 7 | MCP server, webhooks, teams, document ACLs | ✅ Done |

| 8 | Infrastructure: Dockerfiles, Kubernetes, Terraform skeleton, compliance documentation | ✅ Done |

For additional documentation, see:

- `docs/ROADMAP.md`

- `docs/ARCHITECTURE.md`

- `docs/COMPLIANCE.md`

---

# Applications

| Application | Path | Default Port | Description |

|-------------|------|--------------|-------------|

| API | `apps/api` | **4000** | REST API and business logic |

| Worker | `apps/worker` | — | BullMQ background workers |

| Web | `apps/web` | **3000** | Next.js frontend |

| MCP *(optional)* | `apps/mcp` | **4100** | Model Context Protocol server |

---

# Getting Started

## Prerequisites

- Node.js 20+

- pnpm 9+

- Docker & Docker Compose

- PostgreSQL (or Docker)

- Redis (or Docker)

## Initial Setup

Run the following commands from the repository root:

```bash

corepack enable

pnpm install

cp .env.example .env

pnpm docker:up

pnpm db:generate

pnpm db:deploy

pnpm db:seed

```

### Seeded Development Credentials

| Email | Password |

|--------|----------|

| `owner@acme.test` | `Password123!` |

| `member@acme.test` | `Password123!` |

---

# Running the Development Environment

Start the complete development environment with a single command:

```bash

pnpm dev

```

This launches all development services concurrently using Turborepo.

Once the development environment has started successfully, the following services will be available:

| Service | URL |

|---------|-----|

| Web Application | [http://localhost:3000](http://localhost:3000) |

| REST API | [http://localhost:4000](http://localhost:4000) |

| API Documentation (Swagger) | [http://localhost:4000/docs](http://localhost:4000/docs) |

| MCP Server *(optional)* | [http://localhost:4100](http://localhost:4100) |

| BullMQ Worker | Background process (no HTTP endpoint) |

To stop all services, press:

```text

Ctrl+C

```

---

# Running Individual Services

If you only need to work on a single component, each application can be started independently.

| Service | Command |

|---------|---------|

| API | `pnpm --filter @akp/api dev` |

| Worker | `pnpm --filter @akp/worker dev` |

| Web | `pnpm --filter @akp/web dev` |

| MCP *(optional)* | `pnpm --filter @akp/mcp dev` |

---

# Quality Gates

Before opening a pull request, run the project's quality checks.

```bash

pnpm typecheck

pnpm lint

pnpm test

pnpm test:integration

```

---

# License

See the [LICENSE](LICENSE) file.