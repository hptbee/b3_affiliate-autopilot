import type { MediaAsset } from '../domain/media.js';
import type { ContentStatus } from '../domain/content.js';
import type { MediaGenerator } from '../types/media-generation.js';
import {
  buildMediaObjectKey,
  extensionForMimeType,
} from '../types/media-generation.js';
import type { MediaStorage } from '../types/media-storage.js';
import type { UserContext } from '../types/user-context.js';
import { ConflictError, MediaGenerationError, NotFoundError, ValidationError } from '../types/errors.js';
import type { ContentService } from './content-service.js';
import type { ProductService } from './product-service.js';

const GENERATABLE_CONTENT_STATUSES: ContentStatus[] = ['draft', 'approved'];
const MAX_MEDIA_BYTES = 512 * 1024;

export interface MediaRepository {
  create(input: Omit<MediaAsset, 'createdAt'>): Promise<MediaAsset>;
  findById(id: string): Promise<MediaAsset | null>;
  findByContentId(contentId: string): Promise<MediaAsset[]>;
}

export interface GenerateContentMediaInput {
  productId?: string;
}

export class MediaService {
  constructor(
    private readonly contentService: ContentService,
    private readonly productService: ProductService,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaStorage: MediaStorage,
    private readonly mediaGenerator: MediaGenerator,
    private readonly bucketName: string,
  ) {}

  async generateForContent(
    user: UserContext,
    contentId: string,
    input: GenerateContentMediaInput = {},
  ): Promise<MediaAsset> {
    const content = await this.contentService.getById(user, contentId);
    if (!GENERATABLE_CONTENT_STATUSES.includes(content.status)) {
      throw new ConflictError(
        `Media can only be generated for draft or approved content (current: ${content.status})`,
      );
    }

    const productContext = input.productId
      ? await this.loadProductContext(user, input.productId)
      : { productTitle: null, productImageUrl: null };

    const generated = await this.mediaGenerator.generate({
      content,
      ...productContext,
    });

    this.assertValidBinary(generated);

    const mediaId = crypto.randomUUID();
    const extension = extensionForMimeType(generated.mimeType);
    const key = buildMediaObjectKey(user.userId, contentId, mediaId, extension);

    let storedSize: number;
    try {
      const putResult = await this.mediaStorage.put({
        key,
        body: generated.body,
        mimeType: generated.mimeType,
        metadata: {
          contentId,
          mediaType: generated.mediaType,
        },
      });
      storedSize = putResult.size;
    } catch {
      throw new MediaGenerationError('Failed to store generated media', 'storage');
    }

    return this.mediaRepository.create({
      id: mediaId,
      contentId,
      bucket: this.bucketName,
      key,
      mediaType: generated.mediaType,
      mimeType: generated.mimeType,
      size: storedSize,
      duration: null,
      metadata: {
        ...(generated.metadata ?? {}),
        ...(input.productId ? { productId: input.productId } : {}),
      },
    });
  }

  async listForContent(user: UserContext, contentId: string): Promise<MediaAsset[]> {
    await this.contentService.getById(user, contentId);
    return this.mediaRepository.findByContentId(contentId);
  }

  async getForContent(
    user: UserContext,
    contentId: string,
    mediaId: string,
  ): Promise<MediaAsset> {
    await this.contentService.getById(user, contentId);
    const asset = await this.mediaRepository.findById(mediaId);
    if (!asset || asset.contentId !== contentId) {
      throw new NotFoundError('MediaAsset', mediaId);
    }
    return asset;
  }

  private async loadProductContext(user: UserContext, productId: string) {
    const product = await this.productService.getById(user, productId);
    return {
      productTitle: product.title,
      productImageUrl: product.images[0] ?? null,
    };
  }

  private assertValidBinary(generated: {
    body: ArrayBuffer;
    mimeType: string;
    mediaType: string;
  }): void {
    if (!generated.body || generated.body.byteLength === 0) {
      throw new MediaGenerationError('Media generator returned empty output', 'invalid');
    }
    if (generated.body.byteLength > MAX_MEDIA_BYTES) {
      throw new MediaGenerationError('Generated media exceeds size limit', 'invalid', {
        maxBytes: MAX_MEDIA_BYTES,
        actualBytes: generated.body.byteLength,
      });
    }
    if (!generated.mimeType.startsWith('image/')) {
      throw new MediaGenerationError('Only image media is supported in this phase', 'invalid');
    }
  }
}
