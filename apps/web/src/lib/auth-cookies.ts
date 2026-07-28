import type { NextResponse } from 'next/server';

const isProd = process.env.NODE_ENV === 'production';

/** Access-token cookie lifetime (matches the API's short-lived JWT). */
const ACCESS_MAX_AGE = 60 * 15;
/** Refresh-token cookie lifetime (matches the API's refresh TTL). */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export const ACCESS_COOKIE = 'akp_access';
export const REFRESH_COOKIE = 'akp_refresh';
export const MFA_COOKIE = 'akp_mfa_pending';

function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
  };
}

/**
 * Persist the API-issued session tokens as httpOnly cookies on a response.
 * Centralized so every auth entry point (password + Google) sets identical,
 * secure cookie attributes.
 */
export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const base = baseCookieOptions();
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: ACCESS_MAX_AGE,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE,
  });
}

/**
 * Clear session cookies. Uses the same path/secure/sameSite attributes that
 * were used when setting them so browsers actually drop the cookies.
 */
export function clearAuthCookies(response: NextResponse): void {
  const base = baseCookieOptions();
  response.cookies.set(ACCESS_COOKIE, '', { ...base, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...base, maxAge: 0 });
  response.cookies.set(MFA_COOKIE, '', { ...base, maxAge: 0 });
}
