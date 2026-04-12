import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, SESSION_COOKIE_NAME } from '@/lib/auth';

// GET /api/auth/me - Validate current session and return user info
// This is a PUBLIC route that checks session validity without middleware interference
// Runs on Node.js runtime (not Edge), so JWT verification is guaranteed to work
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      // Include diagnostic info to help debug session issues
      const hasCookie = !!request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const cookieLength = request.cookies.get(SESSION_COOKIE_NAME)?.value?.length || 0;
      const hasAuthHeader = !!request.headers.get('authorization');
      const authHeaderLength = request.headers.get('authorization')?.length || 0;
      console.error('[Auth] /api/auth/me - Session invalid. Cookie:', hasCookie, `(len:${cookieLength})`, 'AuthHeader:', hasAuthHeader, `(len:${authHeaderLength})`);

      return NextResponse.json(
        {
          error: 'Sessão expirada',
          code: 'UNAUTHORIZED',
          debug: { hasCookie, cookieLength, hasAuthHeader, authHeaderLength }
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        username: session.username,
        nome: session.nome,
        role: session.role,
      },
    });
  } catch (error) {
    console.error('[Auth] /me error:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar sessão' },
      { status: 500 }
    );
  }
}
