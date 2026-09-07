import { Hono } from 'hono';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

export const analyticsRoutes = new Hono<HonoEnv>();

analyticsRoutes.get('/content/:contentId', async (c) => {
  try {
    const { postAnalyticsService } = getServices(c);
    const summary = await postAnalyticsService.getContentPerformance(
      getUser(c),
      c.req.param('contentId'),
    );
    return c.json({ data: summary });
  } catch (error) {
    return handleError(c, error);
  }
});

analyticsRoutes.get('/products/:productId', async (c) => {
  try {
    const { postAnalyticsService } = getServices(c);
    const summary = await postAnalyticsService.getProductPerformance(
      getUser(c),
      c.req.param('productId'),
    );
    return c.json({ data: summary });
  } catch (error) {
    return handleError(c, error);
  }
});
