import { defaultLocale } from '@/i18n/config';
import { type NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url), 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
