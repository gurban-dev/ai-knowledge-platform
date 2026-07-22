import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';

interface RegisterSuccessResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

interface RegisterErrorResponse {
  error?: {
    message?: string;
  };
}

type RegisterResponse = RegisterSuccessResponse | RegisterErrorResponse;

interface RegisterRequest {
  email: string;
  password: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterRequest;
  
  const res = await fetch(`${API_URL}/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const json: unknown = await res.json().catch(() => null);
  const data = json as RegisterResponse | null;
  
  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          data && 'error' in data
            ? data.error?.message ?? 'Registration failed'
            : 'Registration failed',
      },
      { status: res.status },
    );
  }
  
  if (!data || !('tokens' in data)) {
    return NextResponse.json(
      { error: 'Invalid registration response' },
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
