import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/dashboard', '/live/new'];

// Privy sets these cookies after login. We accept any as proof of session
// presence; server components/API routes do the actual verification.
const PRIVY_COOKIE_NAMES = [
  'privy-id-token',
  'privy-token',
  'privy-session',
  '__Host-privy-id-token',
  '__Host-privy-token',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const hasSession = PRIVY_COOKIE_NAMES.some((name) => request.cookies.get(name)?.value);
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/live/new/:path*'],
};
