import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { TokenStore } from '@social-autopilot/core';
import { tokenVault } from '../schema/index.js';
import type * as schema from '../schema/index.js';

const IV_BYTES = 12;

async function deriveAesKey(wrapKey: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(wrapKey));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptSecret(plaintext: string, wrapKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(wrapKey);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return bytesToBase64(combined);
}

export async function decryptSecret(ciphertext: string, wrapKey: string): Promise<string> {
  const combined = base64ToBytes(ciphertext);
  const iv = combined.slice(0, IV_BYTES);
  const data = combined.slice(IV_BYTES);
  const key = await deriveAesKey(wrapKey);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plain);
}

export class EncryptedTokenStore implements TokenStore {
  constructor(
    private readonly db: DrizzleD1Database<typeof schema>,
    private readonly wrapKey: string,
  ) {}

  async get(ref: string): Promise<string | null> {
    const rows = await this.db.select().from(tokenVault).where(eq(tokenVault.ref, ref)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return decryptSecret(row.ciphertext, this.wrapKey);
  }

  async put(ref: string, token: string): Promise<void> {
    const now = new Date();
    const ciphertext = await encryptSecret(token, this.wrapKey);
    const existing = await this.db.select().from(tokenVault).where(eq(tokenVault.ref, ref)).limit(1);

    if (existing[0]) {
      await this.db
        .update(tokenVault)
        .set({ ciphertext, updatedAt: now })
        .where(eq(tokenVault.ref, ref));
      return;
    }

    await this.db.insert(tokenVault).values({
      ref,
      ciphertext,
      createdAt: now,
      updatedAt: now,
    });
  }

  async delete(ref: string): Promise<void> {
    await this.db.delete(tokenVault).where(eq(tokenVault.ref, ref));
  }
}
