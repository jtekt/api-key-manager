## PROJECT: API KEY MANAGEMENT MICROSERVICE (BACKEND ONLY)

### PURPOSE

A backend microservice that:

• Allows authenticated users (identified by external OIDC) to create and manage long‑lived API keys.  
• Stores hashed API keys securely in PostgreSQL.  
• Offers a high-performance /validate endpoint for other microservices to authenticate incoming API keys.  
• Handles no UI and no SSR.

The frontend UI is in a separate repository and communicates only via REST.

---

## SYSTEM ARCHITECTURE

Single backend microservice:

• Language/framework: Node.js with Hono.  
• Persistence: PostgreSQL  
• Hashing: Argon2id  
• Communication: REST API  
• High‑load endpoint: /validate  
• No templating, no SSR, no static serving

External components:  
• An OIDC provider (Auth0, Keycloak, Cognito, Clerk, etc.)  
• A separate UI project (Nuxt or other)

---

## AUTH MODEL

The microservice does NOT authenticate users directly.

The UI obtains a user_id ("sub" from OIDC) and sends it to the microservice using a header:

```
X-User-ID: <oidc_sub>
```

The microservice **trusts** this header (provided the UI is authenticated by OIDC), and uses this value to determine ownership of API keys.

---

## API KEY MODEL

API keys are:

• Random 32‑byte secrets (base64url or hex)  
• Prefixed with ak\_  
• Shown only once at creation  
• Stored only as Argon2id hashes  
• Long-lived (months/years)  
• Fully revocable

---

## DATABASE SCHEMA (PostgreSQL)

Table: api_keys

Columns:  
• id: UUID primary key  
• user_id: text (OIDC "sub" claim)  
• name: text (user-defined label)  
• hash: text (argon2id hash result)  
• created_at: timestamp NOT NULL DEFAULT now()  
• last_used_at: timestamp NULL  
• expires_at: timestamp NULL  
• revoked: boolean NOT NULL DEFAULT false  
• scopes: jsonb NULL (array of permission strings)

Indexes:  
• idx_api_keys_user_id  
• idx_api_keys_active (revoked=false)  
• idx_api_keys_expires_at

---

## SECURITY REQUIREMENTS

Hashing algorithm: Argon2id  
Parameters (2026 safe defaults):  
• memoryCost: 64–128 MB  
• timeCost: 2–4  
• parallelism: 1

Salt:  
• 16 bytes random, generated per key  
• Included inside the Argon2 encoded hash string

Pepper (optional, recommended):  
• Secret env var (KEY_PEPPER)  
• Append to the plaintext before hashing

Never store plaintext API keys.  
Never log plaintext keys.

---

## BACKEND API ENDPOINTS

All user-facing endpoints require:  
Header: X-User-ID

---

## POST /keys

Create a new API key for the authenticated user.

Input:  
• name (optional)  
• scopes (optional array of strings)  
• expires_at (optional ISO timestamp)

Process:  
• Generate random key  
• Hash with Argon2id  
• Store hash + metadata  
• Return plaintext ONCE

Response:

```json
{
  "id": "<uuid>",
  "api_key": "<plaintext>",
  "name": "...",
  "scopes": [...],
  "expires_at": null
}
```

---

## GET /keys

List all keys belonging to X-User-ID.

Response:

```json
[
  {
    "id": "...",
    "name": "...",
    "created_at": "...",
    "last_used_at": "...",
    "revoked": false,
    "expires_at": null,
    "scopes": [...]
  }
]
```

---

## DELETE /keys/:id

Revoke the given key.

Process:  
• Verify key belongs to user  
• Set revoked = true  
• Do not delete the row

Response: 204

---

## POST /validate

Used by any microservice to authenticate API keys.

Input:

```json
{
  "api_key": "<string>"
}
```

Process:  
• Parse the API key format  
• Hash + verify  
• Check revoked/expires_at  
• Update last_used_at  
• Return owner user_id and scopes

Response (valid):

```json
{
  "valid": true,
  "user_id": "<string>",
  "scopes": ["..."],
  "expires_at": "..."
}
```

Response (invalid):

```json
{
  "valid": false
}
```

Performance:  
• This endpoint must be highly optimized  
• Multi-instance horizontal scaling supported  
• Add optional in-memory LRU cache (TTL 30–120 seconds)

---

## CACHING REQUIREMENTS

The /validate endpoint supports:

• Optional in-memory LRU cache  
• Cache keyed by hash or plaintext key  
• Cache stores:

- user_id
- scopes
- expires_at
- revoked status

Eviction:  
• TTL expiration  
• Manual purge if key is revoked (not required for v1)

Implement the service so caching can be switched on/off.

---

## OPERATIONAL REQUIREMENTS

Environment variables:  
• DATABASE_URL  
• KEY_PEPPER (optional but recommended)  
• ARGON2_MEMORY_COST  
• ARGON2_TIME_COST  
• ARGON2_PARALLELISM

Containerization:  
• Dockerfile

Logging:  
• No sensitive information in logs  
• No plaintext API keys  
• Log only: creation events, revocation events, validation events  
• Provide correlation IDs for requests

Metrics (optional v1):  
• Validation count  
• Cache hit/miss rate  
• Request latency

---

## NON-GOALS

The microservice will NOT:  
• Provide an OIDC login flow  
• Provide any HTML or UI files  
• Serve static assets  
• Issue JWTs  
• Proxy any request  
• Act as a general identity provider  
• Act as an API gateway  
• Perform RBAC/authorization beyond returning scopes

---

## DELIVERABLES

The coding agent must produce:

Backend:  
• A production-ready backend microservice (Go or Node)  
• Implement all endpoints exactly as documented  
• Use PostgreSQL as storage  
• Include database migrations  
• Implement Argon2id hashing  
• Implement validation logic  
• Include optional in-memory caching  
• Add Dockerfile + docker-compose

Documentation:  
• README with setup instructions  
• Example curl requests  
• Environment variable template (.env.example)

Testing:  
• Unit tests for hashing + validation  
• Integration tests for endpoints (optional but encouraged)
