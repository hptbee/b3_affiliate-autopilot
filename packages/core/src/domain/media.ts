export const MEDIA_TYPES = ['image', 'video', 'audio', 'document'] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export interface Media {
  id: string;
  contentId: string;
  bucket: string;
  key: string;
  mediaType: MediaType;
  mimeType: string;
  size: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
