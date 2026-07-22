import type { Route } from 'next';
import Link from 'next/link';

const nav: { href: Route; label: string }[] = [
  { href: '/app/chat', label: 'Chat' },
  { href: '/app/documents', label: 'Documents' },
  { href: '/app/search', label: 'Search' },
  { href: '/app/usage', label: 'Usage' },
  { href: '/app/settings', label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-8 px-4 py-6 md:px-6">
      <aside className="hidden w-48 shrink-0 md:block" aria-label="Primary">
        <p className="font-display text-2xl">AKP</p>
        <nav className="mt-8 flex flex-col gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 text-sm font-medium text-ink/80 hover:bg-white/70 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}