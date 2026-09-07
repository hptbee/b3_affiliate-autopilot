import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema/index.js';

export function createDatabase(db: D1Database) {
  return drizzle(db, { schema });
}

export * from './schema/index.js';
export * from './repositories/content-repository.js';
export * from './repositories/scheduled-post-repository.js';
export * from './repositories/social-account-repository.js';
export * from './repositories/product-repository.js';
export * from './repositories/affiliate-offer-repository.js';
export * from './repositories/media-repository.js';
export * from './repositories/pipeline-lock-repository.js';
export * from './repositories/post-analytics-repository.js';
export * from './repositories/optimization-recommendation-repository.js';
export * from './container.js';
export * from './storage/r2-media-storage.js';
export * from './queue/cloudflare-queue.js';
export * from './token/encrypted-token-store.js';
