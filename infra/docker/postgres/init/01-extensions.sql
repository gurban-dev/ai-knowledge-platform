-- Bootstrap extensions required by the platform.
-- Runs automatically on first container start (empty data volume).

-- Vector similarity search for embeddings (RAG).
CREATE EXTENSION IF NOT EXISTS vector;

-- Trigram indexes power lexical / fuzzy search used in hybrid retrieval.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Deterministic UUID helpers (Prisma also generates ids, this is a safety net).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the test database used by the integration suite.
-- (CREATE DATABASE cannot run inside a transaction / DO block, so we guard with \gexec.)
SELECT 'CREATE DATABASE akp_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'akp_test')\gexec

-- Enable the same extensions inside the test database.
\connect akp_test
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
