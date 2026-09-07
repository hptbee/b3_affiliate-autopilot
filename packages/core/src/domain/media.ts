export const MEDIA_ASSET_TYPES = ['image', 'audio', 'video', 'thumbnail'] as const;

export type MediaAssetType = (typeof MEDIA_ASSET_TYPES)[number];

/** @deprecated Use MediaAssetType. Kept so existing Media persistence maps 1:1. */
export const MEDIA_TYPES = MEDIA_ASSET_TYPES;
export type MediaType = MediaAssetType;

/**
 * D1 metadata only. Binary lives in R2.
 */
export interface MediaAsset {
  id: string;
  contentId: string;
  bucket: string;
  key: string;
  mediaType: MediaAssetType;
  mimeType: string;
  size: number;
  duration: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/** Existing name for the same persistence record. Prefer MediaAsset in new code. */
export type Media = MediaAsset;
