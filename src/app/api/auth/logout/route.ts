import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

// POST /api/auth/logout - Clear session cookie
export async function POST() {
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
