import { Hono } from 'hono';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

export const socialAccountRoutes = new Hono<HonoEnv>();

socialAccountRoutes.get('/', async (c) => {
  try {
    const { socialAccountRepository } = getServices(c);
    const accounts = await socialAccountRepository.findByUserId(getUser(c).userId);
    return c.json({
      data: accounts
        .filter((account) => account.platform === 'tiktok')
        .map((account) => ({
          id: account.id,
          platform: account.platform,
          displayName: account.displayName,
          status: account.status,
          createdAt: account.createdAt,
        })),
    });
  } catch (error) {
    return handleError(c, error);
  }
});
