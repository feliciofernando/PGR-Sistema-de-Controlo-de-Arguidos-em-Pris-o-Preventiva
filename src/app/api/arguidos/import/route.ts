import { NextRequest, NextResponse } from 'next/server';
import { supabase, addMonthsToISO } from '@/lib/supabase';

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        current.push(field.trim());
        if (current.length > 1 || (current.length === 1 && current[0] !== '')) {
          lines.push(current);
        }
        current = [];
        field = '';
        // Skip \r\n
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
      } else {
        field += ch;
      }
    }
  }
  // Last field
  if (field || current.length > 0) {
    current.push(field.trim());
    if (current.length > 1 || (current.length === 1 && current[0] !== '')) {
      lines.push(current);
    }
  }
  return lines;
}

const EXPECTED_COLUMNS = [
  'numero_processo', 'nome_arguido', 'nome_pai', 'nome_mae',
  'data_detencao', 'crime', 'magistrado', 'medidas_aplicadas',
  'data_medidas_aplicadas', 'status',
];

// POST /api/arguidos/import — Import CSV file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are accepted' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 });
    }

    // Parse header
    const header = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));

    // Validate header
    const missing = EXPECTED_COLUMNS.filter(col => !header.includes(col));
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Missing columns: ${missing.join(', ')}`,
        required: EXPECTED_COLUMNS,
      }, { status: 400 });
    }

    // Get total count for ID generation
    const { count: totalCount } = await supabase
      .from('arguidos')
      .select('*', { count: 'exact', head: true });

    let imported = 0;
    const errors: Array<{ row: number; errors: string[] }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors: string[] = [];

      if (row.length !== header.length) {
        rowErrors.push(`Expected ${header.length} columns, got ${row.length}`);
        errors.push({ row: i + 1, errors: rowErrors });
        continue;
      }

      const getValue = (col: string) => {
        const idx = header.indexOf(col);
        return idx >= 0 ? (row[idx] || '').trim() : '';
      };

      const nomeArguido = getValue('nome_arguido');
      if (!nomeArguido) {
        rowErrors.push('nome_arguido is required');
      }

      const crime = getValue('crime');
      if (!crime) {
        rowErrors.push('crime is required');
      }

      const status = getValue('status') || 'ativo';
      if (!['ativo', 'vencido', 'encerrado'].includes(status)) {
        rowErrors.push(`Invalid status: "${status}"`);
      }

      const dataMedidasStr = getValue('data_medidas_aplicadas');
      let dataMedidas: string | null = null;
      if (dataMedidasStr) {
        const parsed = new Date(dataMedidasStr);
        if (isNaN(parsed.getTime())) {
          rowErrors.push(`Invalid data_medidas_aplicadas: "${dataMedidasStr}"`);
        } else {
          dataMedidas = parsed.toISOString().slice(0, 10);
        }
      }

      const dataDetencaoStr = getValue('data_detencao');
      let dataDetencao: string | null = null;
      if (dataDetencaoStr) {
        const parsed = new Date(dataDetencaoStr);
        if (isNaN(parsed.getTime())) {
          rowErrors.push(`Invalid data_detencao: "${dataDetencaoStr}"`);
        } else {
          dataDetencao = parsed.toISOString().slice(0, 10);
        }
      }

      if (rowErrors.length > 0) {
        errors.push({ row: i + 1, errors: rowErrors });
        continue;
      }

      const nextId = (totalCount || 0) + imported + 1;
      const numeroId = `PGR-${String(nextId).padStart(4, '0')}`;

      const fimPrimeiroPrazo = addMonthsToISO(dataMedidas, 3);

      const record = {
        numero_id: numeroId,
        numero_processo: getValue('numero_processo'),
        nome_arguido: nomeArguido,
        nome_pai: getValue('nome_pai'),
        nome_mae: getValue('nome_mae'),
        data_detencao: dataDetencao,
        crime,
        magistrado: getValue('magistrado'),
        medidas_aplicadas: getValue('medidas_aplicadas'),
        data_medidas_aplicadas: dataMedidas,
        fim_primeiro_prazo: fimPrimeiroPrazo,
        status,
      };

      const { error: insertError } = await supabase
        .from('arguidos')
        .insert(record);

      if (insertError) {
        rowErrors.push(`DB error: ${insertError.message}`);
        errors.push({ row: i + 1, errors: rowErrors });
        continue;
      }

      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      total: rows.length - 1,
      errors,
    });
  } catch (error) {
    console.error('Error importing CSV:', error);
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 });
  }
}
