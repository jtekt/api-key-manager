import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const apiKeys = pgTable('api_keys', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     text('user_id').notNull(),
  name:       text('name'),
  hash:       text('hash').notNull(),
  keyHint:    text('key_hint').notNull(),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt:  timestamp('expires_at'),
  revoked:    boolean('revoked').notNull().default(false),
})
