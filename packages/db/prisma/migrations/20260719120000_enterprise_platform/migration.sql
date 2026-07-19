-- Enterprise platform expansion: document ACL, teams, collections, prompts,
-- object storage, SSO/SCIM, billing/budgets, MCP tool audit, and Postgres RLS
-- as defense-in-depth for multi-tenant isolation.

-- ------------------------------- Enums -------------------------------------
CREATE TYPE "AclSubjectType" AS ENUM ('USER', 'TEAM', 'ROLE');
CREATE TYPE "AclPermission" AS ENUM ('READ', 'WRITE', 'ADMIN');
CREATE TYPE "CollectionVisibility" AS ENUM ('PRIVATE', 'TEAM', 'ORGANIZATION');
CREATE TYPE "SsoProvider" AS ENUM ('OIDC', 'SAML');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED');
CREATE TYPE "ToolSideEffect" AS ENUM ('READ', 'WRITE', 'DESTRUCTIVE');
CREATE TYPE "ToolInvocationStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'DENIED');

-- ------------------------------ documents ----------------------------------
ALTER TABLE "documents"
  ADD COLUMN "stored_object_id" TEXT,
  ADD COLUMN "chunking_strategy" TEXT NOT NULL DEFAULT 'recursive-v1',
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "documents_organization_id_deleted_at_idx" ON "documents"("organization_id", "deleted_at");

-- -------------------------- document_versions ------------------------------
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL DEFAULT 0,
    "stored_object_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "document_versions_document_id_version_key" ON "document_versions"("document_id", "version");
CREATE INDEX "document_versions_organization_id_document_id_idx" ON "document_versions"("organization_id", "document_id");

-- ----------------------------- document_acls -------------------------------
CREATE TABLE "document_acls" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "subject_type" "AclSubjectType" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "permission" "AclPermission" NOT NULL DEFAULT 'READ',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_acls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "document_acls_document_id_subject_type_subject_id_key" ON "document_acls"("document_id", "subject_type", "subject_id");
CREATE INDEX "document_acls_organization_id_subject_type_subject_id_idx" ON "document_acls"("organization_id", "subject_type", "subject_id");

-- --------------------------------- teams -----------------------------------
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "team_memberships_team_id_user_id_key" ON "team_memberships"("team_id", "user_id");
CREATE INDEX "team_memberships_user_id_idx" ON "team_memberships"("user_id");

-- ------------------------------ collections --------------------------------
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "team_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "CollectionVisibility" NOT NULL DEFAULT 'ORGANIZATION',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collections_organization_id_slug_key" ON "collections"("organization_id", "slug");
CREATE INDEX "collections_organization_id_idx" ON "collections"("organization_id");

CREATE TABLE "collection_documents" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collection_documents_collection_id_document_id_key" ON "collection_documents"("collection_id", "document_id");
CREATE INDEX "collection_documents_document_id_idx" ON "collection_documents"("document_id");

-- --------------------------- prompt_templates ------------------------------
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "system_prompt" TEXT NOT NULL,
    "user_prompt_tpl" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prompt_templates_organization_id_slug_version_key" ON "prompt_templates"("organization_id", "slug", "version");
CREATE INDEX "prompt_templates_organization_id_slug_is_active_idx" ON "prompt_templates"("organization_id", "slug", "is_active");

-- ---------------------------- stored_objects -------------------------------
CREATE TABLE "stored_objects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL DEFAULT 0,
    "content_hash" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stored_objects_organization_id_storage_key_key" ON "stored_objects"("organization_id", "storage_key");
CREATE INDEX "stored_objects_organization_id_content_hash_idx" ON "stored_objects"("organization_id", "content_hash");

ALTER TABLE "documents" ADD CONSTRAINT "documents_stored_object_id_fkey"
  FOREIGN KEY ("stored_object_id") REFERENCES "stored_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------- sso_connections ------------------------------
CREATE TABLE "sso_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "SsoProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret_ciphertext" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowed_domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sso_connections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sso_connections_organization_id_enabled_idx" ON "sso_connections"("organization_id", "enabled");

-- ------------------------------ scim_tokens --------------------------------
CREATE TABLE "scim_tokens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scim_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "scim_tokens_token_hash_key" ON "scim_tokens"("token_hash");
CREATE INDEX "scim_tokens_organization_id_idx" ON "scim_tokens"("organization_id");

-- ----------------------------- subscriptions -------------------------------
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "external_customer_id" TEXT,
    "external_subscription_id" TEXT,
    "max_documents" INTEGER NOT NULL DEFAULT 1000,
    "max_members" INTEGER NOT NULL DEFAULT 25,
    "max_api_keys" INTEGER NOT NULL DEFAULT 10,
    "monthly_budget_micros" BIGINT,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- ----------------------------- budget_periods ------------------------------
CREATE TABLE "budget_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "spent_micros" BIGINT NOT NULL DEFAULT 0,
    "budget_micros" BIGINT,
    "alerted_at" TIMESTAMP(3),
    "hard_stopped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "budget_periods_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "budget_periods_organization_id_period_key" ON "budget_periods"("organization_id", "period");

-- --------------------------- tool_invocations ------------------------------
CREATE TABLE "tool_invocations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "side_effect" "ToolSideEffect" NOT NULL,
    "status" "ToolInvocationStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "arguments" JSONB NOT NULL DEFAULT '{}',
    "result_summary" TEXT,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tool_invocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tool_invocations_organization_id_created_at_idx" ON "tool_invocations"("organization_id", "created_at");
CREATE INDEX "tool_invocations_organization_id_tool_name_created_at_idx" ON "tool_invocations"("organization_id", "tool_name", "created_at");

-- ----------------------------- Foreign keys --------------------------------
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_acls" ADD CONSTRAINT "document_acls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_acls" ADD CONSTRAINT "document_acls_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collections" ADD CONSTRAINT "collections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collections" ADD CONSTRAINT "collections_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "collection_documents" ADD CONSTRAINT "collection_documents_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_documents" ADD CONSTRAINT "collection_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sso_connections" ADD CONSTRAINT "sso_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scim_tokens" ADD CONSTRAINT "scim_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -------------------- Row-Level Security (defense-in-depth) ----------------
-- Application sets `SET LOCAL app.current_org_id = '<orgId>'` per transaction.
-- Policies allow rows where organization_id matches the session GUC, or when
-- the GUC is unset (migration/admin scripts and the bootstrap path).

CREATE OR REPLACE FUNCTION akp_current_org_id() RETURNS text AS $$
  SELECT nullif(current_setting('app.current_org_id', true), '');
$$ LANGUAGE sql STABLE;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'documents', 'document_chunks', 'document_acls', 'document_versions',
    'data_sources', 'conversations', 'messages', 'citations',
    'ingestion_jobs', 'evaluations', 'evaluation_results', 'usage_events',
    'audit_logs', 'api_keys', 'invites', 'memberships',
    'webhook_endpoints', 'webhook_deliveries', 'message_feedback',
    'idempotency_keys', 'teams', 'collections', 'prompt_templates',
    'stored_objects', 'sso_connections', 'scim_tokens', 'subscriptions',
    'budget_periods', 'tool_invocations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I
         USING (akp_current_org_id() IS NULL OR organization_id = akp_current_org_id())
         WITH CHECK (akp_current_org_id() IS NULL OR organization_id = akp_current_org_id())',
      tbl || '_tenant_isolation',
      tbl
    );
  END LOOP;
END $$;

-- evaluation_results and citations/messages don't always carry organization_id
-- directly — evaluation_results is scoped via evaluation; citations via message.
-- Drop incorrect policies if the loop applied to tables without organization_id.
DROP POLICY IF EXISTS evaluation_results_tenant_isolation ON evaluation_results;
DROP POLICY IF EXISTS citations_tenant_isolation ON citations;
ALTER TABLE evaluation_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE citations DISABLE ROW LEVEL SECURITY;
