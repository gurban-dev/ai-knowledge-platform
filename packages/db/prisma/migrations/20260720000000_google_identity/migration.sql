-- Link user accounts to a Google OAuth identity.
-- Nullable: password and other federated accounts leave it NULL.
-- Unique: a given Google subject maps to exactly one user.
ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;

CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");
