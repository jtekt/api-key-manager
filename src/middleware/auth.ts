import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export type AuthEnv = { Variables: { userId: string } }

const JWKS = createRemoteJWKSet(new URL(process.env.OIDC_JWKS_URI!))

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      issuer: process.env.OIDC_ISSUER,
    })
    if (!payload.sub) return c.json({ error: 'Unauthorized' }, 401)
    c.set('userId', payload.sub)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
