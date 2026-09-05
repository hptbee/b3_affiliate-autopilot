export const MEDIA_TYPES = ['video'] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

/** D1 metadata only. Binary lives in R2. */
export interface Media {
  id: string;
  contentId: string;
  bucket: string;
  key: string;
  mediaType: MediaType;
  mimeType: string;
  size: number;
  duration: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
