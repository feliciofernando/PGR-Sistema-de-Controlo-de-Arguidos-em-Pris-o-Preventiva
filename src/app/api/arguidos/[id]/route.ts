import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep, addMonthsToISO } from '@/lib/supabase';

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

// CamelCase field to snake_case for DB comparison
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// CamelCase to readable label
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

// Format a value for audit display
function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  const str = String(val);
  // Truncate long strings
  return str.length > 100 ? str.substring(0, 100) + '...' : str;
}

// Fields to track for audit (skip internal computed fields)
const TRACKED_FIELDS = [
  'numeroProcesso', 'nomeArguido', 'nomePai', 'nomeMae',
  'dataDetencao', 'crime', 'dataRemessaJg', 'dataRegresso',
  'medidasAplicadas', 'dataMedidasAplicadas', 'dataRemessaSic',
  'dataProrrogacao', 'duracaoProrrogacao', 'magistrado',
  'remessaJgAlteracao', 'obs1', 'obs2', 'status',
];

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

    // Get existing record to handle partial updates and audit diff
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

    // Audit log: compare old vs new for each tracked field
    for (const field of TRACKED_FIELDS) {
      const dbField = camelToSnake(field);
      const oldVal = existing[dbField as keyof typeof existing];
      const newVal = updateData[dbField];

      // Compare values (normalize for comparison)
      const oldStr = formatAuditValue(oldVal);
      const newStr = formatAuditValue(newVal);

      if (oldStr !== newStr) {
        await createAuditLog({
          arguidoId: parseInt(id),
          action: 'atualizacao',
          fieldChanged: fieldLabel(field),
          oldValue: oldStr,
          newValue: newStr,
          username: request.headers.get('x-user-username') || body.username || 'sistema',
        });
      }
    }

    // Also log computed deadline changes
    if (formatAuditValue(existing.fim_primeiro_prazo) !== formatAuditValue(fimPrimeiroPrazo)) {
      await createAuditLog({
        arguidoId: parseInt(id),
        action: 'atualizacao',
        fieldChanged: 'Fim 1º Prazo (calculado)',
        oldValue: formatAuditValue(existing.fim_primeiro_prazo),
        newValue: formatAuditValue(fimPrimeiroPrazo),
        username: request.headers.get('x-user-username') || body.username || 'sistema',
      });
    }
    if (formatAuditValue(existing.fim_segundo_prazo) !== formatAuditValue(fimSegundoPrazo)) {
      await createAuditLog({
        arguidoId: parseInt(id),
        action: 'atualizacao',
        fieldChanged: 'Fim 2º Prazo (calculado)',
        oldValue: formatAuditValue(existing.fim_segundo_prazo),
        newValue: formatAuditValue(fimSegundoPrazo),
        username: request.headers.get('x-user-username') || body.username || 'sistema',
      });
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

    // Get existing record before delete for audit
    const { data: existing } = await supabase
      .from('arguidos')
      .select('id, numero_id, nome_arguido, numero_processo')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('arguidos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log: removal
    if (existing) {
      await createAuditLog({
        arguidoId: existing.id,
        action: 'remocao',
        newValue: `Arguido "${existing.nome_arguido}" (${existing.numero_id}) removido do sistema`,
        username: request.headers.get('x-user-username') || 'sistema',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting arguido:', error);
    return NextResponse.json({ error: 'Failed to delete arguido' }, { status: 500 });
  }
}
