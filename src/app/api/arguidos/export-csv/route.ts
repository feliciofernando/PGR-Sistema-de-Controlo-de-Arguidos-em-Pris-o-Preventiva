import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// Escape special wildcard characters in ILIKE patterns to prevent injection
function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// GET /api/arguidos/export-csv - Export arguidos as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const crime = searchParams.get('crime') || '';
    const magistrado = searchParams.get('magistrado') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    let query = supabase
      .from('arguidos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (search) {
      query = query.or(`nome_arguido.ilike.%${escapeIlike(search)}%,numero_processo.ilike.%${escapeIlike(search)}%,numero_id.ilike.%${escapeIlike(search)}%`);
    }
    if (status) query = query.eq('status', status);
    if (crime) query = query.eq('crime', crime);
    if (magistrado) query = query.eq('magistrado', magistrado);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate + 'T23:59:59');

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const arguidos = toCamelCaseDeep(data || []) as Array<Record<string, unknown>>;

    const headers = [
      'ID', 'Nº Processo', 'Nome do Arguido', 'Nome do Pai', 'Nome da Mãe',
      'Data de Detenção', 'Crime', 'Data Remessa JG', 'Data Regresso',
      'Medidas Aplicadas', 'Data das Medidas', 'Data Remessa SIC',
      'Fim 1º Prazo', 'Data Prorrogação', 'Duração Prorrogação',
      'Fim 2º Prazo', 'Magistrado', 'Remessa JG/Alteração',
      'Observação 1', 'Observação 2', 'Status', 'Data de Criação',
    ];

    const csvRows = [headers.join(';')];

    for (const a of arguidos) {
      const row = [
        a.numeroId || '',
        a.numeroProcesso || '',
        a.nomeArguido || '',
        a.nomePai || '',
        a.nomeMae || '',
        a.dataDetencao ? new Date(a.dataDetencao as string).toLocaleDateString('pt-AO') : '',
        a.crime || '',
        a.dataRemessaJg ? new Date(a.dataRemessaJg as string).toLocaleDateString('pt-AO') : '',
        a.dataRegresso ? new Date(a.dataRegresso as string).toLocaleDateString('pt-AO') : '',
        a.medidasAplicadas || '',
        a.dataMedidasAplicadas ? new Date(a.dataMedidasAplicadas as string).toLocaleDateString('pt-AO') : '',
        a.dataRemessaSic ? new Date(a.dataRemessaSic as string).toLocaleDateString('pt-AO') : '',
        a.fimPrimeiroPrazo ? new Date(a.fimPrimeiroPrazo as string).toLocaleDateString('pt-AO') : '',
        a.dataProrrogacao ? new Date(a.dataProrrogacao as string).toLocaleDateString('pt-AO') : '',
        a.duracaoProrrogacao || '0',
        a.fimSegundoPrazo ? new Date(a.fimSegundoPrazo as string).toLocaleDateString('pt-AO') : '',
        a.magistrado || '',
        a.remessaJgAlteracao || '',
        a.obs1 || '',
        a.obs2 || '',
        a.status || '',
        a.createdAt ? new Date(a.createdAt as string).toLocaleDateString('pt-AO') : '',
      ];
      const escapedRow = row.map(field => {
        const str = String(field);
        if (str.includes(';') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(escapedRow.join(';'));
    }

    const csvContent = '\uFEFF' + csvRows.join('\n');

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `arguidos_pgr_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json({ error: 'Failed to export CSV' }, { status: 500 });
  }
}
