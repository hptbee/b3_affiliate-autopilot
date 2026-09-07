import type { Content } from '../domain/content.js';
import type { MediaAssetType } from '../domain/media.js';

/** Input for generating a media asset from affiliate content. */
export interface MediaGenerationContext {
  content: Content;
  productTitle?: string | null;
  productImageUrl?: string | null;
}

export interface GeneratedMediaBinary {
  body: ArrayBuffer;
  mimeType: string;
  mediaType: MediaAssetType;
  metadata?: Record<string, unknown>;
}

/** Replaceable media generation port. Implementations live outside core (e.g. packages/ai). */
export interface MediaGenerator {
  generate(context: MediaGenerationContext): Promise<GeneratedMediaBinary>;
}

export function buildMediaObjectKey(
  userId: string,
  contentId: string,
  mediaId: string,
  extension: string,
): string {
  return `media/${userId}/${contentId}/${mediaId}.${extension}`;
}

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/svg+xml':
      return 'svg';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'video/mp4':
      return 'mp4';
    default:
      return 'bin';
  }
}
