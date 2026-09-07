import { z } from 'zod';
import { Hono } from 'hono';
import { CONTENT_TYPES } from '@social-autopilot/core';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

const createContentSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
    contentType: z.enum(CONTENT_TYPES).optional(),
  })
  .strict();

const updateContentSchema = z
  .object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    contentType: z.enum(CONTENT_TYPES).optional(),
  })
  .strict();

export { createContentSchema, updateContentSchema };

export const contentRoutes = new Hono<HonoEnv>();

contentRoutes.get('/', async (c) => {
  try {
    const { contentService } = getServices(c);
    const items = await contentService.listByUser(getUser(c));
    return c.json({ data: items });
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.post('/', async (c) => {
  try {
    const body = createContentSchema.parse(await c.req.json());
    const { contentService } = getServices(c);
    const content = await contentService.create(getUser(c), body);
    return c.json({ data: content }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.get('/:id', async (c) => {
  try {
    const { contentService } = getServices(c);
    const content = await contentService.getById(getUser(c), c.req.param('id'));
    return c.json({ data: content });
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.patch('/:id', async (c) => {
  try {
    const body = updateContentSchema.parse(await c.req.json());
    const { contentService } = getServices(c);
    const content = await contentService.update(getUser(c), c.req.param('id'), body);
    return c.json({ data: content });
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.post('/:id/approve', async (c) => {
  try {
    const { contentService } = getServices(c);
    const content = await contentService.approve(getUser(c), c.req.param('id'));
    return c.json({ data: content });
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.post('/:id/cancel', async (c) => {
  try {
    const { contentService } = getServices(c);
    const content = await contentService.cancel(getUser(c), c.req.param('id'));
    return c.json({ data: content });
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.delete('/:id', async (c) => {
  try {
    const { contentService } = getServices(c);
    await contentService.delete(getUser(c), c.req.param('id'));
    return c.body(null, 204);
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.post('/:id/media', async (c) => {
  try {
    const formData = await c.req.formData();
    const rawFile = formData.get('file');
    if (!rawFile || typeof rawFile === 'string') {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'file is required' } }, 400);
    }

    const file = rawFile as File;
    const bytes = await file.arrayBuffer();
    const { mediaService } = getServices(c);
    const media = await mediaService.uploadForContent(getUser(c), c.req.param('id'), {
      bytes,
      mimeType: file.type || 'video/mp4',
      size: file.size,
    });
    return c.json({ data: media }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

contentRoutes.get('/:id/media', async (c) => {
  try {
    const { mediaService } = getServices(c);
    const media = await mediaService.getForContent(getUser(c), c.req.param('id'));
    return c.json({ data: media });
  } catch (error) {
    return handleError(c, error);
  }
});
