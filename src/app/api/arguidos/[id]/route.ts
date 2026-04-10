import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep, addMonthsToISO } from '@/lib/supabase';

// GET /api/arguidos/[id] - Get single arguido with alerts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: arguido, error } = await supabase
      .from('arguidos')
      .select('*, alertas(*)')
      .eq('id', id)
      .order('created_at', { referencedTable: 'alertas', ascending: false })
      .single();

    if (error || !arguido) {
      return NextResponse.json({ error: 'Arguido not found' }, { status: 404 });
    }

    return NextResponse.json(toCamelCaseDeep(arguido));
  } catch (error) {
    console.error('Error fetching arguido:', error);
    return NextResponse.json({ error: 'Failed to fetch arguido' }, { status: 500 });
  }
}

// PUT /api/arguidos/[id] - Update arguido
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get existing record to handle partial updates
    const { data: existing } = await supabase
      .from('arguidos')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Arguido not found' }, { status: 404 });
    }

    // Calculate deadlines
    const dataMedidas = body.dataMedidasAplicadas !== undefined
      ? body.dataMedidasAplicadas
      : existing.data_medidas_aplicadas;
    const dataProrroga = body.dataProrrogacao !== undefined
      ? body.dataProrrogacao
      : existing.data_prorrogacao;
    const duracao = body.duracaoProrrogacao !== undefined
      ? body.duracaoProrrogacao
      : existing.duracao_prorrogacao;

    const fimPrimeiroPrazo = addMonthsToISO(dataMedidas, 3);
    const fimSegundoPrazo = (dataProrroga && duracao > 0)
      ? addMonthsToISO(dataProrroga, duracao)
      : null;

    const updateData: Record<string, unknown> = {
      numero_processo: body.numeroProcesso ?? existing.numero_processo,
      nome_arguido: body.nomeArguido ?? existing.nome_arguido,
      nome_pai: body.nomePai ?? existing.nome_pai,
      nome_mae: body.nomeMae ?? existing.nome_mae,
      data_detencao: body.dataDetencao ?? existing.data_detencao,
      crime: body.crime ?? existing.crime,
      data_remessa_jg: body.dataRemessaJg ?? existing.data_remessa_jg,
      data_regresso: body.dataRegresso ?? existing.data_regresso,
      medidas_aplicadas: body.medidasAplicadas ?? existing.medidas_aplicadas,
      data_medidas_aplicadas: body.dataMedidasAplicadas ?? existing.data_medidas_aplicadas,
      data_remessa_sic: body.dataRemessaSic ?? existing.data_remessa_sic,
      fim_primeiro_prazo: fimPrimeiroPrazo,
      data_prorrogacao: body.dataProrrogacao ?? existing.data_prorrogacao,
      duracao_prorrogacao: duracao,
      fim_segundo_prazo: fimSegundoPrazo,
      magistrado: body.magistrado ?? existing.magistrado,
      remessa_jg_alteracao: body.remessaJgAlteracao ?? existing.remessa_jg_alteracao,
      obs1: body.obs1 ?? existing.obs1,
      obs2: body.obs2 ?? existing.obs2,
      status: body.status ?? existing.status,
    };

    const { data, error } = await supabase
      .from('arguidos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(toCamelCaseDeep(data));
  } catch (error) {
    console.error('Error updating arguido:', error);
    return NextResponse.json({ error: 'Failed to update arguido' }, { status: 500 });
  }
}

// DELETE /api/arguidos/[id] - Delete arguido
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('arguidos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting arguido:', error);
    return NextResponse.json({ error: 'Failed to delete arguido' }, { status: 500 });
  }
}
