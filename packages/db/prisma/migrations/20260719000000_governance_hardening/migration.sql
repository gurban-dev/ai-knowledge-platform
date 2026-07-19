-- Governance & production-hardening migration
-- Adds: MFA, API-key hardening, encrypted connector secrets, embedding
-- provenance, BigInt cost/size columns, webhooks, answer feedback, idempotency,
-- and audit-log immutability enforcement.

-- ------------------------------- Enums -------------------------------------
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'DEAD');
CREATE TYPE "FeedbackRating" AS ENUM ('UP', 'DOWN');
CREATE TYPE "FeedbackReason" AS ENUM ('INCORRECT', 'INCOMPLETE', 'OUTDATED', 'UNSAFE', 'OTHER');
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- ------------------------------- users -------------------------------------
ALTER TABLE "users"
  ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfa_secret" TEXT,
  ADD COLUMN "mfa_recovery_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "mfa_verified_at" TIMESTAMP(3);

-- ------------------------------ api_keys -----------------------------------
ALTER TABLE "api_keys"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "rate_limit_per_minute" INTEGER,
  ADD COLUMN "ip_allowlist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "last_rotated_at" TIMESTAMP(3);

-- ---------------------------- data_sources ---------------------------------
ALTER TABLE "data_sources"
  ADD COLUMN "secret_ciphertext" TEXT,
  ADD COLUMN "sync_cursor" TEXT;

-- ------------------------------ documents ----------------------------------
ALTER TABLE "documents"
  ALTER COLUMN "byte_size" SET DATA TYPE BIGINT USING "byte_size"::BIGINT;

-- --------------------------- document_chunks -------------------------------
ALTER TABLE "document_chunks"
  ADD COLUMN "embedding_model" TEXT,
  ADD COLUMN "embedding_version" INTEGER NOT NULL DEFAULT 1;

-- ----------------------------- usage_events --------------------------------
ALTER TABLE "usage_events"
  ADD COLUMN "user_id" TEXT,
  ALTER COLUMN "total_tokens" SET DATA TYPE BIGINT USING "total_tokens"::BIGINT,
  ALTER COLUMN "cost_micros" SET DATA TYPE BIGINT USING "cost_micros"::BIGINT;

-- --------------------------- webhook_endpoints -----------------------------
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "secret_ciphertext" TEXT NOT NULL,
    "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "webhook_endpoints_organization_id_status_idx" ON "webhook_endpoints"("organization_id", "status");

-- --------------------------- webhook_deliveries ----------------------------
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "response_status" INTEGER,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "webhook_deliveries_organization_id_status_idx" ON "webhook_deliveries"("organization_id", "status");
CREATE INDEX "webhook_deliveries_status_next_attempt_at_idx" ON "webhook_deliveries"("status", "next_attempt_at");

-- ---------------------------- message_feedback -----------------------------
CREATE TABLE "message_feedback" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "reason" "FeedbackReason",
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_feedback_message_id_user_id_key" ON "message_feedback"("message_id", "user_id");
CREATE INDEX "message_feedback_organization_id_rating_created_at_idx" ON "message_feedback"("organization_id", "rating", "created_at");

-- ---------------------------- idempotency_keys -----------------------------
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idempotency_keys_organization_id_key_key" ON "idempotency_keys"("organization_id", "key");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- ----------------------------- Foreign keys --------------------------------
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -------------------- Audit-log immutability (WORM) ------------------------
-- Compliance requires a tamper-evident audit trail. Enforce append-only at the
-- database so an application bug (or a compromised app credential) cannot alter
-- or delete history. INSERTs remain allowed.
CREATE OR REPLACE FUNCTION "akp_prevent_audit_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "akp_prevent_audit_mutation"();

CREATE TRIGGER "audit_logs_no_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "akp_prevent_audit_mutation"();
