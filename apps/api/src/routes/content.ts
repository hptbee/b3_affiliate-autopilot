import { z } from 'zod';
import { Hono } from 'hono';
import { CONTENT_STATUSES, CONTENT_TYPES } from '@social-autopilot/core';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, handleError } from '../lib/errors.js';

// Default user for bootstrap (single-user mode until auth is implemented)
const DEFAULT_USER_ID = '00000000-0000-4000-8000-000000000001';

const createContentSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  contentType: z.enum(CONTENT_TYPES).optional(),
});

const updateContentSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  contentType: z.enum(CONTENT_TYPES).optional(),
});

export const contentRoutes = new Hono<HonoEnv>();

contentRoutes.get('/', async (c) => {
  try {
    const { contentService } = getServices(c);
    const items = await contentService.listByUser(DEFAULT_USER_ID);
    return c.json({ data: items });
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.post('/', async (c) => {
  try {
    const body = createContentSchema.parse(await c.req.json());
    const { contentService } = getServices(c);
    const content = await contentService.create({
      userId: DEFAULT_USER_ID,
      ...body,
    });
    return c.json({ data: content }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.get('/:id', async (c) => {
  try {
    const { contentService } = getServices(c);
    const content = await contentService.getById(c.req.param('id'));
    return c.json({ data: content });
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.patch('/:id', async (c) => {
  try {
    const body = updateContentSchema.parse(await c.req.json());
    const { contentService } = getServices(c);
    const content = await contentService.update(c.req.param('id'), body);
    return c.json({ data: content });
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.delete('/:id', async (c) => {
  try {
    const { contentService } = getServices(c);
    await contentService.delete(c.req.param('id'));
    return c.body(null, 204);
  } catch (error) {
    return handleError(c, error);
  }
});
