import type { AffiliateOffer } from '../domain/affiliate-offer.js';
import type { DiscoveredProduct, Product } from '../domain/product.js';
import type { AffiliateNetwork, ProductSearchQuery } from '../types/affiliate.js';
import type { UserContext } from '../types/user-context.js';
import { AffiliateProviderError, NotFoundError, ValidationError } from '../types/errors.js';

export interface ProductRepository {
  create(input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>;
  update(id: string, input: Partial<Omit<Product, 'id' | 'userId' | 'provider' | 'createdAt'>>): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  findByUserId(userId: string): Promise<Product[]>;
  findByProviderExternalId(
    userId: string,
    provider: Product['provider'],
    externalProductId: string,
  ): Promise<Product | null>;
}

export interface AffiliateOfferRepository {
  create(input: Omit<AffiliateOffer, 'id' | 'createdAt'>): Promise<AffiliateOffer>;
  findById(id: string): Promise<AffiliateOffer | null>;
  findByProductId(productId: string): Promise<AffiliateOffer[]>;
  findByUserId(userId: string): Promise<AffiliateOffer[]>;
  findByProductAndUrl(productId: string, affiliateUrl: string): Promise<AffiliateOffer | null>;
}

export interface ImportProductInput {
  productUrl?: string;
  externalProductId?: string;
  keyword?: string;
  trackingCodes?: string[];
}

export interface ImportProductResult {
  product: Product;
  offer: AffiliateOffer | null;
}

function trackingCodeFrom(codes: string[] | undefined): string | null {
  if (!codes || codes.length === 0) return null;
  return codes.join(',');
}

export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly offerRepository: AffiliateOfferRepository,
    private readonly network: AffiliateNetwork,
  ) {}

  async search(user: UserContext, query: ProductSearchQuery): Promise<DiscoveredProduct[]> {
    void user;
    if (!query.keyword && !query.externalProductId && !query.productUrl) {
      throw new ValidationError('keyword, externalProductId, or productUrl is required');
    }
    return this.network.searchProducts(query);
  }

  async importProduct(user: UserContext, input: ImportProductInput): Promise<ImportProductResult> {
    const discovered = await this.discover(input);
    const product = await this.upsertProduct(user.userId, discovered);

    const trackingCodes = input.trackingCodes?.filter(Boolean);
    const offer = await this.ensureOffer(user.userId, product, discovered, trackingCodes);

    return { product, offer };
  }

  async list(user: UserContext): Promise<Product[]> {
    return this.productRepository.findByUserId(user.userId);
  }

  async getById(user: UserContext, id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product || product.userId !== user.userId) {
      throw new NotFoundError('Product', id);
    }
    return product;
  }

  async listOffers(user: UserContext, productId?: string): Promise<AffiliateOffer[]> {
    if (productId) {
      await this.getById(user, productId);
      return this.offerRepository.findByProductId(productId);
    }
    return this.offerRepository.findByUserId(user.userId);
  }

  async getOfferById(
    user: UserContext,
    productId: string,
    offerId: string,
  ): Promise<AffiliateOffer> {
    await this.getById(user, productId);
    const offer = await this.offerRepository.findById(offerId);
    if (!offer || offer.userId !== user.userId || offer.productId !== productId) {
      throw new NotFoundError('AffiliateOffer', offerId);
    }
    return offer;
  }

  async createOffer(
    user: UserContext,
    productId: string,
    trackingCodes?: string[],
  ): Promise<AffiliateOffer> {
    const product = await this.getById(user, productId);
    const generated = await this.network.createAffiliateLink({
      productUrl: product.productUrl,
      trackingCodes,
    });

    const existing = await this.offerRepository.findByProductAndUrl(product.id, generated.affiliateUrl);
    if (existing) {
      return existing;
    }

    return this.offerRepository.create({
      userId: user.userId,
      productId: product.id,
      provider: product.provider,
      affiliateUrl: generated.affiliateUrl,
      trackingCode: generated.trackingCode ?? trackingCodeFrom(trackingCodes),
      commissionRate: null,
      expiresAt: null,
    });
  }

  private async discover(input: ImportProductInput): Promise<DiscoveredProduct> {
    if (!input.externalProductId && !input.productUrl && !input.keyword) {
      throw new ValidationError('productUrl, externalProductId, or keyword is required');
    }

    const matches = await this.network.searchProducts({
      keyword: input.keyword,
      externalProductId: input.externalProductId,
      productUrl: input.productUrl,
      limit: 1,
    });
    const match = matches[0];
    if (!match) {
      throw new AffiliateProviderError('Product not found for the given import input', 'not_found');
    }
    return match;
  }

  private async upsertProduct(userId: string, discovered: DiscoveredProduct): Promise<Product> {
    const existing = await this.productRepository.findByProviderExternalId(
      userId,
      discovered.provider,
      discovered.externalProductId,
    );

    const fields = {
      title: discovered.title,
      description: discovered.description,
      price: discovered.price,
      originalPrice: discovered.originalPrice,
      rating: discovered.rating,
      salesCount: discovered.salesCount,
      images: discovered.images,
      productUrl: discovered.productUrl,
      metadata: discovered.metadata,
    };

    if (existing) {
      return this.productRepository.update(existing.id, fields);
    }

    return this.productRepository.create({
      userId,
      provider: discovered.provider,
      externalProductId: discovered.externalProductId,
      ...fields,
    });
  }

  private async ensureOffer(
    userId: string,
    product: Product,
    discovered: DiscoveredProduct,
    trackingCodes?: string[],
  ): Promise<AffiliateOffer | null> {
    if (trackingCodes && trackingCodes.length > 0) {
      return this.createOffer({ userId }, product.id, trackingCodes);
    }

    if (discovered.affiliateUrl) {
      const existing = await this.offerRepository.findByProductAndUrl(product.id, discovered.affiliateUrl);
      if (existing) return existing;
      return this.offerRepository.create({
        userId,
        productId: product.id,
        provider: product.provider,
        affiliateUrl: discovered.affiliateUrl,
        trackingCode: null,
        commissionRate: discovered.commissionRate,
        expiresAt: discovered.offerExpiresAt,
      });
    }

    return this.createOffer({ userId }, product.id);
  }
}
