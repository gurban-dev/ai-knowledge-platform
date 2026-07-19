# ADR 0001 — Shared-schema multi-tenancy with RLS defense-in-depth

## Status
Accepted

## Context
Enterprise customers require strong tenant isolation. Schema-per-tenant increases
operational complexity; shared schema is simpler but risky if a query omits
`organizationId`.

## Decision
Use shared-schema tenancy with:
1. Mandatory `organizationId` on tenant tables
2. Repository-layer scoping as the primary enforcement point
3. Postgres Row-Level Security policies keyed by `app.current_org_id` as defense-in-depth

## Consequences
- Application must set `SET LOCAL app.current_org_id` in request transactions (`withTenant`)
- Migrations/admin jobs leave the GUC unset to operate across tenants
- Slight query planner overhead; acceptable for enterprise isolation guarantees
