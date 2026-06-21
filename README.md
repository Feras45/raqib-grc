# Raqib · رقيب — Saudi GRC (Vercel SaaS)

NCA ECC / SAMA CSF assessment platform. Server-side auth, TOTP MFA, role-based
access control, AI advisor and evidence analysis proxied through your own
Anthropic key. Single organization per deployment.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite (static SPA) |
| Backend | Vercel serverless functions (`/api/*`, Node ESM) |
| Database | Neon Postgres (serverless driver) |
| Auth | scrypt passwords, HS256 httpOnly session cookie, RFC 6238 TOTP |
| AI | Anthropic Messages API, key held server-side only |

## What you do vs what is done

The repo is deployable as-is. You provision the database, set four secrets, and
deploy. I cannot deploy for you (no access to your Vercel, Neon, or keys), and
entering credentials is yours to do.

## Prerequisites

Node 18+ locally, a Vercel account, a Neon Postgres database (Vercel → Storage →
Neon, or neon.tech), and an Anthropic API key.

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables (and in a local
`.env` for `vercel dev`). Generate the two random secrets with `openssl rand -hex 32`.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (`...?sslmode=require`) |
| `SESSION_SECRET` | 32+ char random hex. Signs session/challenge tokens |
| `DATA_ENC_KEY` | Exactly 64 hex chars (32 bytes). AES-256-GCM key for MFA secrets at rest |
| `ANTHROPIC_API_KEY` | `sk-ant-...`. Never shipped to the browser |

## Deploy

1. Push this repo to GitHub (or run `vercel` from the project root).
2. Create the Neon database and copy its pooled `DATABASE_URL`.
3. Add the four environment variables above in Vercel.
4. Initialize the schema once: `DATABASE_URL="..." npm run db:init` (applies `schema.sql`). You can also run `psql "$DATABASE_URL" -f schema.sql`.
5. Deploy (`git push` to the connected branch, or `vercel --prod`).
6. Open the deployed URL. The first visit shows First-Run and creates the admin account. After that the route shows Login.

## Local development

```
npm install
# put the four vars in .env
vercel dev        # serves /api functions on :3000
npm run dev       # Vite on :5173, proxies /api → :3000
```

`npm test` runs the offline suites: 28 crypto tests (scrypt round-trip, token
tamper/expiry, RFC 6238 TOTP vectors, base32, AES-GCM, recovery codes) and 68
domain-logic tests (parsing, normalization, RBAC, scoring, import, report).

## Auth and roles

First-Run creates the admin. Admins add users in the Users view with role
admin, manager, assessor, or viewer. Every endpoint re-checks the role
server-side; the UI gating is cosmetic on top of that. assessor edits enter a
pending state and require manager/admin approval. Lockout triggers after eight
failed attempts for fifteen minutes, tracked in the database so it holds across
serverless instances.

MFA is per-user, enrolled in Settings: scan the QR with any TOTP app, confirm a
code, store the one-time recovery codes. The TOTP secret is encrypted at rest
with `DATA_ENC_KEY`. Login then asks for a code; a recovery code also works and
is consumed on use.

## Operational notes

Catalog discovery is phased (`/api/catalogs?phase=meta|domain|save`) so each
serverless call stays well under the function timeout; the frontend orchestrates
the pool. `vercel.json` sets `maxDuration` to 30s for `/api/**`.

Evidence upload is capped at 4 MB, within Vercel's serverless body limit. The
file is read in the browser and sent as base64/text; the server builds the
Anthropic request, links controls, and stores the result.

Per-control AI guidance and the advisor thread are kept in memory for the
session, not persisted. Assessments, evidence, audit, and snapshots are
server-persisted; the workspace loads from the database on each sign-in.

## Data residency

NCA and SAMA regulated data should reside in-Kingdom. Confirm the current Claude
API region and data-handling options before routing evidence or assessment
content through it, and consider Anthropic on AWS Bedrock if you need explicit
region control. Treat this as a requirement to validate against current vendor
documentation, not an assumption.
