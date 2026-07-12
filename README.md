# API Key Manager

A REST microservice for issuing, listing, revoking, and validating API keys. Built with [Hono](https://hono.dev/) and PostgreSQL.

## Features

- Generates `ak_`-prefixed API keys and returns the plaintext exactly once, at creation
- Stores only an Argon2id hash of each key (with optional pepper), never the plaintext
- Fast validation via a `key_hint` pre-filter so `/validate` avoids scanning the whole table
- Per-user key listing and revocation (revoked keys are kept, not deleted)
- Optional key expiry
- Pluggable auth: OIDC/JWT in production, a trusted header in dev

## Requirements

- Node.js 24+
- PostgreSQL

## Getting started

```bash
npm install
cp .env.example .env   # then edit as needed
npm run db:migrate     # apply the database schema
npm run dev             # start the dev server with hot reload on :3000
```

## Configuration

Set these in `.env` (see `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | HTTP port (default `3000`) |
| `OIDC_JWKS_URI` | No | JWKS endpoint for verifying Bearer JWTs. If unset, the API falls back to trusting the `X-User-ID` header (dev only) |
| `OIDC_ISSUER` | No | Expected `iss` claim, checked when `OIDC_JWKS_URI` is set |
| `OIDC_USER_CLAIM` | No | JWT claim used as the user ID (default `sub`) |
| `KEY_PEPPER` | No | Secret string appended to key plaintext before hashing |
| `ARGON2_MEMORY_COST` | No | Argon2id memory cost in KiB (default `65536`) |
| `ARGON2_TIME_COST` | No | Argon2id time cost (default `3`) |
| `ARGON2_PARALLELISM` | No | Argon2id parallelism (default `1`) |

## Auth

`/keys/*` routes require authentication:

- **With `OIDC_JWKS_URI` set:** requests must carry `Authorization: Bearer <jwt>`. The token is verified against the remote JWKS (and `OIDC_ISSUER` if set), and the configured claim (`OIDC_USER_CLAIM`, default `sub`) becomes the user ID.
- **Without it (dev mode):** requests must carry an `X-User-ID` header, trusted as-is.

`/validate` is unauthenticated — callers present the raw API key in the request body.

## API

### `POST /keys`

Create a new key for the authenticated user. Returns the plaintext key — the only time it is ever exposed.

Request body (optional fields):
```json
{ "name": "CI pipeline", "expires_at": "2027-01-01T00:00:00Z" }
```

Response `201`:
```json
{ "id": "...", "name": "CI pipeline", "expiresAt": "2027-01-01T00:00:00.000Z", "api_key": "ak_..." }
```

### `GET /keys`

List keys belonging to the authenticated user (never includes plaintext or hashes). Supports pagination via `?limit=` (default 20, max 100) and `?offset=`, and filtering via `?revoked=true` or `?revoked=false`. Omit `revoked` to return all keys regardless of status.

Response `200`:
```json
{ "items": [ { "id": "...", "name": "...", "createdAt": "...", "lastUsedAt": "...", "revoked": false, "expiresAt": null } ], "total": 1 }
```

### `DELETE /keys/:id`

Revoke a key owned by the authenticated user. Sets `revoked=true`; the row is kept. Returns `204`, or `404` if the key doesn't exist or isn't owned by the caller.

### `POST /validate`

Verify an API key. Unauthenticated — this is the hot path used by other services to check keys on every request.

Request body:
```json
{ "api_key": "ak_..." }
```

Response `200`:
```json
{ "valid": true, "user_id": "...", "expires_at": null }
```

Returns `{ "valid": false }` if the key is malformed, unknown, revoked, or expired. On success, `last_used_at` is updated asynchronously.

## Database

Single table, `api_keys`, managed with [Drizzle ORM](https://orm.drizzle.team/):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | text | Owner |
| `name` | text | Optional label |
| `hash` | text | Argon2id hash of the key (never the plaintext) |
| `key_hint` | text | First 8 chars of the plaintext; pre-filters `/validate` lookups |
| `created_at` | timestamp | |
| `last_used_at` | timestamp | Updated on successful validation |
| `expires_at` | timestamp | Nullable |
| `revoked` | boolean | Set on revocation; rows are never deleted |

```bash
npm run db:generate   # generate a migration after editing src/db/schema.ts
npm run db:migrate    # apply pending migrations
```

## Scripts

```bash
npm run dev      # dev server with hot reload (tsx watch)
npm run build    # compile TypeScript to dist/
npm run start    # run the compiled output
```

## Deployment

A `Dockerfile` and Kubernetes manifests (`kubernetes_manifest.yml`) are included. The container runs `node dist/src/index.js` after `npm run build`; configuration is passed entirely via environment variables (see [Configuration](#configuration)).
