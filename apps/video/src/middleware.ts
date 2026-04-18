import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/dashboard', '/live/new', '/wallet'];

/**
 * Middleware gate — requires a Privy-emitted cookie before allowing through
 * to a protected route. We accept any of the three tokens Privy may emit:
 *
 * - `privy-token` (access token): short-lived (~1 h), the canonical auth.
 * - `privy-id-token` (identity token): long-lived (days / weeks). Preferred
 *   server-side because it outlives the access token and can be validated
 *   via a direct Privy API call (`users().get({id_token})`) without the
 *   local JWKS verification path that intermittently fails on edge.
 * - `privy-session` (refresh token): present even after the access token
 *   has expired. Treated as "probably authenticated — let the RSC try and
 *   the client SDK refresh if it has to". This avoids hard-redirecting to
 *   `/` every hour when the access token rolls over.
 *
 * OAuth callback requests are passed through so the client-side flow can
 * finish and set the cookies.
 */
const PRIVY_COOKIE_NAMES = [
  'privy-id-token',
  '__Host-privy-id-token',
  'privy-token',
  '__Host-privy-token',
  'privy-session',
  '__Host-privy-session',
] as const;

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (searchParams.get('privy_oauth_code')) return NextResponse.next();

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const hasPrivyCookie = PRIVY_COOKIE_NAMES.some((name) => request.cookies.get(name)?.value);
  if (!hasPrivyCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/live/new/:path*', '/wallet/:path*'],
};
