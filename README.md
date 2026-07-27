# AI Knowledge Automation Platform

A production-grade B2B SaaS platform that lets organizations securely connect their

internal knowledge to AI—with first-class observability into retrieval quality,

accuracy, hallucinations, latency, token usage, and cost.

## Status

| Phase | Scope | State |

|------:|-------|:-----:|

| 0 | Monorepo foundation, shared packages, CI, Docker | ✅ Done |

| 1 | Relational + vector data model (Prisma + pgvector) | ✅ Done |

| 2 | API core: Auth (email + Google OAuth), Orgs, RBAC, Audit, MFA, API keys | ✅ Done |

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

### Sign in with Google (optional)

Users can register and sign in with a Google account in addition to email + password.
The flow is disabled by default until credentials are configured.

**Security (production):** Authorization Code + PKCE (S256) for the redirect
callback path, plus Google Identity Services (GIS) button credentials verified
via JWKS. OAuth state is HMAC-signed and bound to the exact callback URL. MFA is
enforced for accounts that have it enabled.

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth 2.0 Client ID** of type **Web application**.

2. Add origins and redirect URIs for your environment:

| Environment | Authorized JavaScript origins | Authorized redirect URI |
|-------------|-------------------------------|-------------------------|
| Local | `http://localhost:3000` | `http://localhost:3000/api/auth/google/callback` |
| Production | `https://your-web-domain` | `https://your-web-domain/api/auth/google/callback` |

3. Ensure `WEB_PUBLIC_URL` (and the browser origin) match that web domain exactly —
   the API allowlists only `{WEB_PUBLIC_URL}/api/auth/google/callback`.

4. Put the values in your `.env` (then restart `pnpm dev` / redeploy):

```bash
WEB_PUBLIC_URL=http://localhost:3000   # or https://your-web-domain in production
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

5. Open `/login` or `/register` and click **Continue with Google** /
   **Sign up with Google**. An in-page modal opens with Google's account button;
   choosing an account creates (or signs into) your organization.

Without `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, the button still opens the
modal and shows a clear configuration error. With credentials set, first-time
Google users get a new organization provisioned automatically; returning users
are signed straight in. A first Google sign-in for an email that already has a
password account links the two (Google must report the email as verified).
Accounts with MFA enabled are challenged after Google before a session is issued.

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