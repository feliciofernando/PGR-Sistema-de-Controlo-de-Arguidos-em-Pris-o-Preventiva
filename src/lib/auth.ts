import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

// Session configuration
const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'pgr-angola-session-secret-key-change-in-production-2024'
);

const SESSION_COOKIE_NAME = 'pgr_session';
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours

export interface SessionPayload {
  userId: number;
  username: string;
  nome: string;
  role: string;
}

// Create a signed JWT session token
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}sec`)
    .setIssuer('pgr-angola')
    .setAudience('pgr-angola-api')
    .sign(SESSION_SECRET);
  return token;
}

// Verify and decode a JWT session token
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      issuer: 'pgr-angola',
      audience: 'pgr-angola-api',
    });
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      nome: payload.nome as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

// Set session cookie on response
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

// Clear session cookie on response
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

// Get session from request cookies
export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/reset-password',
  '/api/auth/update-password',
  '/api/arguidos/search-public',
];

// Check if a route is public
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

// Middleware handler for API route protection
export async function authMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return null; // Continue to route handler
  }

  // Only protect /api/ routes
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  // Check for session cookie
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(
      { error: 'Sessão expirada. Por favor, faça login novamente.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // Role-based access control for sensitive routes
  if (pathname.startsWith('/api/users') && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Acesso negado. Apenas administradores podem gerir utilizadores.', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (pathname.startsWith('/api/backup') && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Acesso negado. Apenas administradores podem gerir backups.', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // Add user info to request headers for downstream handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(session.userId));
  requestHeaders.set('x-user-username', session.username);
  requestHeaders.set('x-user-nome', session.nome);
  requestHeaders.set('x-user-role', session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
