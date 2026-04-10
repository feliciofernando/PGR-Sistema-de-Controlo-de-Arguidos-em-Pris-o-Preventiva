import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

// POST /api/auth/reset-password
// Step 1: { action: 'verify', username: '...' } — check if user exists
// Step 2: { action: 'reset', username: '...', newPassword: '...' } — change password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, username, newPassword } = body;

    if (!action || !username) {
      return NextResponse.json({ error: 'Ação e username são obrigatórios' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

    if (action === 'verify') {
      // Check if user exists and is active
      const { data: user, error } = await supabase
        .from('system_users')
        .select('id, username, nome, ativo')
        .eq('username', cleanUsername)
        .single();

      if (error || !user) {
        return NextResponse.json({ exists: false, error: 'Utilizador não encontrado' }, { status: 404 });
      }

      if (!user.ativo) {
        return NextResponse.json({ exists: false, error: 'Conta desativada. Contacte o administrador.' }, { status: 403 });
      }

      return NextResponse.json({ exists: true, nome: user.nome });
    }

    if (action === 'reset') {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres' }, { status: 400 });
      }

      // Verify user exists and is active
      const { data: user, error: fetchError } = await supabase
        .from('system_users')
        .select('id, ativo')
        .eq('username', cleanUsername)
        .single();

      if (fetchError || !user) {
        return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 });
      }

      if (!user.ativo) {
        return NextResponse.json({ error: 'Conta desativada. Contacte o administrador.' }, { status: 403 });
      }

      // Hash new password and update
      const passwordHash = await bcrypt.hash(newPassword, 12);

      const { error: updateError } = await supabase
        .from('system_users')
        .update({
          password_hash: passwordHash,
          ultimo_login: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Password reset error:', updateError);
        return NextResponse.json({ error: 'Falha ao alterar senha' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Senha alterada com sucesso' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
