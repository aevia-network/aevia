import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/dashboard', '/live/new'];

/**
 * Middleware gate — requires a *real* Privy token cookie before allowing
 * through to a protected route. Per Privy's documented semantics:
 *
 * - `privy-token` (access token): definitively authenticated.
 * - `privy-id-token` (identity token): definitively authenticated.
 * - `privy-session` alone: *maybe* authenticated — the user has a refresh
 *   token but no current access token, and the client needs to refresh.
 *   We intentionally do NOT accept this as proof of session at the edge,
 *   because letting such a request through would land the RSC render
 *   without a verifiable token, `readAeviaSession` would return null, and
 *   the server component would redirect back to `/` — a potential loop.
 *
 * OAuth callback requests (with `privy_oauth_code` in the query string) are
 * passed through untouched so the client-side flow can finish and set the
 * cookies.
 */
const AUTHENTICATED_COOKIE_NAMES = [
  'privy-token',
  'privy-id-token',
  '__Host-privy-token',
  '__Host-privy-id-token',
] as const;

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Never interfere with Privy's OAuth callback.
  if (searchParams.get('privy_oauth_code')) return NextResponse.next();

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const hasAuthToken = AUTHENTICATED_COOKIE_NAMES.some((name) => request.cookies.get(name)?.value);
  if (!hasAuthToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
