import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

/**
 * GET /api/arguidos/search-public
 * Public endpoint for searching defendant processes from the landing page.
 * Returns only a limited set of fields for privacy (no observations, no internal notes).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ found: false, message: 'Informe um termo de pesquisa.' });
    }

    const cleanQuery = query.trim();

    // Search across multiple fields (process number, name, ID)
    const { data: rawData, error } = await supabase
      .from('arguidos')
      .select(
        'id, numero_id, numero_processo, nome_arguido, data_detencao, crime, medidas_aplicadas, data_medidas_aplicadas, fim_primeiro_prazo, fim_segundo_prazo, status, magistrado'
      )
      .or(
        `nome_arguido.ilike.%${cleanQuery}%,numero_processo.ilike.%${cleanQuery}%,numero_id.ilike.%${cleanQuery}%`
      )
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Public search error:', error);
      return NextResponse.json({ found: false, message: 'Erro na pesquisa.' }, { status: 500 });
    }

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ found: false, message: 'Nenhum processo encontrado.' });
    }

    // Map to camelCase and only return summary-safe fields
    const results = (toCamelCaseDeep(rawData) as Array<Record<string, unknown>>).map((a) => ({
      id: a.id,
      numeroId: a.numeroId,
      numeroProcesso: a.numeroProcesso,
      nomeArguido: a.nomeArguido,
      dataDetencao: a.dataDetencao,
      crime: a.crime,
      medidasAplicadas: a.medidasAplicadas,
      dataMedidasAplicadas: a.dataMedidasAplicadas,
      fimPrimeiroPrazo: a.fimPrimeiroPrazo,
      fimSegundoPrazo: a.fimSegundoPrazo,
      status: a.status,
      magistrado: a.magistrado,
    }));

    return NextResponse.json({
      found: true,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error('Public search error:', error);
    return NextResponse.json({ found: false, message: 'Erro na pesquisa.' }, { status: 500 });
  }
}
