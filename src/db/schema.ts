import { pgTable, uuid, serial, varchar, text, integer, bigint, real, timestamp, unique, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userIdentities = pgTable('user_identities', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refType: varchar('ref_type', { length: 50 }).notNull(),
  refId: varchar('ref_id', { length: 255 }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiresAt: integer('token_expires_at').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('uq_user_identities_ref').on(t.refType, t.refId),
  index('user_identities_user_id_idx').on(t.userId),
]);

export const mints = pgTable('mints', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  activityId: bigint('activity_id', { mode: 'number' }).notNull().unique(),
  txHash: varchar('tx_hash', { length: 66 }).notNull(),
  tokenId: bigint('token_id', { mode: 'number' }),
  // run snapshot — captured at mint time so the record is self-contained
  distance: real('distance').notNull(),
  movingTime: integer('moving_time').notNull(),
  elevationGain: real('elevation_gain').notNull(),
  runAt: timestamp('run_at', { withTimezone: true }).notNull(),
  // mint context
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  chainId: integer('chain_id').notNull(),
  contractAddress: varchar('contract_address', { length: 42 }).notNull(),
  mintedAt: timestamp('minted_at', { withTimezone: true }).notNull().defaultNow(),
});
