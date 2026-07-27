import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NotFoundError } from '@akp/core';
import type { ObjectStorage, PutObjectInput, PutObjectResult } from './types.js';

/**
 * Anchor a relative storage root to the monorepo workspace root so every
 * process (API, worker, scripts) resolves to the *same* directory regardless of
 * its current working directory. Without this, `pnpm --filter` runs each app
 * from its own package folder and the API and worker would not share objects.
 * Absolute roots are honored as-is.
 */
function resolveRootDir(rootDir: string): string {
  if (path.isAbsolute(rootDir)) return rootDir;
  let dir = process.cwd();
  for (let depth = 0; depth < 12; depth++) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return path.resolve(dir, rootDir);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd(), rootDir);
}

/**
 * Filesystem-backed object storage for local development and tests.
 * Production uses {@link GcsObjectStorage}; both share the same interface so
 * callers never branch on environment.
 */
export class LocalObjectStorage implements ObjectStorage {
  readonly bucket: string;
  private readonly rootDir: string;

  constructor(rootDir: string, bucket = 'akp-local') {
    this.rootDir = resolveRootDir(rootDir);
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

  signedUrl(
    organizationId: string,
    key: string,
    ttlSeconds: number,
  ): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = createHash('sha256')
      .update(`${organizationId}:${key}:${exp}`)
      .digest('hex')
      .slice(0, 16);
  
    return Promise.resolve(
      `local://${this.bucket}/${organizationId}/${key}?exp=${exp}&sig=${sig}`,
    );
  }

  private resolve(organizationId: string, key: string): string {
    // Prevent path traversal outside the org prefix.
    const safeKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.rootDir, organizationId, safeKey);
  }
}
