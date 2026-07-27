import type { NextResponse } from 'next/server';

const isProd = process.env.NODE_ENV === 'production';

/** Access-token cookie lifetime (matches the API's short-lived JWT). */
const ACCESS_MAX_AGE = 60 * 15;
/** Refresh-token cookie lifetime (matches the API's refresh TTL). */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Persist the API-issued session tokens as httpOnly cookies on a response.
 * Centralized so every auth entry point (password + Google) sets identical,
 * secure cookie attributes.
 */
export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): void {
  response.cookies.set('akp_access', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: ACCESS_MAX_AGE,
  });
  response.cookies.set('akp_refresh', tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
}
