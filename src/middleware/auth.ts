import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthEnv = { Variables: { userId: string } };

const { OIDC_JWKS_URI } = process.env;

export let authMiddleware: MiddlewareHandler<AuthEnv>;

if (OIDC_JWKS_URI) {
  const JWKS = createRemoteJWKSet(new URL(OIDC_JWKS_URI));

  authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    try {
      const { payload } = await jwtVerify(header.slice(7), JWKS, {
        issuer: process.env.OIDC_ISSUER,
      });
      if (!payload.sub) return c.json({ error: "Unauthorized" }, 401);
      c.set("userId", payload.sub);
      await next();
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  });
} else {
  // Dev fallback: trust X-User-ID header (no OIDC provider required)
  authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
    const userId = c.req.header("X-User-ID");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    c.set("userId", userId);
    await next();
  });
}
