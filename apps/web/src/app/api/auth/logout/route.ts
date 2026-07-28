import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { clearAuthCookies, REFRESH_COOKIE } from '@/lib/auth-cookies';

/**
 * End the browser session:
 * 1. Best-effort revoke the refresh-token session on the API (idempotent).
 * 2. Always clear auth cookies so the client cannot keep calling the app.
 *
 * Cookie clearing succeeds even if the API is unreachable — logout must not
 * trap the user in a broken session.
 */
export async function POST(): Promise<NextResponse> {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // Ignore — local cookie clear still completes logout for this browser.
    }
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
