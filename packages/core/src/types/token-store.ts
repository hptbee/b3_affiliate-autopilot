/**
 * Worker-side token vault. Access/refresh tokens never leave the Worker.
 * Phase 1 will encrypt blobs in D1 using TOKEN_WRAP_KEY.
 */
export interface TokenStore {
  get(ref: string): Promise<string | null>;
  put(ref: string, token: string): Promise<void>;
  delete(ref: string): Promise<void>;
}
