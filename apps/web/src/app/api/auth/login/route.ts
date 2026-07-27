import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { setAuthCookies } from '@/lib/auth-cookies';

const MFA_COOKIE = 'akp_mfa_pending';

type LoginResponse =
  | {
      tokens: {
        accessToken: string;
        refreshToken: string;
      };
    }
  | {
      error?: {
        code?: string;
        message?: string;
        details?: {
          mfaToken?: string;
        };
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

  if (res.status === 401 && 'error' in data && data.error?.code === 'MFA_REQUIRED') {
    const mfaToken = data.error.details?.mfaToken;
    if (!mfaToken) {
      return NextResponse.json({ error: 'MFA challenge failed' }, { status: 401 });
    }
    const response = NextResponse.json({ mfaRequired: true });
    response.cookies.set(MFA_COOKIE, mfaToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 5,
    });
    return response;
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: 'error' in data ? data.error?.message ?? 'Login failed' : 'Login failed' },
      { status: res.status },
    );
  }

  if (!('tokens' in data)) {
    return NextResponse.json({ error: 'Invalid login response' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, data.tokens);
  return response;
}
