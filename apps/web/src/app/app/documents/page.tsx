'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface DocumentDto {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const docs = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('/api/proxy/v1/documents');
      if (!res.ok) throw new Error('Failed to load documents');
      return (await res.json()) as { documents: DocumentDto[] };
    },
  });

  async function upload() {
    setError(null);
    const res = await fetch('/api/proxy/v1/documents', {
      method: 'POST',
      body: JSON.stringify({ title, content, mimeType: 'text/plain' }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      setError(body.error?.message ?? 'Upload failed');
      return;
    }
    setTitle('');
    setContent('');
    await qc.invalidateQueries({ queryKey: ['documents'] });
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Documents</h1>
      <p className="mt-1 text-sm text-ink/70">Upload text knowledge for indexing and retrieval.</p>

      <section className="mt-6 rounded-xl border border-ink/10 bg-white/70 p-4">
        <h2 className="text-sm font-semibold">Upload</h2>
        <label className="mt-3 block text-sm">
          Title
          <input
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm">
          Content
          <textarea
            className="mt-1 min-h-32 w-full rounded-md border border-ink/15 bg-white px-3 py-2"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void upload()}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Ingest
        </button>
      </section>

      <section className="mt-6" aria-live="polite">
        <h2 className="text-sm font-semibold">Library</h2>
        <ul className="mt-3 divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white/70">
          {(docs.data?.documents ?? []).map((doc) => (
            <li key={doc.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium">{doc.title}</span>
              <span className="text-ink/60">{doc.status}</span>
            </li>
          ))}
          {docs.data?.documents.length === 0 ? (
            <li className="px-4 py-6 text-sm text-ink/60">No documents yet.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
