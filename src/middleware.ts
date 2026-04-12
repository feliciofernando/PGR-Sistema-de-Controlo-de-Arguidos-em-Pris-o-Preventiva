import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  try {
    // Debug: log auth header presence for non-public API routes
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
      const hasCookie = !!request.cookies.get('pgr_session')?.value;
      const hasAuthHeader = !!request.headers.get('authorization');
      console.log(`[Middleware] ${pathname} - cookie: ${hasCookie}, authHeader: ${hasAuthHeader}`);
    }

    // Apply auth protection to API routes
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;

    // Continue to route handler
    return NextResponse.next();
  } catch (error) {
    console.error('[Middleware] Fatal error for', pathname, ':', error);
    // Don't block the request if middleware fails - let the API route handle it
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};
