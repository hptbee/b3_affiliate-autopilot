import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const socialAccounts = sqliteTable(
  'social_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    platform: text('platform').notNull(),
    externalAccountId: text('external_account_id').notNull(),
    displayName: text('display_name').notNull(),
    accessTokenRef: text('access_token_ref').notNull(),
    refreshTokenRef: text('refresh_token_ref'),
    tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('social_accounts_user_platform_idx').on(table.userId, table.platform),
  ],
);

export const contents = sqliteTable(
  'contents',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('draft'),
    contentType: text('content_type').notNull().default('text'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('contents_user_status_idx').on(table.userId, table.status)],
);

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  contentId: text('content_id')
    .notNull()
    .references(() => contents.id),
  bucket: text('bucket').notNull(),
  key: text('key').notNull(),
  mediaType: text('media_type').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const scheduledPosts = sqliteTable(
  'scheduled_posts',
  {
    id: text('id').primaryKey(),
    contentId: text('content_id')
      .notNull()
      .references(() => contents.id),
    socialAccountId: text('social_account_id')
      .notNull()
      .references(() => socialAccounts.id),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
    status: text('status').notNull().default('scheduled'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    externalPostId: text('external_post_id'),
    error: text('error'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('scheduled_posts_status_scheduled_at_idx').on(table.status, table.scheduledAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type SocialAccountRow = typeof socialAccounts.$inferSelect;
export type ContentRow = typeof contents.$inferSelect;
export type MediaRow = typeof media.$inferSelect;
export type ScheduledPostRow = typeof scheduledPosts.$inferSelect;
