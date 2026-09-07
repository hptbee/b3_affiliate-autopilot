import { z } from 'zod';
import { Hono } from 'hono';
import { OPTIMIZATION_RECOMMENDATION_STATUSES } from '@social-autopilot/core';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

const generateRecommendationsSchema = z
  .object({
    includeAiReasoning: z.boolean().optional(),
  })
  .strict();

export const optimizationRoutes = new Hono<HonoEnv>();

optimizationRoutes.get('/recommendations', async (c) => {
  try {
    const status = c.req.query('status');
    if (status && !OPTIMIZATION_RECOMMENDATION_STATUSES.includes(status as never)) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid status. Expected one of: ${OPTIMIZATION_RECOMMENDATION_STATUSES.join(', ')}`,
          },
        },
        400,
      );
    }

    const { affiliateOptimizationService } = getServices(c);
    const recommendations = await affiliateOptimizationService.listRecommendations(
      getUser(c),
      status as (typeof OPTIMIZATION_RECOMMENDATION_STATUSES)[number] | undefined,
    );
    return c.json({ data: recommendations });
  } catch (error) {
    return handleError(c, error);
  }
});

optimizationRoutes.post('/recommendations/generate', async (c) => {
  try {
    const body = generateRecommendationsSchema.parse(await c.req.json().catch(() => ({})));
    const { affiliateOptimizationService } = getServices(c);
    const result = await affiliateOptimizationService.generateRecommendations(getUser(c), body);
    return c.json({ data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

optimizationRoutes.post('/recommendations/:id/approve', async (c) => {
  try {
    const { affiliateOptimizationService } = getServices(c);
    const recommendation = await affiliateOptimizationService.approveRecommendation(
      getUser(c),
      c.req.param('id'),
    );
    return c.json({ data: recommendation });
  } catch (error) {
    return handleError(c, error);
  }
});

optimizationRoutes.post('/recommendations/:id/reject', async (c) => {
  try {
    const { affiliateOptimizationService } = getServices(c);
    const recommendation = await affiliateOptimizationService.rejectRecommendation(
      getUser(c),
      c.req.param('id'),
    );
    return c.json({ data: recommendation });
  } catch (error) {
    return handleError(c, error);
  }
});

optimizationRoutes.post('/recommendations/:id/apply', async (c) => {
  try {
    const { affiliateOptimizationService } = getServices(c);
    const recommendation = await affiliateOptimizationService.applyRecommendation(
      getUser(c),
      c.req.param('id'),
    );
    return c.json({ data: recommendation });
  } catch (error) {
    return handleError(c, error);
  }
});
