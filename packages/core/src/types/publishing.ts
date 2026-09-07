import type { MediaAssetType } from '../domain/media.js';

/**
 * Resolved media bytes passed to a SocialPublisher. Platform adapters decide
 * which attachments are publishable (e.g. Facebook skips SVG).
 */
export interface PublishMediaAttachment {
  id: string;
  mimeType: string;
  mediaType: MediaAssetType;
  body: ArrayBuffer;
}
