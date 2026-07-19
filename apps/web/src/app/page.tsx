import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="font-display text-5xl tracking-tight text-ink md:text-7xl">AKP</p>
      <h1 className="mt-4 max-w-2xl text-2xl font-medium text-ink/90 md:text-3xl">
        Connect internal knowledge to AI with retrieval quality you can measure.
      </h1>
      <p className="mt-4 max-w-xl text-base text-ink/70">
        Ingest documents, search with hybrid retrieval, chat with citations, and monitor
        hallucinations, latency, and cost — built for regulated enterprises.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href="/login"
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-ink/20 bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-white"
        >
          Create organization
        </Link>
      </div>
    </main>
  );
}
