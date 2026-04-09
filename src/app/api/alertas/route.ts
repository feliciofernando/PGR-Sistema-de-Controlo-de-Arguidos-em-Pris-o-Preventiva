import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep, toSnakeCaseDeep } from '@/lib/supabase';

// GET /api/alertas - List alerts with arguido info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const arguidoId = searchParams.get('arguidoId');
    const statusEnvio = searchParams.get('statusEnvio');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('alertas')
      .select('*, arguido:arguido_id(numero_id, numero_processo, nome_arguido)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (arguidoId) {
      query = query.eq('arguido_id', parseInt(arguidoId));
    }
    if (statusEnvio) {
      query = query.eq('status_envio', statusEnvio);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform nested arguido to flat structure the frontend expects
    const transformed = (data || []).map((a: Record<string, unknown>) => {
      const arguido = a.arguido as Record<string, unknown> | null;
      return {
        id: a.id,
        arguidoId: a.arguido_id,
        tipoAlerta: a.tipo_alerta,
        diasRestantes: a.dias_restantes,
        mensagem: a.mensagem,
        canalEnvio: a.canal_envio,
        statusEnvio: a.status_envio,
        dataDisparo: a.data_disparo,
        dataLeitura: a.data_leitura,
        createdAt: a.created_at,
        arguido: arguido ? {
          numeroId: arguido.numero_id,
          numeroProcesso: arguido.numero_processo,
          nomeArguido: arguido.nome_arguido,
        } : null,
      };
    });

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching alertas:', error);
    return NextResponse.json({ error: 'Failed to fetch alertas' }, { status: 500 });
  }
}

// POST /api/alertas - Create alert or check deadlines
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'check') {
      return await checkDeadlines();
    }

    // Create a single alert
    const record = {
      arguido_id: body.arguidoId,
      tipo_alerta: body.tipoAlerta || '',
      dias_restantes: body.diasRestantes || 0,
      mensagem: body.mensagem || '',
      canal_envio: body.canalEnvio || 'sistema',
      status_envio: body.statusEnvio || 'pendente',
    };

    const { data, error } = await supabase
      .from('alertas')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(toCamelCaseDeep(data), { status: 201 });
  } catch (error) {
    console.error('Error creating alerta:', error);
    return NextResponse.json({ error: 'Failed to create alerta' }, { status: 500 });
  }
}

async function checkDeadlines() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get all active arguidos with deadline info
  const { data: arguidos, error } = await supabase
    .from('arguidos')
    .select('id, numero_id, numero_processo, nome_arguido, status, fim_primeiro_prazo, fim_segundo_prazo')
    .eq('status', 'ativo');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newAlertas: Array<{
    arguido_id: number;
    tipo_alerta: string;
    dias_restantes: number;
    mensagem: string;
    canal_envio: string;
    status_envio: string;
  }> = [];

  const idsToMarkVencido: number[] = [];

  for (const arguido of (arguidos || [])) {
    const deadlines = [
      { date: arguido.fim_primeiro_prazo as string | null, type: 'primeiro_prazo' },
      { date: arguido.fim_segundo_prazo as string | null, type: 'segundo_prazo' },
    ].filter(d => d.date !== null);

    for (const deadline of deadlines) {
      const targetDate = new Date(deadline.date!);
      const cleanDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const daysRemaining = Math.ceil((cleanDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 7 && daysRemaining >= 0) {
        // Check if alert already exists for this arguido+type+days today
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existingAlert } = await supabase
          .from('alertas')
          .select('id')
          .eq('arguido_id', arguido.id)
          .eq('tipo_alerta', deadline.type)
          .eq('dias_restantes', daysRemaining)
          .gte('created_at', yesterday)
          .limit(1);

        if (!existingAlert || existingAlert.length === 0) {
          let mensagem = '';
          let canalEnvio = 'sistema';
          const prazoLabel = deadline.type === 'primeiro_prazo' ? '1º' : '2º';

          if (daysRemaining === 0) {
            mensagem = `⛔ VENCIDO: Prazo do ${prazoLabel} prazo expirado - Processo Nº ${arguido.numero_processo} - ${arguido.nome_arguido}`;
            idsToMarkVencido.push(arguido.id);
          } else if (daysRemaining === 1) {
            mensagem = `🚨 CRÍTICO: Processo Nº ${arguido.numero_processo} - ${arguido.nome_arguido} - VENCE AMANHÃ! ${prazoLabel} prazo.`;
          } else if (daysRemaining <= 3) {
            mensagem = `⚠️ URGENTE: Faltam ${daysRemaining} dias - Processo Nº ${arguido.numero_processo} - ${arguido.nome_arguido} - ${prazoLabel} prazo.`;
          } else {
            mensagem = `📋 Faltam ${daysRemaining} dias - Processo Nº ${arguido.numero_processo} - ${arguido.nome_arguido} - ${prazoLabel} prazo.`;
          }

          newAlertas.push({
            arguido_id: arguido.id,
            tipo_alerta: deadline.type,
            dias_restantes: daysRemaining,
            mensagem,
            canal_envio: canalEnvio,
            status_envio: 'enviado',
          });
        }
      }
    }
  }

  // Batch insert alerts
  if (newAlertas.length > 0) {
    const { error: insertError } = await supabase
      .from('alertas')
      .insert(newAlertas);

    if (insertError) {
      console.error('Error inserting alerts:', insertError);
    }

    // Send push notifications for new alerts
    try {
      const webpush = (await import('web-push')).default;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(
          'mailto:pgr-angola@system.local',
          vapidPublicKey,
          vapidPrivateKey
        );

        // Get all push subscriptions
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh_key, auth_key');

        if (subscriptions && subscriptions.length > 0) {
          const criticalAlerts = newAlertas.filter(a => a.dias_restantes <= 1);
          let pushTitle: string;
          let pushBody: string;
          let requireInteraction = false;

          if (criticalAlerts.length > 0) {
            pushTitle = criticalAlerts.some(a => a.dias_restantes === 0)
              ? 'PRAZO VENCIDO - PGR Angola'
              : 'PRAZO CRITICO - PGR Angola';
            pushBody = criticalAlerts.length === 1
              ? criticalAlerts[0].mensagem.replace(/[⚠️🚨⛔📋 ]/g, '').trim()
              : `${criticalAlerts.length} prazos criticos/vencidos detetados.`;
            requireInteraction = criticalAlerts.some(a => a.dias_restantes === 0);
          } else {
            pushTitle = 'Novos Alertas - PGR Angola';
            pushBody = `${newAlertas.length} novo(s) alerta(s) de prazo(s) criado(s).`;
          }

          const payload = JSON.stringify({
            title: pushTitle,
            body: pushBody,
            url: '/?view=alertas',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/maskable-icon-192x192.png',
            tag: `pgr-alerts-${Date.now()}`,
            requireInteraction,
          });

          // Send to all subscriptions
          const results = await Promise.allSettled(
            subscriptions.map((sub: Record<string, string>) =>
              webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
                },
                payload,
                { TTL: 86400, urgency: 'high' }
              )
            )
          );

          const sent = results.filter(r => r.status === 'fulfilled').length;
          console.log(`[Alertas] Push sent: ${sent}/${subscriptions.length}`);

          // Clean dead subscriptions
          const deadEndpoints = results
            .map((r, i) => r.status === 'rejected' && subscriptions[i]?.endpoint ? subscriptions[i].endpoint : null)
            .filter(Boolean);
          if (deadEndpoints.length > 0) {
            await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
          }
        }
      } else {
        console.log('[Alertas] VAPID keys not configured, push skipped');
      }
    } catch (pushErr) {
      console.log('[Alertas] Push notification error:', pushErr);
    }
  }

  // Mark expired arguidos as vencido
  if (idsToMarkVencido.length > 0) {
    const uniqueIds = [...new Set(idsToMarkVencido)];
    await supabase
      .from('arguidos')
      .update({ status: 'vencido' })
      .in('id', uniqueIds);
  }

  return NextResponse.json({
    checkedAt: now.toISOString(),
    arguidosChecked: (arguidos || []).length,
    newAlertsCreated: newAlertas.length,
    alerts: newAlertas,
  });
}
