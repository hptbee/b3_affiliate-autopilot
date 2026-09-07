import { z } from 'zod';
import { Hono } from 'hono';
import { SCHEDULED_POST_PRIVACY_LEVELS } from '@social-autopilot/core';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

const createScheduledPostSchema = z
  .object({
    contentId: z.string().uuid(),
    socialAccountId: z.string().uuid(),
    scheduledAt: z.string().datetime(),
    privacyLevel: z.enum(SCHEDULED_POST_PRIVACY_LEVELS).optional(),
  })
  .strict();

export const scheduledPostRoutes = new Hono<HonoEnv>();

scheduledPostRoutes.get('/', async (c) => {
  try {
    const { scheduledPostService } = getServices(c);
    const items = await scheduledPostService.list(getUser(c));
    return c.json({ data: items });
  } catch (error) {
    return handleError(c, error);
  }
});

scheduledPostRoutes.post('/', async (c) => {
  try {
    const body = createScheduledPostSchema.parse(await c.req.json());
    const { scheduledPostService } = getServices(c);
    const post = await scheduledPostService.create(getUser(c), {
      contentId: body.contentId,
      socialAccountId: body.socialAccountId,
      scheduledAt: new Date(body.scheduledAt),
      privacyLevel: body.privacyLevel,
    });
    return c.json({ data: post }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

scheduledPostRoutes.post('/:id/cancel', async (c) => {
  try {
    const { scheduledPostService } = getServices(c);
    const post = await scheduledPostService.cancel(getUser(c), c.req.param('id'));
    return c.json({ data: post });
  } catch (error) {
    return handleError(c, error);
  }
});
