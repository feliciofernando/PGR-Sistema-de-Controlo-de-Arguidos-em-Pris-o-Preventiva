import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/push/subscribe - Store a new push subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, keys, user_agent } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Dados de subscrição inválidos' },
        { status: 400 }
      );
    }

    // Upsert: insert or update if endpoint already exists
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        endpoint,
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        user_agent: user_agent || request.headers.get('user-agent') || null,
      }, { onConflict: 'endpoint' });

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, endpoint });
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return NextResponse.json({ error: 'Falha ao registar subscrição' }, { status: 500 });
  }
}

// DELETE /api/push/subscribe - Remove a push subscription
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint é obrigatório' }, { status: 400 });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return NextResponse.json({ error: 'Falha ao remover subscrição' }, { status: 500 });
  }
}
