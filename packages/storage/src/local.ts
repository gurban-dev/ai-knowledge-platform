import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NotFoundError } from '@akp/core';
import type { ObjectStorage, PutObjectInput, PutObjectResult } from './types.js';

/**
 * Filesystem-backed object storage for local development and tests.
 * Production uses {@link GcsObjectStorage}; both share the same interface so
 * callers never branch on environment.
 */
export class LocalObjectStorage implements ObjectStorage {
  readonly bucket: string;

  constructor(
    private readonly rootDir: string,
    bucket = 'akp-local',
  ) {
    this.bucket = bucket;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const full = this.resolve(input.organizationId, input.key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.body);
    return {
      storageKey: input.key,
      bucket: this.bucket,
      byteSize: input.body.byteLength,
    };
  }

  async get(organizationId: string, key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolve(organizationId, key));
    } catch {
      throw new NotFoundError('Stored object');
    }
  }

  async delete(organizationId: string, key: string): Promise<void> {
    try {
      await unlink(this.resolve(organizationId, key));
    } catch {
      // Idempotent delete.
    }
  }

  async signedUrl(organizationId: string, key: string, ttlSeconds: number): Promise<string> {
    // Local backend: return a pseudo URL encoding org/key + expiry.
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = createHash('sha256').update(`${organizationId}:${key}:${exp}`).digest('hex').slice(0, 16);
    return `local://${this.bucket}/${organizationId}/${key}?exp=${exp}&sig=${sig}`;
  }

  private resolve(organizationId: string, key: string): string {
    // Prevent path traversal outside the org prefix.
    const safeKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.rootDir, organizationId, safeKey);
  }
}
