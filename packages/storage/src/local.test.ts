import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalObjectStorage } from './local.js';

describe('LocalObjectStorage', () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('puts and gets objects under an org prefix', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'akp-storage-'));
    const storage = new LocalObjectStorage(root);
    const body = Buffer.from('hello knowledge');
    const put = await storage.put({
      organizationId: 'org_1',
      key: 'docs/a.txt',
      body,
      mimeType: 'text/plain',
      contentHash: 'abc',
    });
    expect(put.byteSize).toBe(body.byteLength);
    const got = await storage.get('org_1', 'docs/a.txt');
    expect(got.toString()).toBe('hello knowledge');
    const url = await storage.signedUrl('org_1', 'docs/a.txt', 60);
    expect(url).toContain('local://');
    await storage.delete('org_1', 'docs/a.txt');
  });
});
