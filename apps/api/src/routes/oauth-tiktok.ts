import { Hono } from 'hono';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';
import { hasTikTokConfig } from '../lib/context.js';

export const oauthTikTokRoutes = new Hono<HonoEnv>();

oauthTikTokRoutes.get('/start', async (c) => {
  try {
    if (!hasTikTokConfig(c.env)) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'TikTok OAuth is not configured' } },
        503,
      );
    }
    const { socialAccountService } = getServices(c);
    const { authorizeUrl } = await socialAccountService.startOAuth(getUser(c));
    return c.redirect(authorizeUrl);
  } catch (error) {
    return handleError(c, error);
  }
});

oauthTikTokRoutes.get('/callback', async (c) => {
  try {
    if (!hasTikTokConfig(c.env)) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'TikTok OAuth is not configured' } },
        503,
      );
    }

    const code = c.req.query('code');
    const state = c.req.query('state');
    if (!code || !state) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing OAuth code or state' } },
        400,
      );
    }

    const { socialAccountService } = getServices(c);
    await socialAccountService.completeOAuth(code, state);

    const webOrigin = c.env.CORS_ORIGIN ?? 'http://localhost:5173';
    return c.redirect(`${webOrigin}/accounts`);
  } catch (error) {
    return handleError(c, error);
  }
});
