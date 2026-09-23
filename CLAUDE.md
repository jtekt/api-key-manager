# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server with hot reload (tsx watch, loads .env)
npm run build        # compile TypeScript to dist/
npm run start        # run compiled output (dist/src/index.js)
npm run db:generate  # generate a Drizzle migration after editing src/db/schema.ts
npm run db:migrate   # apply pending migrations (needs DATABASE_URL)
```

No test runner is configured yet. The project uses ESM (`"type": "module"`) and TypeScript strict mode targeting ESNext with NodeNext module resolution, so relative imports need the `.js` extension. `tsconfig.json` has no `include`/`rootDir`, so `drizzle.config.ts` is compiled too and the entry point lands at `dist/src/index.js`.

## Architecture

Backend-only REST microservice built with **Hono** on Node.js (`@hono/node-server`). No SSR, no static serving, no templating. A separate Vue GUI (`../api-key-manager-gui`) consumes it.

- `src/index.ts` — app setup: CORS, auth middleware on `/keys/*`, route mounting, port from `PORT` (default 3000)
- `src/routes/keys.ts` — create / list / revoke (authenticated)
- `src/routes/validate.ts` — key verification (unauthenticated)
- `src/crypto.ts` — key generation, Argon2id hashing with optional pepper
- `src/db/` — Drizzle ORM over `pg` Pool (`DATABASE_URL`); schema in `schema.ts`, migrations output to `./drizzle` (not yet generated)

Environment variables are read directly from `process.env` at module load (no validation yet; see TODO in `crypto.ts`). See README for the full list.

## Auth model

`/keys/*` endpoints are protected by a two-mode auth middleware (`src/middleware/auth.ts`), selected once at startup:

- **With `OIDC_JWKS_URI`** (production): verifies JWT Bearer tokens against the remote JWKS; `OIDC_ISSUER` is checked if set. The claim named by `OIDC_USER_CLAIM` (default `sub`) becomes `userId`.
- **Without `OIDC_JWKS_URI`** (dev): trusts the `X-User-ID` request header as `userId`. Still returns 401 if the header is absent.

Route handlers read the user via `c.get('userId')` (typed by `AuthEnv`). The `/validate` endpoint is unauthenticated — callers present the raw API key in the request body.

## API key format

Keys are `ak_` + 32 random bytes encoded as base64url. The plaintext is returned **once** at creation and never stored — only the Argon2id hash is persisted. An optional pepper (`KEY_PEPPER` env var) is appended to the plaintext before hashing, so changing it invalidates all existing keys.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/keys` | Create key (`name`, `expires_at` optional); returns plaintext once |
| `GET` | `/keys` | List the user's keys; `?limit=` (≤100), `?offset=`, `?revoked=true\|false`; returns `{ items, total }` |
| `DELETE` | `/keys/:id` | Revoke a key (sets `revoked=true`, row kept); 404 if not owned |
| `POST` | `/validate` | Verify a key; returns `{ valid, user_id, expires_at }` |

Response casing is mixed: `/keys` returns camelCase Drizzle field names, `/validate` returns snake_case. The GUI depends on these shapes.

`/validate` is the hot path — it must stay stateless and horizontally scalable. It selects candidates by `key_hint` (first 8 chars of the plaintext) plus `revoked=false` and unexpired, then Argon2-verifies each. On success it updates `last_used_at` and awaits that write before responding. There is no caching layer.

## Database schema

Single table `api_keys` (`src/db/schema.ts`): `id` (UUID PK), `user_id`, `name` (nullable), `hash`, `key_hint`, `created_at`, `last_used_at`, `expires_at` (nullable), `revoked` (bool).

No indexes are defined yet. `/validate` filters on `key_hint` and `GET /keys` on `user_id`, so those are the natural candidates.

## Security constraints

- Never log or return plaintext keys after the creation response.
- Argon2id params come from `ARGON2_MEMORY_COST` (KiB, default 65536), `ARGON2_TIME_COST` (default 3), `ARGON2_PARALLELISM` (default 1).
- Revocation sets `revoked=true`; rows are never deleted.
- `/validate` must check both `revoked` and `expires_at` before returning `valid: true`.
