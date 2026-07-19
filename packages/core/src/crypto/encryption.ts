import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { EncryptionError } from '../errors/app-error.js';

/**
 * Envelope-style field encryption for secrets at rest (connector OAuth tokens,
 * MFA secrets, and any other sensitive column). We never store plaintext.
 *
 * Design:
 *   - AES-256-GCM (authenticated encryption): confidentiality + integrity.
 *   - A random 96-bit IV per operation (the recommended GCM nonce size).
 *   - Keys are resolved through a {@link KeyProvider} so the data-encryption key
 *     can be sourced from env in dev and from a KMS/Secret Manager in production
 *     without touching call sites. Ciphertext is tagged with the `keyId` that
 *     produced it, so keys can be rotated while old data stays decryptable.
 *
 * Serialized format (single string, safe for a TEXT column):
 *   `v1:<keyId>:<iv-b64url>:<authTag-b64url>:<ciphertext-b64url>`
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32; // AES-256
const ALGORITHM = 'aes-256-gcm';

/** Resolves data-encryption keys by id. Implementations may wrap a KMS. */
export interface KeyProvider {
  /** The key id new ciphertext should be encrypted under. */
  readonly activeKeyId: string;
  /** Return the 32-byte key for the given id, or throw if unknown. */
  getKey(keyId: string): Buffer;
}

/**
 * Key provider backed by an in-memory map of `keyId -> base64(32-byte key)`.
 * In production the map is populated from a secret store; in dev/test from env.
 * Supports rotation: add a new key, point `activeKeyId` at it, keep old keys for
 * decryption until data is re-encrypted.
 */
export class StaticKeyProvider implements KeyProvider {
  readonly activeKeyId: string;
  private readonly keys: Map<string, Buffer>;

  constructor(params: { activeKeyId: string; keys: Record<string, string> }) {
    const entries = Object.entries(params.keys);
    if (entries.length === 0) {
      throw new EncryptionError('At least one encryption key must be configured');
    }
    this.keys = new Map(
      entries.map(([id, b64]) => {
        const key = Buffer.from(b64, 'base64');
        if (key.length !== KEY_BYTES) {
          throw new EncryptionError(
            `Encryption key "${id}" must decode to ${KEY_BYTES} bytes (got ${key.length})`,
          );
        }
        return [id, key];
      }),
    );
    if (!this.keys.has(params.activeKeyId)) {
      throw new EncryptionError('activeKeyId does not match any configured key');
    }
    this.activeKeyId = params.activeKeyId;
  }

  getKey(keyId: string): Buffer {
    const key = this.keys.get(keyId);
    if (!key) throw new EncryptionError(`Unknown encryption key id "${keyId}"`);
    return key;
  }
}

/** Generate a fresh base64-encoded 256-bit key (used by ops tooling/tests). */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_BYTES).toString('base64');
}

function toB64Url(buf: Buffer): string {
  return buf.toString('base64url');
}

export class FieldEncryptor {
  constructor(private readonly provider: KeyProvider) {}

  /** Encrypt UTF-8 plaintext into the self-describing serialized envelope. */
  encrypt(plaintext: string): string {
    try {
      const keyId = this.provider.activeKeyId;
      const key = this.provider.getKey(keyId);
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      return [
        VERSION,
        keyId,
        toB64Url(iv),
        toB64Url(authTag),
        toB64Url(ciphertext),
      ].join(':');
    } catch (error) {
      if (error instanceof EncryptionError) throw error;
      throw new EncryptionError('Encryption failed', error);
    }
  }

  /** Decrypt a serialized envelope back to UTF-8 plaintext. */
  decrypt(payload: string): string {
    try {
      const parts = payload.split(':');
      if (parts.length !== 5 || parts[0] !== VERSION) {
        throw new EncryptionError('Malformed ciphertext envelope');
      }
      const [, keyId, ivB64, tagB64, dataB64] = parts as [
        string,
        string,
        string,
        string,
        string,
      ];
      const key = this.provider.getKey(keyId);
      const iv = Buffer.from(ivB64, 'base64url');
      const authTag = Buffer.from(tagB64, 'base64url');
      const ciphertext = Buffer.from(dataB64, 'base64url');
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch (error) {
      if (error instanceof EncryptionError) throw error;
      // GCM auth failures (tampering, wrong key) land here.
      throw new EncryptionError('Decryption failed', error);
    }
  }

  /** True if a value looks like this module's serialized envelope. */
  static isEncrypted(value: string): boolean {
    return value.startsWith(`${VERSION}:`) && value.split(':').length === 5;
  }
}

/** Constant-time comparison for two secrets of arbitrary length. */
export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
