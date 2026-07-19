export interface PutObjectInput {
  organizationId: string;
  key: string;
  body: Buffer;
  mimeType: string;
  contentHash: string;
}

export interface PutObjectResult {
  storageKey: string;
  bucket: string;
  byteSize: number;
}

export interface ObjectStorage {
  readonly bucket: string;
  put(input: PutObjectInput): Promise<PutObjectResult>;
  get(organizationId: string, key: string): Promise<Buffer>;
  delete(organizationId: string, key: string): Promise<void>;
  /** Time-limited read URL (local backend returns a pseudo path). */
  signedUrl(organizationId: string, key: string, ttlSeconds: number): Promise<string>;
}
