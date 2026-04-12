import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';
import * as XLSX from 'xlsx';

// GET /api/arguidos/export-xlsx - Export arguidos as XLSX
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
      query = query.or(`nome_arguido.ilike.%${search}%,numero_processo.ilike.%${search}%,numero_id.ilike.%${search}%`);
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

    // Define column headers in Portuguese (same as CSV export)
    const headers = [
      'ID', 'Nº Processo', 'Nome do Arguido', 'Nome do Pai', 'Nome da Mãe',
      'Data de Detenção', 'Crime', 'Data Remessa JG', 'Data Regresso',
      'Medidas Aplicadas', 'Data das Medidas', 'Data Remessa SIC',
      'Fim 1º Prazo', 'Data Prorrogação', 'Duração Prorrogação',
      'Fim 2º Prazo', 'Magistrado', 'Remessa JG/Alteração',
      'Observação 1', 'Observação 2', 'Status', 'Data de Criação',
    ];

    // Build data rows
    const rows = arguidos.map((a) => [
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
    ]);

    // Create worksheet and workbook
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-size columns based on content
    const colWidths = headers.map((header, colIdx) => {
      const maxLen = Math.max(
        header.length,
        ...rows.map((row) => String(row[colIdx] || '').length)
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Arguidos');

    // Generate XLSX buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `arguidos_pgr_${timestamp}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('XLSX export error:', error);
    return NextResponse.json({ error: 'Failed to export XLSX' }, { status: 500 });
  }
}
