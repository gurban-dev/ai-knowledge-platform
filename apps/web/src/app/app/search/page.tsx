'use client';

import { useState } from 'react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<
    Array<{ title: string; content: string; score: number }>
  >([]);

  async function runSearch() {
    const res = await fetch('/api/proxy/v1/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit: 10 }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { hits: typeof hits };
    setHits(data.hits);
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Search</h1>
      <div className="mt-6 flex gap-2">
        <input
          aria-label="Search query"
          className="flex-1 rounded-md border border-ink/15 bg-white/80 px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void runSearch()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>
      <ul className="mt-6 space-y-3">
        {hits.map((hit, i) => (
          <li key={`${hit.title}-${i}`} className="rounded-xl border border-ink/10 bg-white/70 p-4">
            <p className="font-medium">
              {hit.title}{' '}
              <span className="text-xs text-ink/50">score {hit.score.toFixed(3)}</span>
            </p>
            <p className="mt-2 text-sm text-ink/70">{hit.content.slice(0, 280)}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
