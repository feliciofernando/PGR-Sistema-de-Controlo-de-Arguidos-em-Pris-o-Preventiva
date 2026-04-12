import { NextRequest } from 'next/server';
import { authMiddleware } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  // Apply auth protection to API routes
  const authResult = await authMiddleware(request);
  if (authResult) return authResult;

  // Continue to route handler
  return null;
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};
