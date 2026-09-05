export interface MediaPutInput {
  key: string;
  body: ArrayBuffer | ReadableStream | string;
  mimeType: string;
  metadata?: Record<string, string>;
}

export interface MediaPutResult {
  key: string;
  size: number;
}

export interface MediaGetResult {
  body: ReadableStream;
  mimeType: string;
  size: number;
  metadata: Record<string, string>;
}

export interface MediaStorage {
  put(input: MediaPutInput): Promise<MediaPutResult>;
  get(key: string): Promise<MediaGetResult | null>;
  delete(key: string): Promise<void>;
}
