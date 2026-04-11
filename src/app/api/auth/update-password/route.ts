import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

// POST /api/auth/update-password
// Updates password using a Supabase Auth recovery token
export async function POST(request: NextRequest) {
  try {
    const { access_token, new_password } = await request.json();

    if (!access_token || !new_password) {
      return NextResponse.json({ error: 'Token e nova senha são obrigatórios' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }

    // 1. Verify the recovery token via Supabase Auth
    const { data: userData, error: authError } = await supabase.auth.getUser(access_token);

    if (authError || !userData?.user) {
      console.error('[Auth] Token verification failed:', authError);
      return NextResponse.json(
        { error: 'Link inválido ou expirado. Solicite um novo link de recuperação.' },
        { status: 401 }
      );
    }

    const userEmail = userData.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: 'Email não encontrado no token.' }, { status: 400 });
    }

    // 2. Look up user in system_users by email
    const { data: systemUser, error: dbError } = await supabase
      .from('system_users')
      .select('id, username, nome, email, ativo')
      .eq('email', userEmail)
      .single();

    if (dbError || !systemUser) {
      console.error('[Auth] System user not found for email:', userEmail);
      return NextResponse.json(
        { error: 'Utilizador não encontrado no sistema. Contacte o administrador.' },
        { status: 404 }
      );
    }

    if (!systemUser.ativo) {
      return NextResponse.json(
        { error: 'Conta desativada. Contacte o administrador.' },
        { status: 403 }
      );
    }

    // 3. Hash new password and update system_users
    const passwordHash = await bcrypt.hash(new_password, 12);

    const { error: updateError } = await supabase
      .from('system_users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', systemUser.id);

    if (updateError) {
      console.error('[Auth] Password update error:', updateError);
      return NextResponse.json({ error: 'Falha ao atualizar senha.' }, { status: 500 });
    }

    // 4. Also update Supabase Auth password to keep in sync
    try {
      await supabase.auth.admin.updateUserById(userData.user.id, {
        password: new_password,
      });
    } catch (syncErr) {
      // Non-critical: system_users is the primary auth source
      console.warn('[Auth] Could not sync Supabase Auth password:', syncErr);
    }

    console.log(`[Auth] Password updated for user: ${systemUser.username} (${userEmail})`);

    return NextResponse.json({
      success: true,
      message: 'Senha alterada com sucesso.',
    });
  } catch (error) {
    console.error('[Auth] Update password error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
