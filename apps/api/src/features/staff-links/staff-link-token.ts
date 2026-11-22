import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const CIPHER = 'aes-256-gcm';
const STAFF_LINK_PATH = /^\/api\/staff-links\/[^/?]+/;

export function parseStaffLinkKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`STAFF_LINK_KEY must be ${KEY_BYTES} bytes, base64-encoded`);
  }
  return key;
}

export function generateStaffLinkToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashStaffLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function encryptStaffLinkToken(token: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptStaffLinkToken(ciphertext: string, key: Buffer): string {
  const bytes = Buffer.from(ciphertext, 'base64');
  const iv = bytes.subarray(0, IV_BYTES);
  const authTag = bytes.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv(CIPHER, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(bytes.subarray(IV_BYTES + AUTH_TAG_BYTES)),
    decipher.final(),
  ]).toString('utf8');
}

export function withoutStaffLinkToken(url: string): string {
  return url.replace(STAFF_LINK_PATH, '/api/staff-links/[token]');
}
