import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { isEmailConfigured, sendEmail } from '@/lib/email';

// POST /api/auth/reset-password
// Step 1: { action: 'request', username: '...' } — verify user & send email confirmation
// Step 2: { action: 'verify', username: '...' } — check if user exists (fallback)
// Step 3: { action: 'reset', username: '...', newPassword: '...' } — change password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, username, newPassword } = body;

    if (!action || !username) {
      return NextResponse.json({ error: 'Ação e username são obrigatórios' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

    if (action === 'request') {
      // Request password reset — verify user and send confirmation email
      // Try with email field first, fallback without if column doesn't exist
      let userEmail: string | null = null;
      const { data: user, error } = await supabase
        .from('system_users')
        .select('id, username, nome, email, ativo')
        .eq('username', cleanUsername)
        .single();

      // If error (e.g. email column missing), try without email
      let userName = '';
      let userActive = false;
      let userFound = false;

      if (!error && user) {
        userName = user.nome;
        userActive = !!user.ativo;
        userEmail = user.email || null;
        userFound = true;
      } else {
        const { data: fallbackUser, error: fbError } = await supabase
          .from('system_users')
          .select('id, username, nome, ativo')
          .eq('username', cleanUsername)
          .single();

        if (!fbError && fallbackUser) {
          userName = fallbackUser.nome;
          userActive = !!fallbackUser.ativo;
          userFound = true;
        }
      }

      if (!userFound) {
        return NextResponse.json({
          success: true,
          message: 'Se o utilizador existir, receberá um email com instruções.',
        });
      }

      if (!userActive) {
        return NextResponse.json({
          success: true,
          message: 'Se o utilizador existir, receberá um email com instruções.',
        });
      }

      // Try to send email notification (non-blocking)
      if (isEmailConfigured() && userEmail) {
        const html = `
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#c2410c;padding:20px 30px;">
      <h1 style="color:white;margin:0;">🔒 Recuperação de Senha</h1>
      <p style="color:rgba(255,255,255,0.8);margin:5px 0 0 0;font-size:13px;">PGR Angola — Sistema de Controlo de Arguidos</p>
    </div>
    <div style="padding:20px 30px;">
      <p>Olá <strong>${userName}</strong>,</p>
      <p>Foi solicitada a recuperação da senha da sua conta (<strong>${cleanUsername}</strong>).</p>
      <p>Para prosseguir, abra o sistema e utilize a opção <strong>"Esqueceu a senha?"</strong> na página de login para definir uma nova senha.</p>
      <p style="color:#888;font-size:12px;margin-top:20px;">Se não solicitou esta alteração, ignore este email. A sua senha permanecerá inalterada.</p>
      <p style="color:#888;font-size:12px;">Enviado em: ${new Date().toLocaleString('pt-AO')}</p>
    </div>
  </div>
</body></html>`;

        await sendEmail({
          to: userEmail,
          subject: '🔒 PGR Angola — Recuperação de Senha Solicitada',
          html,
        });
      }

      return NextResponse.json({
        exists: true,
        nome: userName,
        message: isEmailConfigured() && userEmail
          ? 'Email de confirmação enviado. Verifique a sua caixa de entrada.'
          : 'Conta verificada. Pode agora definir a nova senha.',
      });
    }

    if (action === 'verify') {
      // Check if user exists and is active (backward compatibility)
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

      // Verify user exists and is active — try with email column, fallback without
      let resetUserEmail: string | null = null;
      const { data: user, error: fetchError } = await supabase
        .from('system_users')
        .select('id, ativo, nome, email')
        .eq('username', cleanUsername)
        .single();

      let resetUserId: number | null = null;
      let resetUserName = '';
      let resetUserActive = false;

      if (!fetchError && user) {
        resetUserId = user.id;
        resetUserName = user.nome;
        resetUserActive = !!user.ativo;
        resetUserEmail = user.email || null;
      } else {
        const { data: fbUser, error: fbErr } = await supabase
          .from('system_users')
          .select('id, ativo, nome')
          .eq('username', cleanUsername)
          .single();
        if (!fbErr && fbUser) {
          resetUserId = fbUser.id;
          resetUserName = fbUser.nome;
          resetUserActive = !!fbUser.ativo;
        }
      }

      if (!resetUserId) {
        return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 });
      }

      if (!resetUserActive) {
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
        .eq('id', resetUserId);

      if (updateError) {
        console.error('Password reset error:', updateError);
        return NextResponse.json({ error: 'Falha ao alterar senha' }, { status: 500 });
      }

      // Send password changed notification email (non-blocking)
      if (isEmailConfigured() && resetUserEmail) {
        const html = `
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#16a34a;padding:20px 30px;">
      <h1 style="color:white;margin:0;">✅ Senha Alterada com Sucesso</h1>
    </div>
    <div style="padding:20px 30px;">
      <p>Olá <strong>${resetUserName}</strong>,</p>
      <p>A senha da sua conta (<strong>${cleanUsername}</strong>) foi alterada com sucesso no Sistema de Controlo de Arguidos em Prisão Preventiva da PGR Angola.</p>
      <p style="color:#888;font-size:12px;margin-top:20px;">Se não fez esta alteração, contacte imediatamente o administrador do sistema.</p>
      <p style="color:#888;font-size:12px;">Enviado em: ${new Date().toLocaleString('pt-AO')}</p>
    </div>
  </div>
</body></html>`;

        await sendEmail({
          to: resetUserEmail,
          subject: '✅ PGR Angola — Senha Alterada com Sucesso',
          html,
        });
      }

      return NextResponse.json({ success: true, message: 'Senha alterada com sucesso' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
