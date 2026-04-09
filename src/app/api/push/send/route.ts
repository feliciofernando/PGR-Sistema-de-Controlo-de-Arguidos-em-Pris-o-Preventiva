import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/push/send - Send push notification to all or specific subscribers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, message, url, tag, icon, requireInteraction, endpoint: targetEndpoint, summary } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Título e mensagem são obrigatórios' }, { status: 400 });
    }

    // Get subscriptions
    let query = supabase.from('push_subscriptions').select('*');
    if (targetEndpoint) {
      query = query.eq('endpoint', targetEndpoint);
    }
    const { data: subscriptions, error: dbError } = await query;

    if (dbError) {
      console.error('Supabase error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'Nenhum subscritor encontrado' });
    }

    const webpush = (await import('web-push')).default;

    webpush.setVapidDetails(
      'mailto:pgr-angola@system.local',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    // Build notification payload — support summary format
    const isSummary = !!summary;
    let pushTitle = title;
    let pushBody = message;

    if (isSummary) {
      const s = summary;
      pushTitle = '⚖️ PGR ANGOLA';

      // Clean format with line breaks for native notification display
      const lines: string[] = [];
      if (s.expirados > 0) lines.push(`⛔  ${s.expirados} Prazo(s) Expirado(s)`);
      if (s.criticos > 0) lines.push(`🚨  ${s.criticos} Caso(s) Crítico(s)`);
      if (s.atencao > 0) lines.push(`⚠️  ${s.atencao} Caso(s) em Atenção`);
      if (s.normal > 0) lines.push(`✅  ${s.normal} Caso(s) Normal`);
      lines.push(`📊  Total: ${s.total} caso(s)`);
      pushBody = lines.join('\n');
    }

    const notificationPayload = {
      title: pushTitle,
      body: pushBody,
      url: url || '/?view=alertas',
      icon: icon || '/icons/icon-192x192.png',
      badge: '/icons/maskable-icon-192x192.png',
      tag: tag || 'pgr-alert-' + Date.now(),
      requireInteraction: requireInteraction || false,
      summary: isSummary ? summary : null,
    };

    let sent = 0;
    let failed = 0;
    const deadEndpoints: string[] = [];

    // Send to all subscriptions (batch of 10)
    const batchSize = 10;
    for (let i = 0; i < subscriptions.length; i += batchSize) {
      const batch = subscriptions.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh_key,
              auth: sub.auth_key,
            },
          };
          return webpush.sendNotification(pushSubscription, JSON.stringify(notificationPayload), {
            TTL: 86400,
            urgency: 'high',
          });
        })
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          const endpoint = batch[j].endpoint;
          if (result.reason?.statusCode === 404 || result.reason?.statusCode === 410) {
            deadEndpoints.push(endpoint);
          }
        }
      }
    }

    // Clean up dead subscriptions
    if (deadEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', deadEndpoints);
      console.log(`[Push] Cleaned ${deadEndpoints.length} dead subscriptions`);
    }

    return NextResponse.json({
      sent,
      failed,
      total: subscriptions.length,
      cleaned: deadEndpoints.length,
    });
  } catch (error) {
    console.error('Error sending push:', error);
    return NextResponse.json({ error: 'Falha ao enviar notificações' }, { status: 500 });
  }
}
