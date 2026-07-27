import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { setAuthCookies } from '@/lib/auth-cookies';

const MFA_COOKIE = 'akp_mfa_pending';

type CredentialResponse =
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

/**
 * Complete Google sign-in from the GIS in-page button. The browser posts
 * Google's OIDC `credential` (id_token); we forward it to the API, set session
 * cookies, and return a small JSON result for the modal to navigate on.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { idToken?: string };
  if (!body.idToken) {
    return NextResponse.json({ error: 'Missing Google credential' }, { status: 400 });
  }

  const res = await fetch(`${API_URL}/v1/auth/google/credential`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: body.idToken }),
  });

  const data = (await res.json().catch(() => ({}))) as CredentialResponse;

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

  if (res.status === 403 || res.status === 501) {
    return NextResponse.json(
      {
        error:
          'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart the API.',
      },
      { status: 503 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          'error' in data ? data.error?.message ?? 'Google sign-in failed' : 'Google sign-in failed',
      },
      { status: res.status },
    );
  }

  if (!('tokens' in data) || !data.tokens) {
    return NextResponse.json({ error: 'Invalid Google sign-in response' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, data.tokens);
  return response;
}
