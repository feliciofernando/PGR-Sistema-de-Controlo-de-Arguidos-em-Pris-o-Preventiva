import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isEmailConfigured, sendEmail, sendTestEmail } from '@/lib/email';

// GET /api/notifications/email — Send email notifications for deadline warnings
// Uses Gmail SMTP (nodemailer) — no Resend dependency
export async function GET() {
  try {
    const emailEnabled = process.env.NEXT_PUBLIC_EMAIL_ENABLED === 'true';

    if (!emailEnabled) {
      return NextResponse.json({
        success: false,
        message: 'Notificações por email desativadas. Defina NEXT_PUBLIC_EMAIL_ENABLED=true.',
        hint: 'Configure SMTP_GMAIL_USER e SMTP_GMAIL_APP_PASSWORD nas variáveis de ambiente.',
      });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'SMTP Gmail não configurado.',
        hint: 'Defina SMTP_GMAIL_USER e SMTP_GMAIL_APP_PASSWORD nas variáveis de ambiente (Vercel ou .env.local).',
      });
    }

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Fetch arguidos with deadlines expiring within 7 days
    const { data: urgentArguidos, error } = await supabase
      .from('arguidos')
      .select('id, numero_id, numero_processo, nome_arguido, fim_primeiro_prazo, fim_segundo_prazo, magistrado, status')
      .in('status', ['ativo', 'vencido'])
      .or(`fim_primeiro_prazo.lte.${sevenDaysFromNow},fim_segundo_prazo.lte.${sevenDaysFromNow}`);

    if (error) {
      console.error('Email notification fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!urgentArguidos || urgentArguidos.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'Nenhum prazo urgente encontrado.',
      });
    }

    // Categorize by urgency
    interface UrgentItem {
      numeroId: string;
      numeroProcesso: string;
      nomeArguido: string;
      deadline: string;
      daysRemaining: number;
      tipo: string;
      magistrado: string;
      urgency: 'expirado' | 'critico' | 'atencao';
    }

    const items: UrgentItem[] = [];
    for (const a of urgentArguidos) {
      const prazos = [
        { date: a.fim_primeiro_prazo, tipo: '1º Prazo' },
        { date: a.fim_segundo_prazo, tipo: '2º Prazo' },
      ].filter(p => p.date);

      for (const p of prazos) {
        const days = Math.ceil((new Date(p.date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 7) {
          let urgency: UrgentItem['urgency'] = 'atencao';
          if (days < 0) urgency = 'expirado';
          else if (days <= 3) urgency = 'critico';

          items.push({
            numeroId: a.numero_id,
            numeroProcesso: a.numero_processo,
            nomeArguido: a.nome_arguido,
            deadline: p.date!,
            daysRemaining: days,
            tipo: p.tipo,
            magistrado: a.magistrado,
            urgency,
          });
        }
      }
    }

    items.sort((a, b) => {
      const order = { expirado: 0, critico: 1, atencao: 2 };
      return order[a.urgency] - order[b.urgency];
    });

    const expirados = items.filter(i => i.urgency === 'expirado');
    const criticos = items.filter(i => i.urgency === 'critico');
    const atencao = items.filter(i => i.urgency === 'atencao');

    const subject = `🔔 PGR Angola — Alerta de Prazos (${expirados.length} expirados, ${criticos.length} críticos)`;
    const htmlBody = buildEmailHTML(expirados, criticos, atencao);

    const adminEmail = process.env.ADMIN_EMAIL || '';
    if (!adminEmail) {
      return NextResponse.json({
        success: false,
        message: 'ADMIN_EMAIL não definido.',
        hint: 'Defina ADMIN_EMAIL nas variáveis de ambiente (email do destinatário dos alertas).',
        preview: { expirados: expirados.length, criticos: criticos.length, atencao: atencao.length },
      });
    }

    // Send via Gmail SMTP
    const result = await sendEmail({ to: adminEmail, subject, html: htmlBody });

    if (result.success) {
      return NextResponse.json({
        success: true,
        provider: 'gmail-smtp',
        sent: items.length,
        messageId: result.messageId,
        summary: { expirados: expirados.length, criticos: criticos.length, atencao: atencao.length },
      });
    }

    return NextResponse.json({
      success: false,
      provider: 'gmail-smtp',
      error: result.error,
      message: 'Falha ao enviar email via Gmail SMTP.',
      preview: { expirados: expirados.length, criticos: criticos.length, atencao: atencao.length },
    });
  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json({ error: 'Failed to process email notifications' }, { status: 500 });
  }
}

// POST /api/notifications/email — Send a test email
export async function POST() {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'SMTP Gmail não configurado.',
        hint: 'Defina SMTP_GMAIL_USER e SMTP_GMAIL_APP_PASSWORD nas variáveis de ambiente.',
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL || '';
    if (!adminEmail) {
      return NextResponse.json({
        success: false,
        message: 'ADMIN_EMAIL não definido.',
        hint: 'Defina ADMIN_EMAIL (email do destinatário) nas variáveis de ambiente.',
      });
    }

    const result = await sendTestEmail(adminEmail);

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId, sentTo: adminEmail, provider: 'gmail-smtp' });
    }

    return NextResponse.json({
      success: false,
      error: result.error,
      hint: 'Verifique SMTP_GMAIL_USER e SMTP_GMAIL_APP_PASSWORD. Para Gmail, use uma "Senha de App" (não a senha normal).',
    }, { status: 500 });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}

function buildEmailHTML(
  expirados: Array<{ numeroId: string; nomeArguido: string; deadline: string; daysRemaining: number; tipo: string; magistrado: string }>,
  criticos: Array<{ numeroId: string; nomeArguido: string; deadline: string; daysRemaining: number; tipo: string; magistrado: string }>,
  atencao: Array<{ numeroId: string; nomeArguido: string; deadline: string; daysRemaining: number; tipo: string; magistrado: string }>,
): string {
  const row = (item: { numeroId: string; nomeArguido: string; deadline: string; daysRemaining: number; tipo: string; magistrado: string }, color: string) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;color:#333;">${item.numeroId}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.nomeArguido}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.tipo}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.deadline}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${color};font-weight:bold;">
        ${item.daysRemaining < 0 ? `Expirado há ${Math.abs(item.daysRemaining)} dias` : item.daysRemaining === 0 ? 'Vence hoje!' : `${item.daysRemaining} dias`}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.magistrado}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
  <div style="max-width:700px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#c2410c;padding:20px 30px;">
      <h1 style="color:white;margin:0;font-size:20px;">⚖️ PGR Angola — Alerta de Prazos</h1>
      <p style="color:rgba(255,255,255,0.8);margin:5px 0 0 0;font-size:13px;">Sistema de Controlo de Arguidos em Prisão Preventiva</p>
    </div>
    <div style="padding:20px 30px;">
      <p style="color:#555;font-size:14px;">Relatório automático de prazos processuais — <strong>${new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></p>
      
      ${expirados.length > 0 ? `
      <h2 style="color:#d9534f;font-size:16px;margin-top:20px;">🔴 Prazos Expirados (${expirados.length})</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
        <thead><tr style="background:#fee2e2;">
          <th style="padding:8px 12px;text-align:left;">ID</th>
          <th style="padding:8px 12px;text-align:left;">Arguido</th>
          <th style="padding:8px 12px;text-align:left;">Prazo</th>
          <th style="padding:8px 12px;text-align:left;">Data</th>
          <th style="padding:8px 12px;text-align:left;">Status</th>
          <th style="padding:8px 12px;text-align:left;">Magistrado</th>
        </tr></thead>
        <tbody>${expirados.map(i => row(i, '#d9534f')).join('')}</tbody>
      </table>` : ''}
      
      ${criticos.length > 0 ? `
      <h2 style="color:#e07020;font-size:16px;margin-top:20px;">🟠 Prazos Críticos (${criticos.length})</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
        <thead><tr style="background:#ffedd5;">
          <th style="padding:8px 12px;text-align:left;">ID</th>
          <th style="padding:8px 12px;text-align:left;">Arguido</th>
          <th style="padding:8px 12px;text-align:left;">Prazo</th>
          <th style="padding:8px 12px;text-align:left;">Data</th>
          <th style="padding:8px 12px;text-align:left;">Status</th>
          <th style="padding:8px 12px;text-align:left;">Magistrado</th>
        </tr></thead>
        <tbody>${criticos.map(i => row(i, '#e07020')).join('')}</tbody>
      </table>` : ''}
      
      ${atencao.length > 0 ? `
      <h2 style="color:#c8a830;font-size:16px;margin-top:20px;">🟡 Atenção — Próximos 7 dias (${atencao.length})</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
        <thead><tr style="background:#fef9c3;">
          <th style="padding:8px 12px;text-align:left;">ID</th>
          <th style="padding:8px 12px;text-align:left;">Arguido</th>
          <th style="padding:8px 12px;text-align:left;">Prazo</th>
          <th style="padding:8px 12px;text-align:left;">Data</th>
          <th style="padding:8px 12px;text-align:left;">Status</th>
          <th style="padding:8px 12px;text-align:left;">Magistrado</th>
        </tr></thead>
        <tbody>${atencao.map(i => row(i, '#c8a830')).join('')}</tbody>
      </table>` : ''}

      ${expirados.length === 0 && criticos.length === 0 && atencao.length === 0 ? `
      <div style="text-align:center;padding:30px;color:#888;">
        <p style="font-size:15px;">✅ Todos os prazos estão dentro do normal.</p>
      </div>` : ''}

      <div style="margin-top:20px;padding-top:15px;border-top:1px solid #eee;font-size:11px;color:#999;">
        <p>Este email foi gerado automaticamente pelo Sistema de Controlo de Arguidos em Prisão Preventiva da PGR Angola.</p>
        <p>Enviado via Gmail SMTP. Não responda a este email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
