# Compliance & Governance Control Matrix

This document maps enterprise compliance expectations to controls implemented in
the AI Knowledge Automation Platform. It is not a certification; it is the
engineering evidence pack for SOC 2 / ISO 27001 / GDPR / HIPAA readiness reviews.

| Control area | Requirement | Implementation |
| --- | --- | --- |
| Access control | Least-privilege RBAC | `OWNER/ADMIN/MEMBER/VIEWER` in `@akp/core`; `requireRole` preHandlers |
| MFA | Interactive MFA for privileged tenants | TOTP MFA module; org `requireMfa` + global `SECURITY_REQUIRE_MFA` |
| SSO / provisioning | Enterprise identity | SSO connections schema + SCIM tokens schema; org `allowSso` |
| Tenant isolation | No cross-tenant data access | Repository scoping + Postgres RLS (`app.current_org_id`) |
| Document ACLs | Retrieval respects internal permissions | `document_acls` + ACL filter in hybrid search |
| Secrets at rest | Encrypt connector/MFA/webhook secrets | AES-256-GCM `FieldEncryptor` with key rotation |
| Audit trail | Tamper-evident logging | Append-only DB triggers on `audit_logs` |
| Data residency | Region pinning | Org setting `dataResidencyRegion` |
| Retention | Configurable retention | Org `retentionDays` + retention sweep worker |
| PII/DLP | Reduce sensitive content exposure | `@akp/core` PII redact at ingest when enabled |
| Prompt injection | OWASP LLM01 | `scanForInjection` on chat questions |
| Provider retention | No training by default | Org `allowModelTraining=false` default |
| Budget / cost | Spend controls | Subscriptions + `BudgetPeriod` hard-stop |
| Subprocessors | AI providers documented | OpenAI/Anthropic via provider registry; fake fallback |
| Backup / DR | Reported restore posture | `/v1/operations/incident-response` reads `BACKUP_*` env |
| Observability | Detect abuse & outages | Prometheus `/metrics`, OTEL, SLO endpoint |

## GDPR / CCPA notes

- Soft-delete documents (`deleted_at`) and cascade chunk deletion on admin delete.
- Export/delete workflows should be operated via admin APIs + retention sweep.
- Subprocessor list must be disclosed in customer DPAs (OpenAI/Anthropic/GCP).

## HIPAA notes

- Enable `piiRedactionEnabled`, `requireMfa`, SSO, and region pinning for PHI tenants.
- Execute a BAA with subprocessors before PHI ingestion.
- Prefer private networking + CMEK for Cloud SQL / GCS in production Terraform.
