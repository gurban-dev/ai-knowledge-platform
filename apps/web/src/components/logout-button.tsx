'use client';

import { useState } from 'react';

/**
 * Revokes the server session (via BFF) and clears httpOnly auth cookies, then
 * sends the user to the login page. Safe to click twice: logout is idempotent.
 *
 * Uses a full navigation after logout so middleware and client caches cannot
 * keep serving `/app` pages that would immediately 401 against the proxy.
 */
export function LogoutButton({
  className = 'w-full rounded-md border border-ink/15 px-2 py-1.5 text-left text-sm font-medium text-ink/80 transition hover:bg-white/70 hover:text-ink disabled:opacity-60',
}: {
  className?: string;
}): JSX.Element {
  const [pending, setPending] = useState(false);

  const logout = async () => {
    if (pending) return;
    setPending(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
      });
    } catch {
      // Cookies may still clear on a later attempt; always leave the app shell.
    }
    window.location.assign('/login');
  };

  return (
    <button type="button" className={className} onClick={() => void logout()} disabled={pending}>
      {pending ? 'Signing out…' : 'Log out'}
    </button>
  );
}
