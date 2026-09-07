import type { Media } from '../domain/media.js';
import type { UserContext } from '../types/user-context.js';
import type { MediaStorage } from '../types/media-storage.js';
import { ConflictError, NotFoundError, ValidationError } from '../types/errors.js';
import type { ContentRepository } from './content-service.js';

const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export interface MediaRepository {
  findByContentId(contentId: string): Promise<Media | null>;
  create(input: {
    contentId: string;
    bucket: string;
    key: string;
    mimeType: string;
    size: number;
    duration?: number | null;
  }): Promise<Media>;
  deleteByContentId(contentId: string): Promise<void>;
}

export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly contentRepository: ContentRepository,
    private readonly mediaStorage: MediaStorage,
    private readonly bucketName: string,
  ) {}

  async uploadForContent(
    user: UserContext,
    contentId: string,
    input: { bytes: ArrayBuffer; mimeType: string; size: number; duration?: number | null },
  ): Promise<Media> {
    const content = await this.contentRepository.findById(contentId);
    if (!content || content.userId !== user.userId) {
      throw new NotFoundError('Content', contentId);
    }

    if (!ALLOWED_VIDEO_MIME_TYPES.has(input.mimeType)) {
      throw new ValidationError(`Unsupported video mime type: ${input.mimeType}`);
    }

    const assetId = crypto.randomUUID();
    const extension = input.mimeType === 'video/quicktime' ? 'mov' : 'mp4';
    const key = `users/${user.userId}/content/${contentId}/${assetId}.${extension}`;

    const existing = await this.mediaRepository.findByContentId(contentId);
    if (existing) {
      await this.mediaStorage.delete(existing.key);
      await this.mediaRepository.deleteByContentId(contentId);
    }

    const putResult = await this.mediaStorage.put({
      key,
      body: input.bytes,
      mimeType: input.mimeType,
      metadata: { contentId, userId: user.userId },
    });

    return this.mediaRepository.create({
      contentId,
      bucket: this.bucketName,
      key,
      mimeType: input.mimeType,
      size: putResult.size,
      duration: input.duration ?? null,
    });
  }

  async getForContent(user: UserContext, contentId: string): Promise<Media | null> {
    const content = await this.contentRepository.findById(contentId);
    if (!content || content.userId !== user.userId) {
      throw new NotFoundError('Content', contentId);
    }

    return this.mediaRepository.findByContentId(contentId);
  }

  async getBytesForContent(contentId: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
    const media = await this.mediaRepository.findByContentId(contentId);
    if (!media) {
      throw new ConflictError('Content has no uploaded video');
    }

    const object = await this.mediaStorage.get(media.key);
    if (!object) {
      throw new NotFoundError('Media', media.id);
    }

    const bytes = await new Response(object.body).arrayBuffer();
    return { bytes, mimeType: object.mimeType };
  }
}
