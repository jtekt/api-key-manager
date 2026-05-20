import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys } from '../db/schema.js';
import { generateApiKey, hashKey } from '../crypto.js';
const router = new Hono();
router.post('/', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => ({}));
    const { plaintext, hint } = generateApiKey();
    const hash = await hashKey(plaintext);
    const [row] = await db.insert(apiKeys).values({
        userId,
        name: body.name ?? null,
        hash,
        keyHint: hint,
        expiresAt: body.expires_at ? new Date(body.expires_at) : null,
    }).returning({
        id: apiKeys.id,
        name: apiKeys.name,
        expiresAt: apiKeys.expiresAt,
    });
    return c.json({ ...row, api_key: plaintext }, 201);
});
router.get('/', async (c) => {
    const userId = c.get('userId');
    const rows = await db
        .select({
        id: apiKeys.id,
        name: apiKeys.name,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        revoked: apiKeys.revoked,
        expiresAt: apiKeys.expiresAt,
    })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt));
    return c.json(rows);
});
router.delete('/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const rows = await db
        .update(apiKeys)
        .set({ revoked: true })
        .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
        .returning({ id: apiKeys.id });
    if (rows.length === 0)
        return c.json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
});
export default router;
