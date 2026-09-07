import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './encrypted-token-store.js';

describe('encrypted token crypto', () => {
  it('round-trips a token with AES-GCM', async () => {
    const wrapKey = 'test-wrap-key-for-unit-tests';
    const encrypted = await encryptSecret('page-access-token-123', wrapKey);
    const decrypted = await decryptSecret(encrypted, wrapKey);
    expect(decrypted).toBe('page-access-token-123');
  });

  it('produces different ciphertext for the same plaintext', async () => {
    const wrapKey = 'test-wrap-key-for-unit-tests';
    const a = await encryptSecret('same-token', wrapKey);
    const b = await encryptSecret('same-token', wrapKey);
    expect(a).not.toBe(b);
  });
});
