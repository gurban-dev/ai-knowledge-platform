import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { setAuthCookies } from '@/lib/auth-cookies';

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

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email: string;
    password: string;
    name?: string;
    organizationName?: string;
  };

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
    return NextResponse.json({ error: 'Invalid registration response' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, data.tokens);
  return response;
}
