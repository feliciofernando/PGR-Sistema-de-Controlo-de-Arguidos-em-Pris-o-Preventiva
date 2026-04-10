import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/arguidos/auto-status - Check and update statuses based on deadlines
export async function GET() {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // 1. Find all arguidos with status "ativo" where first prazo has passed
    const { data: expiredFirstPrazo, error: err1 } = await supabase
      .from('arguidos')
      .select('id, fim_primeiro_prazo, fim_segundo_prazo')
      .eq('status', 'ativo')
      .lt('fim_primeiro_prazo', today);

    if (err1) {
      console.error('Auto-status error (first prazo):', err1);
      return NextResponse.json({ error: err1.message }, { status: 500 });
    }

    // 2. Find arguidos where both prazos have passed → "encerrado"
    const { data: expiredBothPrazos, error: err2 } = await supabase
      .from('arguidos')
      .select('id')
      .eq('status', 'vencido')
      .lt('fim_primeiro_prazo', today)
      .not('fim_segundo_prazo', 'is', null)
      .lt('fim_segundo_prazo', today);

    if (err2) {
      console.error('Auto-status error (both prazos):', err2);
      return NextResponse.json({ error: err2.message }, { status: 500 });
    }

    // Also find "ativo" records where both prazos have passed → encerrado directly
    const { data: activeBothExpired, error: err3 } = await supabase
      .from('arguidos')
      .select('id')
      .eq('status', 'ativo')
      .lt('fim_primeiro_prazo', today)
      .not('fim_segundo_prazo', 'is', null)
      .lt('fim_segundo_prazo', today);

    if (err3) {
      console.error('Auto-status error (active both):', err3);
    }

    let updatedToVencido = 0;
    let updatedToEncerrado = 0;

    // Update ativo → vencido (only those NOT going to encerrado)
    if (expiredFirstPrazo && expiredFirstPrazo.length > 0) {
      const encerradoIds = new Set([
        ...(expiredBothPrazos?.map(r => r.id) || []),
        ...(activeBothExpired?.map(r => r.id) || []),
      ]);

      const vencidoIds = expiredFirstPrazo
        .filter(r => !encerradoIds.has(r.id))
        .map(r => r.id);

      if (vencidoIds.length > 0) {
        const { error: updateErr1 } = await supabase
          .from('arguidos')
          .update({ status: 'vencido' })
          .in('id', vencidoIds);

        if (!updateErr1) {
          updatedToVencido = vencidoIds.length;
        }
      }
    }

    // Update vencido → encerrado (both prazos passed)
    if (expiredBothPrazos && expiredBothPrazos.length > 0) {
      const { error: updateErr2 } = await supabase
        .from('arguidos')
        .update({ status: 'encerrado' })
        .in('id', expiredBothPrazos.map(r => r.id));

      if (!updateErr2) {
        updatedToEncerrado += expiredBothPrazos.length;
      }
    }

    // Update ativo → encerrado directly (both prazos passed, was still ativo)
    if (activeBothExpired && activeBothExpired.length > 0) {
      const { error: updateErr3 } = await supabase
        .from('arguidos')
        .update({ status: 'encerrado' })
        .in('id', activeBothExpired.map(r => r.id));

      if (!updateErr3) {
        updatedToEncerrado += activeBothExpired.length;
      }
    }

    const totalUpdated = updatedToVencido + updatedToEncerrado;

    return NextResponse.json({
      success: true,
      updatedToVencido,
      updatedToEncerrado,
      totalUpdated,
      message: totalUpdated > 0
        ? `${totalUpdated} registo(s) atualizado(s): ${updatedToVencido} → vencido, ${updatedToEncerrado} → encerrado`
        : 'Nenhum registo necessita de atualização de status.',
    });
  } catch (error) {
    console.error('Auto-status check error:', error);
    return NextResponse.json({ error: 'Failed to check auto-status' }, { status: 500 });
  }
}
