import type { Content } from '../domain/content.js';
import { mapAffiliateDraftToContentFields } from '../domain/content.js';
import { ensureAffiliateUrlInFields } from '../domain/affiliate-link-validation.js';
import type { GeneratedAffiliateContentDraft } from '../types/affiliate-content.js';
import type { AffiliateContentGenerator } from '../types/affiliate-content.js';
import type { UserContext } from '../types/user-context.js';
import { ValidationError } from '../types/errors.js';
import type { ContentService } from './content-service.js';
import type { ProductService } from './product-service.js';

export interface GenerateAffiliateContentInput {
  productId: string;
  affiliateOfferId?: string;
  tone?: string;
  language?: string;
}

export interface GenerateAffiliateContentResult {
  content: Content;
  draft: GeneratedAffiliateContentDraft;
  productId: string;
  affiliateOfferId: string;
}

export class AffiliateContentService {
  constructor(
    private readonly productService: ProductService,
    private readonly contentService: ContentService,
    private readonly generator: AffiliateContentGenerator,
  ) {}

  async generateDraft(
    user: UserContext,
    input: GenerateAffiliateContentInput,
  ): Promise<GenerateAffiliateContentResult> {
    const product = await this.productService.getById(user, input.productId);
    const offer = input.affiliateOfferId
      ? await this.productService.getOfferById(user, input.productId, input.affiliateOfferId)
      : await this.resolveDefaultOffer(user, input.productId);

    const draft = await this.generator.generate({
      product,
      offer,
      tone: input.tone,
      language: input.language,
    });

    const { title, body } = ensureAffiliateUrlInFields(
      mapAffiliateDraftToContentFields({
        ...draft.copy,
        videoScenePlan: draft.videoScenePlan,
      }),
      offer.affiliateUrl,
    );

    const content = await this.contentService.create(user, {
      title,
      body,
      contentType: 'video',
      metadata: {
        productId: product.id,
        affiliateOfferId: offer.id,
        affiliateUrl: offer.affiliateUrl,
      },
    });

    return {
      content,
      draft,
      productId: product.id,
      affiliateOfferId: offer.id,
    };
  }

  private async resolveDefaultOffer(user: UserContext, productId: string) {
    const offers = await this.productService.listOffers(user, productId);
    const offer = offers[0];
    if (!offer) {
      throw new ValidationError(
        'Product has no affiliate offer. Import the product or create an offer before generating content.',
      );
    }
    return offer;
  }
}
