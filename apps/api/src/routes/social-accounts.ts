import { Hono } from 'hono';
import type { HonoEnv } from '../lib/errors.js';
import { handleError } from '../lib/errors.js';

const DEFAULT_USER_ID = '00000000-0000-4000-8000-000000000001';

export const socialAccountRoutes = new Hono<HonoEnv>();

socialAccountRoutes.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const result = await db
      .prepare(
        `SELECT id, platform, display_name as displayName, status, created_at as createdAt
         FROM social_accounts WHERE user_id = ?`,
      )
      .bind(DEFAULT_USER_ID)
      .all();

    return c.json({ data: result.results ?? [] });
  } catch (error) {
    return handleError(c, error);
  }
});
