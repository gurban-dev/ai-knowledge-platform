import { describe, expect, it } from 'vitest';
import { EncryptionError } from '../errors/app-error.js';
import {
  FieldEncryptor,
  StaticKeyProvider,
  constantTimeEquals,
  generateEncryptionKey,
} from './encryption.js';

function makeProvider(activeKeyId = 'k1'): StaticKeyProvider {
  return new StaticKeyProvider({
    activeKeyId,
    keys: { k1: generateEncryptionKey(), k2: generateEncryptionKey() },
  });
}

describe('FieldEncryptor', () => {
  it('round-trips plaintext', () => {
    const enc = new FieldEncryptor(makeProvider());
    const secret = 'oauth-token-abc123!@#';
    const ciphertext = enc.encrypt(secret);
    expect(ciphertext).not.toContain(secret);
    expect(FieldEncryptor.isEncrypted(ciphertext)).toBe(true);
    expect(enc.decrypt(ciphertext)).toBe(secret);
  });

  it('produces distinct ciphertext for identical plaintext (random IV)', () => {
    const enc = new FieldEncryptor(makeProvider());
    expect(enc.encrypt('same')).not.toBe(enc.encrypt('same'));
  });

  it('detects tampering via the GCM auth tag', () => {
    const enc = new FieldEncryptor(makeProvider());
    const ciphertext = enc.encrypt('sensitive');
    const parts = ciphertext.split(':');
    // Flip a character in the ciphertext body.
    parts[4] = parts[4]!.slice(0, -1) + (parts[4]!.endsWith('A') ? 'B' : 'A');
    expect(() => enc.decrypt(parts.join(':'))).toThrow(EncryptionError);
  });

  it('decrypts data encrypted under a rotated (non-active) key', () => {
    const provider = makeProvider('k2');
    const encWithK2 = new FieldEncryptor(provider);
    const ciphertext = encWithK2.encrypt('rotate-me');
    // A provider whose active key is k1 but still holds k2 can decrypt.
    const providerActiveK1 = new StaticKeyProvider({
      activeKeyId: 'k1',
      keys: {
        k1: (provider as unknown as { keys: Map<string, Buffer> }).keys
          .get('k1')!
          .toString('base64'),
        k2: (provider as unknown as { keys: Map<string, Buffer> }).keys
          .get('k2')!
          .toString('base64'),
      },
    });
    expect(new FieldEncryptor(providerActiveK1).decrypt(ciphertext)).toBe('rotate-me');
  });

  it('rejects malformed envelopes', () => {
    const enc = new FieldEncryptor(makeProvider());
    expect(() => enc.decrypt('not-an-envelope')).toThrow(EncryptionError);
  });
});

describe('StaticKeyProvider', () => {
  it('rejects keys of the wrong length', () => {
    expect(
      () => new StaticKeyProvider({ activeKeyId: 'k1', keys: { k1: 'c2hvcnQ=' } }),
    ).toThrow(EncryptionError);
  });

  it('rejects an active key id not present in the map', () => {
    expect(
      () => new StaticKeyProvider({ activeKeyId: 'missing', keys: { k1: generateEncryptionKey() } }),
    ).toThrow(EncryptionError);
  });
});

describe('constantTimeEquals', () => {
  it('compares equal and unequal strings', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
    expect(constantTimeEquals('abc', 'abcd')).toBe(false);
  });
});
