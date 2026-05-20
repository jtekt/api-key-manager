import { Hono } from 'hono'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { apiKeys } from '../db/schema.js'
import { verifyKey } from '../crypto.js'

const router = new Hono()

router.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { api_key?: string }
  const key = body.api_key

  if (typeof key !== 'string' || !key.startsWith('ak_')) {
    return c.json({ valid: false })
  }

  const hint = key.slice(0, 8)
  const now = new Date()

  const candidates = await db
    .select()
    .from(apiKeys)
    .where(and(
      eq(apiKeys.keyHint, hint),
      eq(apiKeys.revoked, false),
      or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
    ))

  for (const row of candidates) {
    const valid = await verifyKey(key, row.hash)
    if (valid) {
      await db
        .update(apiKeys)
        .set({ lastUsedAt: now })
        .where(eq(apiKeys.id, row.id))

      return c.json({
        valid: true,
        user_id: row.userId,
        expires_at: row.expiresAt,
      })
    }
  }

  return c.json({ valid: false })
})

export default router
