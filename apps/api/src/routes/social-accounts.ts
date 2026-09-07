import { Hono } from 'hono';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

export const socialAccountRoutes = new Hono<HonoEnv>();

socialAccountRoutes.get('/', async (c) => {
  try {
    const { socialAccountService } = getServices(c);
    const accounts = await socialAccountService.listForUser(getUser(c));
    return c.json({ data: accounts });
  } catch (error) {
    return handleError(c, error);
  }
});

socialAccountRoutes.post('/:id/disconnect', async (c) => {
  try {
    const { socialAccountService } = getServices(c);
    const account = await socialAccountService.disconnect(getUser(c), c.req.param('id'));
    return c.json({ data: account });
  } catch (error) {
    return handleError(c, error);
  }
});
