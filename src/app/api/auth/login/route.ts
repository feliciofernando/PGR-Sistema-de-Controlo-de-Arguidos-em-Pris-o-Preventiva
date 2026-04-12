import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { createSessionToken, setSessionCookie } from '@/lib/auth';

// In-memory rate limiting (resets on server restart — acceptable for security)
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION = 5 * 60 * 1000; // 5 minutes sliding window

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) {
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  // Check if locked out
  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }

  // Reset if lockout expired
  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttempts.delete(ip);
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  // Check sliding window
  if (now - record.lastAttempt > WINDOW_DURATION) {
    loginAttempts.delete(ip);
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  return { allowed: record.count < MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - record.count) };
}

function recordAttempt(ip: string, success: boolean): void {
  const now = Date.now();

  if (success) {
    loginAttempts.delete(ip);
    return;
  }

  const record = loginAttempts.get(ip);
  if (!record || now - record.lastAttempt > WINDOW_DURATION) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now, lockedUntil: 0 });
  } else {
    record.count += 1;
    record.lastAttempt = now;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION;
    }
  }
}

// POST /api/auth/login — Validate credentials and create session
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // Rate limiting check
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Conta bloqueada. Tente novamente em ${Math.ceil((rateLimit.retryAfter || 0) / 60)} minutos.`,
          locked: true,
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter || 900) },
        }
      );
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Utilizador e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Sanitize input
    const cleanUsername = username.toLowerCase().trim();
    if (cleanUsername.length > 50 || password.length > 100) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 400 }
      );
    }

    // Find user in system_users table
    const { data: user, error } = await supabase
      .from('system_users')
      .select('id, username, nome, role, password_hash, ativo')
      .eq('username', cleanUsername)
      .single();

    if (error || !user) {
      recordAttempt(clientIp, false);
      return NextResponse.json(
        {
          error: 'Credenciais inválidas',
          remaining: checkRateLimit(clientIp).remaining,
        },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.ativo) {
      recordAttempt(clientIp, false);
      return NextResponse.json(
        { error: 'Conta desativada. Contacte o administrador.' },
        { status: 403 }
      );
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      recordAttempt(clientIp, false);
      return NextResponse.json(
        {
          error: 'Credenciais inválidas',
          remaining: checkRateLimit(clientIp).remaining,
        },
        { status: 401 }
      );
    }

    // Record successful login
    recordAttempt(clientIp, true);

    // Update last login and increment login_count
    try {
      const { data: existingUser } = await supabase
        .from('system_users')
        .select('login_count')
        .eq('id', user.id)
        .single();

      await supabase
        .from('system_users')
        .update({
          ultimo_login: new Date().toISOString(),
          login_count: (existingUser?.login_count || 0) + 1,
        })
        .eq('id', user.id);
    } catch {
      // Non-critical — ignore
    }

    // Create JWT session token
    const sessionToken = await createSessionToken({
      userId: user.id,
      username: user.username,
      nome: user.nome,
      role: user.role,
    });

    // Return user info with session token
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nome: user.nome,
        role: user.role,
      },
      sessionToken, // Client can store this for API calls
    });

    // Set httpOnly session cookie
    setSessionCookie(response, sessionToken);

    return response;
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
