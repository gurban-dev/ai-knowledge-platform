'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * MFA challenge page shown after password or Google primary-factor success when
 * the account has MFA enabled. Submits a TOTP (or recovery) code to the BFF,
 * which completes the session using the pending MFA cookie.
 */
export default function MfaPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mfaCode: code.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Invalid authentication code');
        return;
      }
      router.push('/app/chat');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-4xl">Two-factor authentication</h1>
      <p className="mt-2 text-sm text-ink/70">
        Enter the 6-digit code from your authenticator app to finish signing in.
      </p>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-8 space-y-4" noValidate>
        <label className="block text-sm font-medium">
          Authentication code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white/80 px-3 py-2 tracking-widest"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Verifying…' : 'Verify'}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink/70">
        <Link href="/login" className="font-medium text-accent underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
