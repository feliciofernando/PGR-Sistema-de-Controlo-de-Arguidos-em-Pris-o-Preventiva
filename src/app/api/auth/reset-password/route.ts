import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isEmailConfigured, sendEmail } from '@/lib/email';

// POST /api/auth/reset-password
// Sends a recovery email with a secure Supabase Auth link
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Look up user in system_users by email
    let userFound = false;
    let userName = '';
    let userEmail = '';

    // Try with email column first
    const { data: user, error } = await supabase
      .from('system_users')
      .select('id, username, nome, email, ativo')
      .eq('email', cleanEmail)
      .single();

    if (!error && user) {
      userName = user.nome;
      userEmail = user.email || cleanEmail;
      userFound = true;
    } else {
      // Fallback: try matching by username (if user typed username instead of email)
      const { data: fallbackUser, error: fbErr } = await supabase
        .from('system_users')
        .select('id, username, nome, email, ativo')
        .eq('username', cleanEmail)
        .single();

      if (!fbErr && fallbackUser) {
        userName = fallbackUser.nome;
        userEmail = fallbackUser.email || '';
        userFound = true;
      }
    }

    // Security: always return success to prevent user enumeration
    if (!userFound) {
      return NextResponse.json({
        success: true,
        message: 'Se este email estiver registado, receberá um link de recuperação.',
      });
    }

    if (!userEmail) {
      return NextResponse.json({
        success: true,
        message: 'Este utilizador não tem email configurado. Contacte o administrador.',
      });
    }

    // Check email configuration
    if (!isEmailConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Email não configurado. Contacte o administrador do sistema.',
      });
    }

    // 2. Ensure user exists in Supabase Auth (for token generation)
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers({
        filters: { email: userEmail },
      });

      if (!authUsers?.users || authUsers.users.length === 0) {
        // Create user in Supabase Auth with random password (not used for login)
        const randomPassword = crypto.randomUUID() + crypto.randomUUID();
        await supabase.auth.admin.createUser({
          email: userEmail,
          password: randomPassword,
          email_confirm: true,
          user_metadata: { nome: userName, managed_by: 'system_users' },
        });
        console.log(`[Auth] Created Supabase Auth user for ${userEmail}`);
      }
    } catch (authErr) {
      console.error('[Auth] Error syncing Supabase Auth user:', authErr);
      // Continue anyway — the link generation might still work
    }

    // 3. Generate recovery link via Supabase Auth Admin API
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: userEmail,
      redirectTo: siteUrl,
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[Auth] Generate link error:', linkError);
      return NextResponse.json({
        success: false,
        error: 'Falha ao gerar link de recuperação. Tente novamente.',
      });
    }

    // 4. Send email via Gmail SMTP (nodemailer)
    const recoveryLink = linkData.properties.action_link;
    const html = `
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;padding:20px;margin:0;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#c2410c;padding:20px 30px;">
      <h1 style="color:white;margin:0;font-size:22px;">🔒 Recuperação de Senha</h1>
      <p style="color:rgba(255,255,255,0.8);margin:5px 0 0 0;font-size:13px;">PGR Angola — Sistema de Controlo de Arguidos em Prisão Preventiva</p>
    </div>
    <div style="padding:25px 30px;">
      <p>Olá <strong>${userName}</strong>,</p>
      <p>Recebemos um pedido de recuperação de senha para a sua conta no Sistema de Controlo de Arguidos.</p>
      <p>Clique no botão abaixo para definir uma nova senha:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${recoveryLink}" style="background:#c2410c;color:white;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
          🔑 Redefinir Minha Senha
        </a>
      </div>
      <p style="color:#888;font-size:12px;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
      <p style="color:#c2410c;font-size:11px;word-break:break-all;">${recoveryLink}</p>
      <div style="margin-top:25px;padding-top:15px;border-top:1px solid #eee;">
        <p style="color:#888;font-size:11px;">Este link é válido por <strong>1 hora</strong>. Após esse prazo, será necessário solicitar um novo link.</p>
        <p style="color:#888;font-size:11px;">Se não solicitou esta alteração, ignore este email. A sua senha permanecerá inalterada.</p>
        <p style="color:#aaa;font-size:10px;margin-top:10px;">Enviado em: ${new Date().toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' })}</p>
      </div>
    </div>
  </div>
</body></html>`;

    const result = await sendEmail({
      to: userEmail,
      subject: '🔒 PGR Angola — Recuperação de Senha',
      html,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Email de recuperação enviado com sucesso.',
      });
    }

    console.error('[Auth] Email send error:', result.error);
    return NextResponse.json({
      success: false,
      error: 'Falha ao enviar o email. Verifique a configuração SMTP.',
    });
  } catch (error) {
    console.error('[Auth] Reset password error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
