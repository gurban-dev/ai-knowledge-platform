'use client';

import { useQuery } from '@tanstack/react-query';

export default function SettingsPage() {
  const org = useQuery({
    queryKey: ['org'],
    queryFn: async () => {
      const res = await fetch('/api/proxy/v1/organizations/current');
      if (!res.ok) throw new Error('Failed to load organization');
      return (await res.json()) as { id: string; name: string; slug: string };
    },
  });

  const settings = useQuery({
    queryKey: ['org-settings'],
    queryFn: async () => {
      const res = await fetch('/api/proxy/v1/organizations/current/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      return (await res.json()) as Record<string, unknown>;
    },
  });

  return (
    <main>
      <h1 className="font-display text-3xl">Settings</h1>
      <section className="mt-6 rounded-xl border border-ink/10 bg-white/70 p-4">
        <h2 className="text-sm font-semibold">Organization</h2>
        <p className="mt-2 text-sm">
          {org.data?.name} <span className="text-ink/50">({org.data?.slug})</span>
        </p>
      </section>
      <section className="mt-4 rounded-xl border border-ink/10 bg-white/70 p-4">
        <h2 className="text-sm font-semibold">Governance</h2>
        <pre className="mt-3 overflow-auto text-xs text-ink/80">
          {JSON.stringify(settings.data ?? {}, null, 2)}
        </pre>
      </section>
    </main>
  );
}
