import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema/index.js';

export function createDatabase(db: D1Database) {
  return drizzle(db, { schema });
}

export * from './schema/index.js';
export * from './repositories/content-repository.js';
export * from './repositories/scheduled-post-repository.js';
export * from './repositories/social-account-repository.js';
export * from './repositories/media-repository.js';
export * from './repositories/oauth-state-repository.js';
export * from './token-store/encrypted-d1-token-store.js';
export * from './container.js';
export * from './storage/r2-media-storage.js';
export * from './queue/cloudflare-queue.js';
