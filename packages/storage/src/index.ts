export * from './types.js';
export * from './local.js';
export * from './gcs.js';

import { LocalObjectStorage } from './local.js';
import { GcsObjectStorage } from './gcs.js';
import type { ObjectStorage } from './types.js';

export interface CreateStorageOptions {
  backend: 'local' | 'gcs';
  localRoot: string;
  bucket: string;
  gcsAccessToken?: string | undefined;
}

export function createObjectStorage(options: CreateStorageOptions): ObjectStorage {
  if (options.backend === 'gcs') {
    if (!options.gcsAccessToken) {
      throw new Error('STORAGE_GCS_ACCESS_TOKEN is required when STORAGE_BACKEND=gcs');
    }
    return new GcsObjectStorage(options.bucket, options.gcsAccessToken);
  }
  return new LocalObjectStorage(options.localRoot, options.bucket);
}
