import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth-cookies';

/**
 * Session gate for the authenticated app shell.
 *
 * After logout both auth cookies are cleared. Without this middleware, `/app/*`
 * pages still render and their client fetches hit `/api/proxy` → 401, which
 * looks like a broken session. Redirect unauthenticated visitors to login
 * instead of serving a shell that cannot call the API.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(
    request.cookies.get(ACCESS_COOKIE)?.value ?? request.cookies.get(REFRESH_COOKIE)?.value,
  );

  const isAppRoute = pathname.startsWith('/app');
  const isAuthRoute =
    pathname === '/login' || pathname.startsWith('/login/') || pathname === '/register';

  if (isAppRoute && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged-in users should not sit on auth forms.
  if (isAuthRoute && hasSession && pathname !== '/login/mfa') {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = '/app/chat';
    appUrl.search = '';
    return NextResponse.redirect(appUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/login', '/login/:path*', '/register'],
};
