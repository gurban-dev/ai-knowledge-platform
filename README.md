# AI Knowledge Automation Platform

A production-grade **B2B SaaS platform** that lets organizations securely connect their
internal knowledge to AI — with first-class observability into retrieval quality,
accuracy, hallucinations, latency, token usage, and cost.

## Status

| Phase | Scope | State |
| ----- | ----- | ----- |
| 0 | Monorepo foundation, shared packages, CI, Docker | ✅ Done |
| 1 | Relational + vector data model (Prisma + pgvector) | ✅ Done |
| 2 | API core: Auth, Orgs, RBAC, Audit, MFA, API keys | ✅ Done |
| 3 | Web app (Next.js): auth, chat, documents, usage | ✅ Done |
| 4 | Ingestion workers (BullMQ), chunking, embeddings | ✅ Done |
| 5 | Hybrid retrieval, reranking, chat, citations, grounding | ✅ Done |
| 6 | Evaluations, usage/cost, budgets, quality signals | ✅ Done |
| 7 | MCP server, webhooks, teams, document ACLs | ✅ Done |
| 8 | Infra: Dockerfiles, k8s, Terraform skeleton, compliance docs | ✅ Done |

See [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
and [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).

## Apps

| App | Path | Port | Command |
| --- | --- | --- | --- |
| API | `apps/api` | 4000 | `pnpm --filter @akp/api dev` |
| Worker | `apps/worker` | — | `pnpm --filter @akp/worker dev` |
| MCP | `apps/mcp` | 4100 | `pnpm --filter @akp/mcp dev` |
| Web | `apps/web` | 3000 | `pnpm --filter @akp/web dev` |

## Getting started

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

Seeded credentials: `owner@acme.test` / `Password123!`

Then run API + worker + web in separate terminals.

## Quality gates

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
```

## License

See [`LICENSE`](LICENSE).
