# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server with hot reload (tsx watch)
npm run build    # compile TypeScript to dist/
npm run start    # run compiled output
```

No test runner is configured yet. The project uses ESM (`"type": "module"`) and TypeScript strict mode targeting ESNext with NodeNext module resolution.

## Architecture

Backend-only REST microservice built with **Hono** on Node.js (`@hono/node-server`). No SSR, no static serving, no templating.

**Planned stack** (see `SPECIFICATIONS.md`):
- **Hono** — HTTP framework (`src/index.ts` entry point, port 3000)
- **PostgreSQL** — persistence via `DATABASE_URL` env var
- **Argon2id** — hashing for API keys (configurable via `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`)
- **LRU cache** — optional in-memory cache for `/validate` (TTL 30–120s, togglable)

## Auth model

The service trusts the `X-User-ID` header (set by the upstream UI after OIDC login). It does **not** implement its own authentication — all user-facing endpoints require this header to identify key ownership.

## API key format

Keys are `ak_` prefixed, 32-byte random secrets (base64url or hex). The plaintext is returned **once** at creation and never stored — only the Argon2id hash is persisted. An optional pepper (`KEY_PEPPER` env var) is appended to the plaintext before hashing.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/keys` | Create key; returns plaintext once |
| `GET` | `/keys` | List keys for the requesting user |
| `DELETE` | `/keys/:id` | Revoke a key (sets `revoked=true`, row kept) |
| `POST` | `/validate` | Verify a key; returns `user_id` + scopes; performance-critical |

The `/validate` endpoint is the hot path — it must support horizontal scaling and optional LRU caching.

## Database schema

Single table `api_keys`: `id` (UUID PK), `user_id` (text), `name` (text), `hash` (text), `created_at`, `last_used_at`, `expires_at`, `revoked` (bool), `scopes` (jsonb).

Key indexes: on `user_id`, on `revoked=false` (partial), on `expires_at`.

## Security constraints

- Never log or return plaintext keys after the creation response.
- Argon2id params (2026 defaults): `memoryCost` 64–128 MB, `timeCost` 2–4, `parallelism` 1.
- Revocation sets `revoked=true`; rows are never deleted.
- `/validate` must check both `revoked` and `expires_at` before returning `valid: true`.
