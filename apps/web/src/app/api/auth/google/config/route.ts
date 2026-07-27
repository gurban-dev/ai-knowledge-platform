import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';

/**
 * Proxy the public Google GIS client id from the API so the browser modal can
 * render Google's button without baking secrets (or even the client id) into
 * the Next build via NEXT_PUBLIC_*.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(`${API_URL}/v1/auth/google/config`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ enabled: false, clientId: null });
    }
    const data = (await res.json()) as { enabled?: boolean; clientId?: string | null };
    return NextResponse.json({
      enabled: Boolean(data.enabled && data.clientId),
      clientId: data.clientId ?? null,
    });
  } catch {
    return NextResponse.json({ enabled: false, clientId: null });
  }
}
