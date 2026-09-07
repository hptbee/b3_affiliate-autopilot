import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { TokenStore } from '@social-autopilot/core';
import { tokenBlobs } from '../schema/index.js';
import type * as schema from '../schema/index.js';

function generateId(): string {
  return crypto.randomUUID();
}

function keyBytes(wrapKey: string): Uint8Array {
  const encoded = new TextEncoder().encode(wrapKey);
  const bytes = new Uint8Array(32);
  bytes.set(encoded.slice(0, 32));
  return bytes;
}

async function importAesKey(wrapKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyBytes(wrapKey), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class EncryptedD1TokenStore implements TokenStore {
  constructor(
    private readonly db: DrizzleD1Database<typeof schema>,
    private readonly wrapKey: string,
  ) {}

  async get(ref: string): Promise<string | null> {
    const rows = await this.db.select().from(tokenBlobs).where(eq(tokenBlobs.id, ref)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return this.decrypt(row.ciphertext);
  }

  async put(ref: string, token: string): Promise<void> {
    const now = new Date();
    const ciphertext = await this.encrypt(token);
    const existing = await this.db.select().from(tokenBlobs).where(eq(tokenBlobs.id, ref)).limit(1);

    if (existing[0]) {
      await this.db
        .update(tokenBlobs)
        .set({ ciphertext, updatedAt: now })
        .where(eq(tokenBlobs.id, ref));
      return;
    }

    await this.db.insert(tokenBlobs).values({
      id: ref,
      ciphertext,
      createdAt: now,
      updatedAt: now,
    });
  }

  async delete(ref: string): Promise<void> {
    await this.db.delete(tokenBlobs).where(eq(tokenBlobs.id, ref));
  }

  createRef(): string {
    return generateId();
  }

  private async encrypt(plaintext: string): Promise<string> {
    const key = await importAesKey(this.wrapKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const payload = new Uint8Array(iv.length + cipher.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(cipher), iv.length);
    return toBase64(payload);
  }

  private async decrypt(ciphertext: string): Promise<string> {
    const key = await importAesKey(this.wrapKey);
    const payload = fromBase64(ciphertext);
    const iv = payload.slice(0, 12);
    const data = payload.slice(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
  }
}
