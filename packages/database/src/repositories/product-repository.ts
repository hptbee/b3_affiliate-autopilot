function generateId(): string {
  return crypto.randomUUID();
}
import { and, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Product, ProductRepository } from '@social-autopilot/core';
import { products } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function mapProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider as Product['provider'],
    externalProductId: row.externalProductId,
    title: row.title,
    description: row.description,
    price: row.price,
    originalPrice: row.originalPrice,
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    salesCount: row.salesCount,
    images: row.images ?? [],
    productUrl: row.productUrl,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: DrizzleD1Database<typeof schema>) {}

  async create(input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const now = new Date();
    const row = {
      id: generateId(),
      userId: input.userId,
      provider: input.provider,
      externalProductId: input.externalProductId,
      title: input.title,
      description: input.description,
      price: input.price,
      originalPrice: input.originalPrice,
      rating: input.rating === null ? null : String(input.rating),
      salesCount: input.salesCount,
      images: input.images,
      productUrl: input.productUrl,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(products).values(row);
    return mapProduct(row);
  }

  async update(
    id: string,
    input: Partial<Omit<Product, 'id' | 'userId' | 'provider' | 'createdAt'>>,
  ): Promise<Product> {
    const now = new Date();
    await this.db
      .update(products)
      .set({
        ...('title' in input ? { title: input.title } : {}),
        ...('description' in input ? { description: input.description } : {}),
        ...('price' in input ? { price: input.price } : {}),
        ...('originalPrice' in input ? { originalPrice: input.originalPrice } : {}),
        ...('rating' in input
          ? { rating: input.rating === null || input.rating === undefined ? null : String(input.rating) }
          : {}),
        ...('salesCount' in input ? { salesCount: input.salesCount } : {}),
        ...('images' in input ? { images: input.images } : {}),
        ...('productUrl' in input ? { productUrl: input.productUrl } : {}),
        ...('metadata' in input ? { metadata: input.metadata } : {}),
        ...('externalProductId' in input ? { externalProductId: input.externalProductId } : {}),
        updatedAt: now,
      })
      .where(eq(products.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Product not found after update: ${id}`);
    return updated;
  }

  async findById(id: string): Promise<Product | null> {
    const rows = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    return rows[0] ? mapProduct(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Product[]> {
    const rows = await this.db.select().from(products).where(eq(products.userId, userId));
    return rows.map(mapProduct);
  }

  async findByProviderExternalId(
    userId: string,
    provider: Product['provider'],
    externalProductId: string,
  ): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.userId, userId),
          eq(products.provider, provider),
          eq(products.externalProductId, externalProductId),
        ),
      )
      .limit(1);
    return rows[0] ? mapProduct(rows[0]) : null;
  }
}
