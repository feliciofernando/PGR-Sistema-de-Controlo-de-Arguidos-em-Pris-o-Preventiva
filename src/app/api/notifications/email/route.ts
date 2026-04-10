import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/notifications/email — Send email notifications for deadline warnings
// This endpoint checks for upcoming deadlines and sends email alerts
// Requires NEXT_PUBLIC_EMAIL_ENABLED=true and SMTP configuration (Resend, SendGrid, etc.)
export async function GET() {
  try {
    const emailEnabled = process.env.NEXT_PUBLIC_EMAIL_ENABLED === 'true';

    if (!emailEnabled) {
      return NextResponse.json({
        success: false,
        message: 'Email notifications disabled. Set NEXT_PUBLIC_EMAIL_ENABLED=true and configure SMTP.',
        hint: 'Configure RESEND_API_KEY or SMTP_* environment variables.',
      });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Fetch arguidos with deadlines expiring within 7 days (still ativo or vencido)
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
        message: 'No urgent deadlines found.',
      });
    }

    // Categorize by urgency
    interface UrgentItem {
      id: number;
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
            id: a.id,
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

    // Sort by urgency (expirado first, then critico, then atencao)
    items.sort((a, b) => {
      const order = { expirado: 0, critico: 1, atencao: 2 };
      return order[a.urgency] - order[b.urgency];
    });

    // Build email content
    const expirados = items.filter(i => i.urgency === 'expirado');
    const criticos = items.filter(i => i.urgency === 'critico');
    const atencao = items.filter(i => i.urgency === 'atencao');

    const subject = `🔔 PGR Angola — Alerta de Prazos (${expirados.length} expirados, ${criticos.length} críticos)`;
    const htmlBody = buildEmailHTML(expirados, criticos, atencao);

    // Try to send via Resend (if API key configured)
    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL || '';
    const emailFrom = process.env.EMAIL_FROM || 'PGR Sistema <noreply@pgr-lunda-sul.com>';

    if (resendApiKey && adminEmail) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [adminEmail],
            subject,
            html: htmlBody,
          }),
        });

        if (resendRes.ok) {
          const resendData = await resendRes.json();
          return NextResponse.json({
            success: true,
            provider: 'resend',
            sent: items.length,
            emailId: resendData.id,
            summary: {
              expirados: expirados.length,
              criticos: criticos.length,
              atencao: atencao.length,
            },
          });
        } else {
          const errData = await resendRes.json();
          return NextResponse.json({
            success: false,
            provider: 'resend',
            error: errData,
            message: `Resend API error: ${errData?.name || errData?.message || 'Unknown'}`,
            hint: errData?.message?.includes('domain') ? 'Verify your domain in Resend or use onboarding@resend.dev' : 'Check API key and domain settings.',
          });
        }
      } catch (emailErr) {
        console.error('Resend API error:', emailErr);
      }
    }

    // Return summary even if email not configured (for preview/testing)
    return NextResponse.json({
      success: true,
      provider: 'none',
      sent: 0,
      message: 'Email service not configured. Preview generated.',
      preview: { expirados: expirados.length, criticos: criticos.length, atencao: atencao.length },
      htmlPreview: htmlBody.substring(0, 500) + '...',
      configHint: 'Set RESEND_API_KEY and ADMIN_EMAIL in .env.local to enable email notifications.',
    });
  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json({ error: 'Failed to process email notifications' }, { status: 500 });
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
        <p>Não responda a este email. Para questões, contacte o administrador do sistema.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// POST /api/notifications/email — Send a test email
export async function POST() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL || '';
    const emailFrom = process.env.EMAIL_FROM || 'PGR Sistema <noreply@pgr-lunda-sul.com>';

    if (!resendApiKey || !adminEmail) {
      return NextResponse.json({
        success: false,
        message: 'Email service not configured.',
        configHint: 'Add RESEND_API_KEY and ADMIN_EMAIL to .env.local or Vercel env vars to enable email.',
        testResult: `Would send test email to ${adminEmail || '(not set)'}`,
      });
    }

    const testHtml = `
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#c2410c;padding:20px 30px;">
      <h1 style="color:white;margin:0;">⚖️ PGR Angola — Email de Teste</h1>
    </div>
    <div style="padding:20px 30px;">
      <p>Este é um email de teste do <strong>Sistema de Controlo de Arguidos em Prisão Preventiva</strong>.</p>
      <p>Se recebeu este email, as notificações por email estão a funcionar corretamente.</p>
      <p style="color:#888;font-size:12px;">Enviado em: ${new Date().toLocaleString('pt-AO')}</p>
    </div>
  </div>
</body></html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [adminEmail],
        subject: '📧 PGR Angola — Email de Teste',
        html: testHtml,
      }),
    });

    if (resendRes.ok) {
      const data = await resendRes.json();
      return NextResponse.json({ success: true, emailId: data.id, sentTo: adminEmail });
    }

    const errorData = await resendRes.json();
    return NextResponse.json({ 
      success: false, 
      error: errorData,
      hint: errorData?.message?.includes('domain') 
        ? 'Verify your domain in Resend Dashboard → Domains. Or use onboarding@resend.dev for testing.' 
        : 'Check your API key and configuration.',
    }, { status: 500 });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}
