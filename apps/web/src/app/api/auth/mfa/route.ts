import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { setAuthCookies } from '@/lib/auth-cookies';

const MFA_COOKIE = 'akp_mfa_pending';

interface CompleteResponse {
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  error?: {
    message?: string;
  };
}

/**
 * Complete an MFA challenge after password or Google primary-factor success.
 * The pending MFA token is read from the httpOnly cookie set by the login or
 * Google callback routes.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    mfaCode?: string;
    recoveryCode?: string;
  };

  const mfaToken = cookies().get(MFA_COOKIE)?.value;
  if (!mfaToken) {
    return NextResponse.json(
      { error: 'MFA challenge expired. Please sign in again.' },
      { status: 401 },
    );
  }

  const res = await fetch(`${API_URL}/v1/auth/mfa/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mfaToken,
      ...(body.mfaCode ? { mfaCode: body.mfaCode } : {}),
      ...(body.recoveryCode ? { recoveryCode: body.recoveryCode } : {}),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as CompleteResponse;
  if (!res.ok || !data.tokens) {
    return NextResponse.json(
      { error: data.error?.message ?? 'Invalid authentication code' },
      { status: res.status },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(MFA_COOKIE);
  setAuthCookies(response, data.tokens);
  return response;
}
