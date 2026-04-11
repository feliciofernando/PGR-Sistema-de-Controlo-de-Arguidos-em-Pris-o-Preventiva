import nodemailer from 'nodemailer';

// Shared Gmail SMTP transporter — used by all email features
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const user = process.env.SMTP_GMAIL_USER;
  const pass = process.env.SMTP_GMAIL_APP_PASSWORD;

  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // TLS via STARTTLS
    auth: { user, pass },
  });

  return transporter;
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_GMAIL_USER && process.env.SMTP_GMAIL_APP_PASSWORD);
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const transport = getTransporter();

  if (!transport) {
    return {
      success: false,
      error: 'SMTP não configurado. Defina SMTP_GMAIL_USER e SMTP_GMAIL_APP_PASSWORD nas variáveis de ambiente.',
    };
  }

  try {
    const info = await transport.sendMail({
      from: `"PGR Angola" <${process.env.SMTP_GMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log('[Email] Sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email] Send error:', err);
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, error: msg };
  }
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const html = `
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#c2410c;padding:20px 30px;">
      <h1 style="color:white;margin:0;">⚖️ PGR Angola — Email de Teste</h1>
      <p style="color:rgba(255,255,255,0.8);margin:5px 0 0 0;font-size:13px;">Sistema de Controlo de Arguidos em Prisão Preventiva</p>
    </div>
    <div style="padding:20px 30px;">
      <p>Este é um <strong>email de teste</strong> do Sistema de Controlo de Arguidos em Prisão Preventiva da PGR Angola.</p>
      <p>Se recebeu este email, as notificações por email estão a funcionar corretamente via <strong>Gmail SMTP</strong>.</p>
      <p style="color:#888;font-size:12px;">Enviado em: ${new Date().toLocaleString('pt-AO')}</p>
    </div>
  </div>
</body></html>`;

  return sendEmail({
    to,
    subject: '📧 PGR Angola — Email de Teste (Gmail SMTP)',
    html,
  });
}
