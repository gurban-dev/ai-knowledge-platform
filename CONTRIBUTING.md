# Contributing

## Prerequisites
- Node.js ≥ 20.11
- pnpm ≥ 9
- Docker (Postgres + Redis)

## Local setup
```bash
corepack enable
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:generate && pnpm db:deploy && pnpm db:seed
```

## Quality gates
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration   # requires TEST_DATABASE_URL
```

## Architecture rules
- Feature modules: `routes → services → repositories`
- Construct services only in `apps/api/src/container.ts`
- Zod schemas are the single source of truth for validation + OpenAPI
- Never store secrets in plaintext; use `FieldEncryptor`
- Every tenant query must scope by `organizationId`

## Apps
| App | Command |
| --- | --- |
| API | `pnpm --filter @akp/api dev` |
| Worker | `pnpm --filter @akp/worker dev` |
| MCP | `pnpm --filter @akp/mcp dev` |
| Web | `pnpm --filter @akp/web dev` |
