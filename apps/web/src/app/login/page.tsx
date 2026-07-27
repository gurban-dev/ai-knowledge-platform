'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

const OAUTH_ERRORS: Record<string, string> = {
  google: 'Google sign-in could not be completed. Please try again.',
  google_unavailable:
    'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.',
};

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('error');
    const message = reason ? OAUTH_ERRORS[reason] : undefined;
    if (message) setError(message);
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      mfaRequired?: boolean;
      ok?: boolean;
    };
    if (res.ok && body.mfaRequired) {
      router.push('/login/mfa');
      return;
    }
    if (!res.ok) {
      setError(body.error ?? 'Login failed');
      return;
    }
    router.push('/app/chat');
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-4xl">Sign in</h1>
      <p className="mt-2 text-sm text-ink/70">Access your organization workspace.</p>
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-8 space-y-4"
        noValidate
      >
        <label className="block text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white/80 px-3 py-2"
            {...form.register('email')}
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white/80 px-3 py-2"
            {...form.register('password')}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white"
        >
          Continue
        </button>
      </form>
      <GoogleSignInButton successPath="/app/chat" returnTo="/login" />
      <p className="mt-6 text-sm text-ink/70">
        No account?{' '}
        <Link href="/register" className="font-medium text-accent underline">
          Register
        </Link>
      </p>
    </main>
  );
}
