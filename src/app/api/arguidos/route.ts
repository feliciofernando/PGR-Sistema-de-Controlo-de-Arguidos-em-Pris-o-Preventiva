import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep, toSnakeCaseDeep, addMonthsToISO } from '@/lib/supabase';

// Helper: create audit log entry
async function createAuditLog(params: {
  arguidoId: number;
  action: string;
  fieldChanged?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  username?: string;
}) {
  try {
    await supabase.from('audit_logs').insert({
      arguido_id: params.arguidoId,
      username: params.username || 'sistema',
      action: params.action,
      field_changed: params.fieldChanged || null,
      old_value: params.oldValue || null,
      new_value: params.newValue || null,
    });
  } catch (e) {
    console.error('[Audit] Failed to write audit log:', e);
  }
}

// CamelCase to readable label mapping
function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    numeroProcesso: 'Nº Processo',
    nomeArguido: 'Nome do Arguido',
    nomePai: 'Nome do Pai',
    nomeMae: 'Nome da Mãe',
    dataDetencao: 'Data de Detenção',
    crime: 'Crime',
    dataRemessaJg: 'Remessa ao JG',
    dataRegresso: 'Data de Regresso',
    medidasAplicadas: 'Medidas Aplicadas',
    dataMedidasAplicadas: 'Data das Medidas',
    dataRemessaSic: 'Remessa ao SIC',
    fimPrimeiroPrazo: 'Fim 1º Prazo',
    dataProrrogacao: 'Data de Prorrogação',
    duracaoProrrogacao: 'Duração da Prorrogação',
    fimSegundoPrazo: 'Fim 2º Prazo',
    magistrado: 'Magistrado',
    remessaJgAlteracao: 'Remessa JG / Alteração',
    obs1: 'Observação 1',
    obs2: 'Observação 2',
    status: 'Status',
  };
  return labels[field] || field;
}

// GET /api/arguidos - List with search, filter, pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const prazoFilter = searchParams.get('prazoFilter') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    let query = supabase
      .from('arguidos')
      .select('*', { count: 'exact' });

    // Search across multiple fields
    if (search) {
      query = query.or(`nome_arguido.ilike.%${search}%,numero_processo.ilike.%${search}%,numero_id.ilike.%${search}%,nome_pai.ilike.%${search}%,nome_mae.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // Advanced date range filters
    const detencaoDe = searchParams.get('detencaoDe') || '';
    const detencaoAte = searchParams.get('detencaoAte') || '';
    const prazoDe = searchParams.get('prazoDe') || '';
    const prazoAte = searchParams.get('prazoAte') || '';

    if (detencaoDe) query = query.gte('data_detencao', detencaoDe);
    if (detencaoAte) query = query.lte('data_detencao', detencaoAte);
    if (prazoDe) query = query.gte('fim_primeiro_prazo', prazoDe);
    if (prazoAte) query = query.lte('fim_primeiro_prazo', prazoAte);

    // Sort
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: rawData, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let arguidos = toCamelCaseDeep(rawData || []) as Array<Record<string, unknown>>;
    const total = count || 0;

    // Apply prazo filter in-memory
    if (prazoFilter) {
      const now = new Date();
      arguidos = arguidos.filter((a) => {
        const fimPrazo1 = a.fimPrimeiroPrazo as string | null;
        const fimPrazo2 = a.fimSegundoPrazo as string | null;
        if (!fimPrazo1 && !fimPrazo2) return false;

        const deadlines = [fimPrazo1, fimPrazo2].filter(Boolean).map(d => new Date(d!));
        const nearest = deadlines.sort((a, b) => a.getTime() - b.getTime())[0];

        const daysRemaining = Math.ceil(
          (nearest.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        switch (prazoFilter) {
          case 'vencido': return daysRemaining < 0;
          case 'critico': return daysRemaining >= 0 && daysRemaining <= 3;
          case 'atencao': return daysRemaining > 3 && daysRemaining <= 7;
          case 'normal': return daysRemaining > 7;
          default: return true;
        }
      });
    }

    return NextResponse.json({
      data: arguidos,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching arguidos:', error);
    return NextResponse.json({ error: 'Failed to fetch arguidos' }, { status: 500 });
  }
}

// POST /api/arguidos - Create new arguido
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Generate auto ID: PGR-XXXX
    const { count: total } = await supabase
      .from('arguidos')
      .select('*', { count: 'exact', head: true });
    const numeroId = `PGR-${String((total || 0) + 1).padStart(4, '0')}`;

    // Calculate deadlines
    const fimPrimeiroPrazo = addMonthsToISO(body.dataMedidasAplicadas, 3);
    const fimSegundoPrazo = (body.dataProrrogacao && body.duracaoProrrogacao > 0)
      ? addMonthsToISO(body.dataProrrogacao, body.duracaoProrrogacao)
      : null;

    const record = {
      numero_id: numeroId,
      numero_processo: body.numeroProcesso || '',
      nome_arguido: body.nomeArguido || '',
      nome_pai: body.nomePai || '',
      nome_mae: body.nomeMae || '',
      data_detencao: body.dataDetencao || null,
      crime: body.crime || '',
      data_remessa_jg: body.dataRemessaJg || null,
      data_regresso: body.dataRegresso || null,
      medidas_aplicadas: body.medidasAplicadas || '',
      data_medidas_aplicadas: body.dataMedidasAplicadas || null,
      data_remessa_sic: body.dataRemessaSic || null,
      fim_primeiro_prazo: fimPrimeiroPrazo,
      data_prorrogacao: body.dataProrrogacao || null,
      duracao_prorrogacao: body.duracaoProrrogacao || 0,
      fim_segundo_prazo: fimSegundoPrazo,
      magistrado: body.magistrado || '',
      remessa_jg_alteracao: body.remessaJgAlteracao || '',
      obs1: body.obs1 || '',
      obs2: body.obs2 || '',
      status: body.status || 'ativo',
    };

    const { data, error } = await supabase
      .from('arguidos')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log: creation
    await createAuditLog({
      arguidoId: data.id,
      action: 'criacao',
      newValue: `Arguido "${body.nomeArguido}" criado (${numeroId})`,
      username: body.username || 'sistema',
    });

    return NextResponse.json(toCamelCaseDeep(data), { status: 201 });
  } catch (error) {
    console.error('Error creating arguido:', error);
    return NextResponse.json({ error: 'Failed to create arguido' }, { status: 500 });
  }
}
