import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/dashboard', '/live/new'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get('aevia_sid')?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Signature verification happens in server components / API routes where
  // `jose` can access the secret. Middleware runs on edge and just gates on
  // cookie presence — compromised-cookie attacks are caught downstream.
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/live/new/:path*'],
};
