'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

const OAUTH_ERRORS: Record<string, string> = {
  google: 'Google sign-up could not be completed. Please try again.',
  google_unavailable:
    'Google sign-up is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.',
};

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
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
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Registration failed');
      return;
    }
    router.push('/app/documents');
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-4xl">Create organization</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-8 space-y-4" noValidate>
        {(
          [
            ['organizationName', 'Organization', 'text'],
            ['name', 'Your name', 'text'],
            ['email', 'Work email', 'email'],
            ['password', 'Password', 'password'],
          ] as const
        ).map(([field, label, type]) => (
          <label key={field} className="block text-sm font-medium">
            {label}
            <input
              type={type}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white/80 px-3 py-2"
              {...form.register(field)}
            />
          </label>
        ))}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white"
        >
          Create account
        </button>
      </form>
      <GoogleSignInButton
        label="Sign up with Google"
        successPath="/app/documents"
        returnTo="/register"
      />
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-accent underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
