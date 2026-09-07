import { z } from 'zod';
import { Hono } from 'hono';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

const generatePipelineSchema = z
  .object({
    limit: z.number().int().min(1).max(20).default(5),
    keyword: z.string().min(1).max(128).optional(),
    duplicateWindowHours: z.number().int().min(1).max(24 * 30).optional(),
    generateMedia: z.boolean().optional(),
    tone: z.string().min(1).max(64).optional(),
    language: z.string().min(1).max(16).optional(),
  })
  .strict();

export const affiliateContentRoutes = new Hono<HonoEnv>();

affiliateContentRoutes.post('/generate', async (c) => {
  try {
    const body = generatePipelineSchema.parse(await c.req.json().catch(() => ({})));
    const { affiliateContentPipelineService } = getServices(c);
    const result = await affiliateContentPipelineService.run(getUser(c), body);
    return c.json({ data: result }, result.created > 0 ? 201 : 200);
  } catch (error) {
    return handleError(c, error);
  }
});
