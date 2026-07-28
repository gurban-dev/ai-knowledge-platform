import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
} from '@/lib/auth-cookies';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { tokens?: TokenPair } | null;
  if (!data?.tokens?.accessToken || !data.tokens.refreshToken) return null;
  return data.tokens;
}

/**
 * Authenticated BFF proxy. Resolves a usable access token from cookies,
 * silently rotating via the refresh token when needed, then forwards to the API.
 *
 * A 401 here after logout is expected: both cookies are gone. Mid-session 401s
 * from an expired access JWT are recovered via refresh when possible.
 */
async function proxy(request: Request, path: string[]): Promise<NextResponse> {
  const cookieStore = cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  let rotated: TokenPair | null = null;

  if (!accessToken && refreshToken) {
    rotated = await refreshTokens(refreshToken);
    accessToken = rotated?.accessToken;
  }

  if (!accessToken) {
    const unauthorized = NextResponse.json(
      { error: { message: 'Unauthorized' } },
      { status: 401 },
    );
    // If a stale refresh cookie exists but cannot be rotated, drop the session.
    if (refreshToken) clearAuthCookies(unauthorized);
    return unauthorized;
  }

  // Buffer the body once so a refresh+retry can resend it.
  const method = request.method;
  const canRetryBody = method !== 'GET' && method !== 'HEAD';
  const bodyText = canRetryBody ? await request.text() : undefined;

  const send = async (token: string): Promise<Response> => {
    const url = new URL(request.url);
    const target = `${API_URL}/${path.join('/')}${url.search}`;
    const headers = new Headers();
    headers.set('authorization', `Bearer ${token}`);
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    return fetch(target, {
      method,
      headers,
      ...(bodyText !== undefined ? { body: bodyText } : {}),
    });
  };

  let upstream = await send(accessToken);

  // Access JWT may have expired while the refresh cookie is still valid.
  if (upstream.status === 401 && refreshToken) {
    rotated = await refreshTokens(refreshToken);
    if (rotated) {
      upstream = await send(rotated.accessToken);
    }
  }

  const body = await upstream.text();
  const response = new NextResponse(body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });

  if (rotated) {
    setAuthCookies(response, rotated);
  }

  // Refresh rejected / session revoked — clear local cookies so middleware
  // sends the user back to login on the next navigation.
  if (upstream.status === 401) {
    clearAuthCookies(response);
  }

  return response;
}

export async function GET(
  request: Request,
  context: { params: { path: string[] } },
) {
  return proxy(request, context.params.path);
}

export async function POST(
  request: Request,
  context: { params: { path: string[] } },
) {
  return proxy(request, context.params.path);
}

export async function PUT(
  request: Request,
  context: { params: { path: string[] } },
) {
  return proxy(request, context.params.path);
}

export async function DELETE(
  request: Request,
  context: { params: { path: string[] } },
) {
  return proxy(request, context.params.path);
}
