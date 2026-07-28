import type { Route } from 'next';
import Link from 'next/link';
import { LogoutButton } from '@/components/logout-button';

const nav: { href: Route; label: string }[] = [
  { href: '/app/chat', label: 'Chat' },
  { href: '/app/documents', label: 'Documents' },
  { href: '/app/search', label: 'Search' },
  { href: '/app/usage', label: 'Usage' },
  { href: '/app/settings', label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:px-6">
      {/* Mobile top bar — sidebar is hidden below md */}
      <header className="flex items-center justify-between md:hidden">
        <p className="font-display text-2xl">AKP</p>
        <LogoutButton className="rounded-md border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/80 transition hover:bg-white/70 hover:text-ink disabled:opacity-60" />
      </header>

      <aside className="hidden w-48 shrink-0 flex-col md:flex" aria-label="Primary">
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
        <div className="mt-auto pt-8">
          <LogoutButton />
        </div>
      </aside>

      {/* Compact mobile nav — keeps section switching available without a sidebar */}
      <nav
        className="flex gap-1 overflow-x-auto pb-1 md:hidden"
        aria-label="Primary"
      >
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink/80 hover:bg-white/70 hover:text-ink"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
