import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  decryptStaffLinkToken,
  encryptStaffLinkToken,
  generateStaffLinkToken,
  hashStaffLinkToken,
  parseStaffLinkKey,
} from './staff-link-token.js';

describe('Staff Link tokens', () => {
  let key: Buffer;
  let token: string;

  beforeEach(() => {
    key = randomBytes(32);
    token = generateStaffLinkToken();
  });

  describe('when a token is generated', () => {
    it('carries at least 32 random bytes, base64url-encoded', () => {
      expect(Buffer.from(token, 'base64url').length).toBeGreaterThanOrEqual(32);
    });

    it('uses only URL-safe characters', () => {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('differs from the next token generated', () => {
      expect(generateStaffLinkToken()).not.toBe(token);
    });
  });

  describe('when a token is encrypted and decrypted with the same key', () => {
    let ciphertext: string;

    beforeEach(() => {
      ciphertext = encryptStaffLinkToken(token, key);
    });

    it('gives back the token', () => {
      expect(decryptStaffLinkToken(ciphertext, key)).toBe(token);
    });

    it('does not contain the token', () => {
      expect(ciphertext).not.toContain(token);
    });
  });

  describe('when the same token is encrypted twice', () => {
    it('gives different ciphertexts', () => {
      expect(encryptStaffLinkToken(token, key)).not.toBe(encryptStaffLinkToken(token, key));
    });
  });

  describe('when the ciphertext has been tampered with', () => {
    let tampered: string;

    beforeEach(() => {
      const bytes = Buffer.from(encryptStaffLinkToken(token, key), 'base64');
      bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 0xff;
      tampered = bytes.toString('base64');
    });

    it('refuses to decrypt it', () => {
      expect(() => decryptStaffLinkToken(tampered, key)).toThrow();
    });
  });

  describe('when the ciphertext is decrypted with another key', () => {
    it('refuses to decrypt it', () => {
      const ciphertext = encryptStaffLinkToken(token, key);
      expect(() => decryptStaffLinkToken(ciphertext, randomBytes(32))).toThrow();
    });
  });

  describe('when a token is hashed for lookup', () => {
    it('gives the same hash every time', () => {
      expect(hashStaffLinkToken(token)).toBe(hashStaffLinkToken(token));
    });

    it('does not match the hash of another token', () => {
      expect(hashStaffLinkToken(token)).not.toBe(hashStaffLinkToken(generateStaffLinkToken()));
    });

    it('does not contain the token', () => {
      expect(hashStaffLinkToken(token)).not.toContain(token);
    });
  });

  describe.each([
    { scenario: 'is too short', value: randomBytes(16).toString('base64') },
    { scenario: 'is empty', value: '' },
  ])('when the configured key $scenario', ({ value }) => {
    it('refuses it', () => {
      expect(() => parseStaffLinkKey(value)).toThrow('STAFF_LINK_KEY must be 32 bytes');
    });
  });

  describe('when the configured key is 32 bytes, base64-encoded', () => {
    it('accepts it', () => {
      const encoded = randomBytes(32).toString('base64');
      expect(parseStaffLinkKey(encoded)).toEqual(Buffer.from(encoded, 'base64'));
    });
  });
});
