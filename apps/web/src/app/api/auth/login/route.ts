import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';

type LoginResponse =
  | {
      tokens: {
        accessToken: string;
        refreshToken: string;
      };
    }
  | {
      error?: {
        message?: string;
      };
    };

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email: string;
    password: string;
  };

  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as LoginResponse;

  if (!res.ok) {
    return NextResponse.json(
      { error: 'error' in data ? data.error?.message ?? 'Login failed' : 'Login failed' },
      { status: res.status },
    );
  }
  
  if (!('tokens' in data)) {
    return NextResponse.json(
      { error: 'Invalid login response' },
      { status: 500 },
    );
  }

  const cookieStore = cookies();
  cookieStore.set('akp_access', data.tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 15,
  });
  cookieStore.set('akp_refresh', data.tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
