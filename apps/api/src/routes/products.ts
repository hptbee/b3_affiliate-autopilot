import { z } from 'zod';
import { Hono } from 'hono';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

const searchSchema = z
  .object({
    keyword: z.string().min(1).optional(),
    externalProductId: z.string().min(1).optional(),
    productUrl: z.string().url().optional(),
  })
  .strict()
  .refine((value) => value.keyword || value.externalProductId || value.productUrl, {
    message: 'keyword, externalProductId, or productUrl is required',
  });

const importSchema = z
  .object({
    keyword: z.string().min(1).optional(),
    externalProductId: z.string().min(1).optional(),
    productUrl: z.string().url().optional(),
    trackingCodes: z.array(z.string().min(1).max(64)).max(5).optional(),
  })
  .strict()
  .refine((value) => value.keyword || value.externalProductId || value.productUrl, {
    message: 'keyword, externalProductId, or productUrl is required',
  });

const createOfferSchema = z
  .object({
    trackingCodes: z.array(z.string().min(1).max(64)).max(5).optional(),
  })
  .strict();

export const productRoutes = new Hono<HonoEnv>();

productRoutes.get('/', async (c) => {
  try {
    const { productService } = getServices(c);
    const items = await productService.list(getUser(c));
    return c.json({ data: items });
  } catch (error) {
    return handleError(c, error);
  }
});

productRoutes.post('/search', async (c) => {
  try {
    const body = searchSchema.parse(await c.req.json());
    const { productService } = getServices(c);
    const items = await productService.search(getUser(c), body);
    return c.json({ data: items });
  } catch (error) {
    return handleError(c, error);
  }
});

productRoutes.post('/import', async (c) => {
  try {
    const body = importSchema.parse(await c.req.json());
    const { productService } = getServices(c);
    const result = await productService.importProduct(getUser(c), body);
    return c.json({ data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

productRoutes.get('/:id', async (c) => {
  try {
    const { productService } = getServices(c);
    const product = await productService.getById(getUser(c), c.req.param('id'));
    const offers = await productService.listOffers(getUser(c), product.id);
    return c.json({ data: { product, offers } });
  } catch (error) {
    return handleError(c, error);
  }
});

productRoutes.post('/:id/affiliate-offer', async (c) => {
  try {
    const body = createOfferSchema.parse(await c.req.json().catch(() => ({})));
    const { productService } = getServices(c);
    const offer = await productService.createOffer(
      getUser(c),
      c.req.param('id'),
      body.trackingCodes,
    );
    return c.json({ data: offer }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});
