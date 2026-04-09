import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/push/notify-alertas
// Returns categorized case summary + sends push notifications
export async function GET() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Get ALL arguidos with deadline info
    const { data: allArguidos, error } = await supabase
      .from('arguidos')
      .select('id, numero_id, numero_processo, nome_arguido, status, fim_primeiro_prazo, fim_segundo_prazo');

    if (error) {
      console.error('[Auto-Notify] Error fetching arguidos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Categorize each arguido by their nearest deadline
    let expirados = 0;   // dias_restantes < 0 (already expired)
    let criticos = 0;    // dias_restantes = 0 or 1 (critical)
    let atencao = 0;     // dias_restantes 2-7 (attention)
    let normal = 0;      // dias_restantes > 7 or no deadline (normal)
    let semPrazo = 0;    // no deadline defined

    const expiradosList: string[] = [];
    const criticosList: string[] = [];

    for (const a of (allArguidos || [])) {
      // Skip encerrados
      if (a.status === 'encerrado') {
        normal++;
        continue;
      }

      const deadlines = [
        a.fim_primeiro_prazo as string | null,
        a.fim_segundo_prazo as string | null,
      ].filter((d): d is string => d !== null);

      if (deadlines.length === 0) {
        semPrazo++;
        normal++;
        continue;
      }

      // Find the nearest (minimum) deadline
      const nearestMs = Math.min(...deadlines.map(d => new Date(d).getTime()));
      const nearestDay = new Date(new Date(nearestMs).getFullYear(), new Date(nearestMs).getMonth(), new Date(nearestMs).getDate());
      const daysRemaining = Math.ceil((nearestDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        expirados++;
        if (expiradosList.length < 3) expiradosList.push(a.nome_arguido);
      } else if (daysRemaining <= 1) {
        criticos++;
        if (criticosList.length < 3) criticosList.push(a.nome_arguido);
      } else if (daysRemaining <= 7) {
        atencao++;
      } else {
        normal++;
      }
    }

    const total = (allArguidos || []).length;
    const hasUrgent = expirados > 0 || criticos > 0;
    const hasAnyAlert = expirados > 0 || criticos > 0 || atencao > 0;

    // 3. Build push payload with categorized summary format
    const pushTitle = '⚖️ PGR ANGOLA';
    const requireInteraction = hasUrgent;

    // Build notification body — clean format with line breaks
    // Windows Action Center and Android support \n in body
    const lines: string[] = [];
    if (expirados > 0) lines.push(`⛔  ${expirados} Prazo(s) Expirado(s)`);
    if (criticos > 0) lines.push(`🚨  ${criticos} Caso(s) Crítico(s)`);
    if (atencao > 0) lines.push(`⚠️  ${atencao} Caso(s) em Atenção`);
    if (normal > 0) lines.push(`✅  ${normal} Caso(s) Normal`);
    lines.push(`📊  Total: ${total} caso(s)`);
    const pushBody = lines.join('\n');

    // Compact version without emojis for platforms that strip them
    const partsCompact: string[] = [];
    if (expirados > 0) partsCompact.push(`${expirados} Expirado(s)`);
    if (criticos > 0) partsCompact.push(`${criticos} Crítico(s)`);
    if (atencao > 0) partsCompact.push(`${atencao} Atenção`);
    if (normal > 0) partsCompact.push(`${normal} Normal`);
    const pushBodyCompact = partsCompact.join(' • ') + ` — Total: ${total} caso(s)`;

    // 4. Send push notifications
    let sent = 0;
    let totalSubs = 0;

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (subscriptions && subscriptions.length > 0) {
      totalSubs = subscriptions.length;
      const webpush = (await import('web-push')).default;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(
          'mailto:pgr-angola@system.local',
          vapidPublicKey,
          vapidPrivateKey
        );

        const payload = JSON.stringify({
          title: pushTitle,
          body: pushBody,
          bodyCompact: pushBodyCompact,
          url: '/?view=alertas',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/maskable-icon-192x192.png',
          tag: `pgr-auto-${Date.now()}`,
          requireInteraction,
          // Structured data for service worker to render rich notification
          summary: {
            expirados,
            criticos,
            atencao,
            normal,
            total,
            hasUrgent,
          },
        });

        const deadEndpoints: string[] = [];
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

        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'fulfilled') {
            sent++;
          } else {
            const reason = (results[i] as PromiseRejectedResult).reason;
            const statusCode = reason?.statusCode;
            const endpointShort = subscriptions[i]?.endpoint?.substring(0, 80) || 'unknown';
            const isApple = endpointShort.includes('apple') || endpointShort.includes('push.apple');
            console.log(`[Auto-Notify] Push FAILED (${isApple ? 'iOS' : 'Other'}): status=${statusCode}`);
            if (statusCode === 404 || statusCode === 410) {
              deadEndpoints.push(subscriptions[i].endpoint);
            }
          }
        }

        if (deadEndpoints.length > 0) {
          await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
        }
      }
    }

    console.log(`[Auto-Notify] Summary: ${expirados} expirados, ${criticos} criticos, ${atencao} atencao, ${normal} normal | Push: ${sent}/${totalSubs}`);

    // 5. Return the full categorized summary for in-app notification
    return NextResponse.json({
      sent,
      total: totalSubs,
      hasUrgent,
      hasAnyAlert,
      expirados,
      criticos,
      atencao,
      normal,
      total,
      pushTitle,
      pushBody,
      expiradosList,
      criticosList,
    });
  } catch (error) {
    console.error('[Auto-Notify] Error:', error);
    return NextResponse.json({ error: 'Failed to send auto notifications' }, { status: 500 });
  }
}
