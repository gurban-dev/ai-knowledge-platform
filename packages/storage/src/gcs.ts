import { DependencyFailureError, NotFoundError } from '@akp/core';
import type { ObjectStorage, PutObjectInput, PutObjectResult } from './types.js';

/**
 * Google Cloud Storage backend using the JSON API via fetch.
 * Uses Application Default Credentials (ADC) or a bearer token from
 * `STORAGE_GCS_ACCESS_TOKEN` for environments without the full GCS SDK.
 *
 * For production GKE, prefer Workload Identity + ADC. The local filesystem
 * backend is used when `STORAGE_BACKEND=local`.
 */
export class GcsObjectStorage implements ObjectStorage {
  constructor(
    readonly bucket: string,
    private readonly accessToken: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const objectName = `${input.organizationId}/${input.key}`;
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
    const res = await this.request(url, {
      method: 'POST',
      headers: { 'content-type': input.mimeType },
      body: input.body,
    });
    if (!res.ok) {
      throw new DependencyFailureError(`GCS upload failed (${res.status})`);
    }
    return {
      storageKey: input.key,
      bucket: this.bucket,
      byteSize: input.body.byteLength,
    };
  }

  async get(organizationId: string, key: string): Promise<Buffer> {
    const objectName = `${organizationId}/${key}`;
    const url = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(objectName)}?alt=media`;
    const res = await this.request(url, { method: 'GET' });
    if (res.status === 404) throw new NotFoundError('Stored object');
    if (!res.ok) throw new DependencyFailureError(`GCS download failed (${res.status})`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  async delete(organizationId: string, key: string): Promise<void> {
    const objectName = `${organizationId}/${key}`;
    const url = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(objectName)}`;
    const res = await this.request(url, { method: 'DELETE' });
    if (res.status !== 404 && !res.ok) {
      throw new DependencyFailureError(`GCS delete failed (${res.status})`);
    }
  }

  signedUrl(
    organizationId: string,
    key: string,
    ttlSeconds: number,
  ): Promise<string> {
    const objectName = `${organizationId}/${key}`;
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  
    return Promise.resolve(
      `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(objectName)}?alt=media&akp_exp=${exp}`,
    );
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          authorization: `Bearer ${this.accessToken}`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}