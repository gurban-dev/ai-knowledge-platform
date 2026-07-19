# Roadmap

Vertical slices are complete when UI/API/DB/validation/tests/docs/observability ship together.

## ✅ Phase 0–2 — Foundation, data model, auth/org/RBAC/audit/MFA/API keys

## ✅ Phase 3 — Web application
- Next.js App Router, Tailwind, React Query, RHF + Zod
- Auth BFF (httpOnly cookies), chat/documents/search/usage/settings
- Playwright smoke test

## ✅ Phase 4 — Ingestion & workers
- BullMQ ingest/webhook/maintenance workers
- Chunking (`recursive-v1`), embeddings, PII redaction, usage accounting

## ✅ Phase 5 — Retrieval & chat
- Hybrid retrieval (pgvector + trigram) with RRF + rerank
- Grounding/abstention, prompt-injection scan, SSE chat + citations
- Document ACLs enforced at retrieval

## ✅ Phase 6 — Evaluation, usage, budgets
- Evaluation persistence + summary metrics
- Usage summary API, subscription entitlements, hard budget stops

## ✅ Phase 7 — MCP, webhooks, teams
- MCP HTTP tool server with scopes + invocation audit + rate limits
- Outbound webhooks with HMAC signatures
- Teams for ACL subjects

## ✅ Phase 8 — Infrastructure & hardening
- Dockerfiles, k8s manifests, Terraform GCP skeleton
- Compliance matrix, ADRs, RLS, encryption, CI quality gates

## Follow-ups (intentionally deferred)
- Full SAML assertion validation / Okta certification pack
- Stripe Checkout UI + customer portal
- Dedicated vector DB failover beyond pgvector scaling guide
- Native `@modelcontextprotocol/sdk` stdio transport (HTTP MCP ships today)
