import { NextRequest, NextResponse } from 'next/server';
import { supabase, toSnakeCaseDeep } from '@/lib/supabase';

// POST /api/backup/restore - Import backup JSON data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate structure — support both v1.0 (version + data) and legacy (metadata + arguidos)
    const isV1 = body.version && body.data;
    const isLegacy = body.metadata && body.arguidos;

    if (!isV1 && !isLegacy) {
      return NextResponse.json(
        { error: 'Estrutura de backup inválida. O ficheiro deve conter "version" e "data", ou "metadata" e "arguidos".' },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    let arguidosRestored = 0;
    let alertasRestored = 0;
    let auditLogsRestored = 0;
    let documentsRestored = 0;

    // --- Restore Arguidos ---
    const arguidosRaw = isV1 ? (body.data.arguidos || []) : (body.arguidos || []);

    if (Array.isArray(arguidosRaw) && arguidosRaw.length > 0) {
      for (const a of arguidosRaw) {
        const cleaned = { ...a };
        const existingId = cleaned.id as number | undefined;

        // Remove auto-generated fields
        delete cleaned.id;
        delete cleaned.createdAt;
        delete cleaned.updatedAt;
        delete cleaned.numeroId;

        const snakeRecord = toSnakeCaseDeep(cleaned) as Record<string, unknown>;

        if (existingId) {
          // Upsert: try update first, fall back to insert
          const { error: updateError } = await supabase
            .from('arguidos')
            .update(snakeRecord)
            .eq('id', existingId);

          if (updateError) {
            // ID may not exist, try insert
            const { error: insertError } = await supabase
              .from('arguidos')
              .insert(snakeRecord);
            if (insertError) {
              errors.push(`Arguido (nome: ${a.nomeArguido || 'desconhecido'}): ${insertError.message}`);
              continue;
            }
          }
        } else {
          const { error: insertError } = await supabase
            .from('arguidos')
            .insert(snakeRecord);
          if (insertError) {
            errors.push(`Arguido (nome: ${a.nomeArguido || 'desconhecido'}): ${insertError.message}`);
            continue;
          }
        }
        arguidosRestored++;
      }
    }

    // --- Restore Alertas ---
    const alertasRaw = isV1 ? (body.data.alertas || []) : (body.alertas || []);

    if (Array.isArray(alertasRaw) && alertasRaw.length > 0) {
      for (const a of alertasRaw) {
        const cleaned = { ...a };
        const existingId = cleaned.id as number | undefined;

        delete cleaned.id;
        delete cleaned.createdAt;
        delete cleaned.dataLeitura;

        const snakeRecord = toSnakeCaseDeep(cleaned) as Record<string, unknown>;

        if (existingId) {
          const { error: updateError } = await supabase
            .from('alertas')
            .update(snakeRecord)
            .eq('id', existingId);

          if (updateError) {
            const { error: insertError } = await supabase
              .from('alertas')
              .insert(snakeRecord);
            if (insertError) {
              errors.push(`Alerta ID ${existingId}: ${insertError.message}`);
              continue;
            }
          }
        } else {
          const { error: insertError } = await supabase
            .from('alertas')
            .insert(snakeRecord);
          if (insertError) {
            errors.push(`Alerta: ${insertError.message}`);
            continue;
          }
        }
        alertasRestored++;
      }
    }

    // --- Restore Audit Logs ---
    const auditLogsRaw = isV1 ? (body.data.auditLogs || []) : [];

    if (Array.isArray(auditLogsRaw) && auditLogsRaw.length > 0) {
      for (const a of auditLogsRaw) {
        const cleaned = { ...a };
        const existingId = cleaned.id as number | undefined;

        delete cleaned.id;
        delete cleaned.createdAt;

        const snakeRecord = toSnakeCaseDeep(cleaned) as Record<string, unknown>;

        if (existingId) {
          const { error: updateError } = await supabase
            .from('audit_logs')
            .update(snakeRecord)
            .eq('id', existingId);

          if (updateError) {
            const { error: insertError } = await supabase
              .from('audit_logs')
              .insert(snakeRecord);
            if (insertError) {
              errors.push(`Audit Log ID ${existingId}: ${insertError.message}`);
              continue;
            }
          }
        } else {
          const { error: insertError } = await supabase
            .from('audit_logs')
            .insert(snakeRecord);
          if (insertError) {
            errors.push(`Audit Log: ${insertError.message}`);
            continue;
          }
        }
        auditLogsRestored++;
      }
    }

    // --- Restore Documents (metadata only, files need re-upload) ---
    const documentsRaw = isV1 ? (body.data.documents || []) : [];

    if (Array.isArray(documentsRaw) && documentsRaw.length > 0) {
      for (const d of documentsRaw) {
        const cleaned = { ...d };
        const existingId = cleaned.id as number | undefined;

        delete cleaned.id;
        delete cleaned.createdAt;

        const snakeRecord = toSnakeCaseDeep(cleaned) as Record<string, unknown>;

        if (existingId) {
          const { error: updateError } = await supabase
            .from('documents')
            .update(snakeRecord)
            .eq('id', existingId);

          if (updateError) {
            const { error: insertError } = await supabase
              .from('documents')
              .insert(snakeRecord);
            if (insertError) {
              errors.push(`Documento "${d.fileName || 'desconhecido'}": ${insertError.message}`);
              continue;
            }
          }
        } else {
          const { error: insertError } = await supabase
            .from('documents')
            .insert(snakeRecord);
          if (insertError) {
            errors.push(`Documento "${d.fileName || 'desconhecido'}": ${insertError.message}`);
            continue;
          }
        }
        documentsRestored++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Backup restaurado com sucesso.',
      restored: {
        arguidos: arguidosRestored,
        alertas: alertasRestored,
        auditLogs: auditLogsRestored,
        documents: documentsRestored,
      },
      backupVersion: isV1 ? body.version : (body.metadata?.version || 'legacy'),
      backupDate: isV1 ? body.exportDate : (body.metadata?.exportDate || 'unknown'),
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error('Backup restore error:', error);
    return NextResponse.json({ error: 'Falha ao restaurar backup.' }, { status: 500 });
  }
}
