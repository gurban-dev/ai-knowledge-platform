'use client';

import { useQuery } from '@tanstack/react-query';

export default function UsagePage() {
  const summary = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await fetch('/api/proxy/v1/usage/summary?days=30');
      if (!res.ok) throw new Error('Failed to load usage');
      return (await res.json()) as {
        spentMicros: string;
        breakdown: Array<{
          kind: string;
          model: string;
          costMicros: string;
          events: number;
        }>;
      };
    },
  });

  const spent = Number(summary.data?.spentMicros ?? 0) / 1_000_000;

  return (
    <main>
      <h1 className="font-display text-3xl">Usage</h1>
      <p className="mt-4 text-3xl font-semibold">${spent.toFixed(2)}</p>
      <p className="text-sm text-ink/60">Estimated spend (30 days)</p>
      <ul className="mt-6 space-y-2">
        {(summary.data?.breakdown ?? []).map((row) => (
          <li
            key={`${row.kind}-${row.model}`}
            className="flex justify-between rounded-md border border-ink/10 bg-white/70 px-3 py-2 text-sm"
          >
            <span>
              {row.kind} · {row.model}
            </span>
            <span>
              {(Number(row.costMicros) / 1_000_000).toFixed(4)} · {row.events} events
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
