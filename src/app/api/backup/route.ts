import { NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// GET /api/backup - Export all data as JSON backup
export async function GET() {
  try {
    const exportDate = new Date().toISOString();
    const version = '1.0';

    // Fetch all tables in parallel
    const [
      arguidosRes,
      alertasRes,
      auditLogsRes,
      documentsRes,
    ] = await Promise.all([
      supabase.from('arguidos').select('*').order('created_at', { ascending: true }),
      supabase.from('alertas').select('*').order('created_at', { ascending: true }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: true }),
      supabase.from('documents').select('*').order('created_at', { ascending: true }),
    ]);

    const errors: string[] = [];

    if (arguidosRes.error) {
      errors.push(`arguidos: ${arguidosRes.error.message}`);
    }
    if (alertasRes.error) {
      errors.push(`alertas: ${alertasRes.error.message}`);
    }
    if (auditLogsRes.error) {
      errors.push(`audit_logs: ${auditLogsRes.error.message}`);
    }
    if (documentsRes.error) {
      errors.push(`documents: ${documentsRes.error.message}`);
    }

    // Continue even with partial errors (non-critical tables)
    const arguidos = arguidosRes.data || [];
    const alertas = alertasRes.data || [];
    const auditLogs = auditLogsRes.data || [];
    const documents = documentsRes.data || [];

    const backup = {
      version,
      exportDate,
      system: 'PGR Angola - Sistema de Controlo de Arguidos em Prisão Preventiva',
      generatedBy: 'backup-api',
      counts: {
        arguidos: arguidos.length,
        alertas: alertas.length,
        auditLogs: auditLogs.length,
        documents: documents.length,
      },
      data: {
        arguidos: toCamelCaseDeep(arguidos),
        alertas: toCamelCaseDeep(alertas),
        auditLogs: toCamelCaseDeep(auditLogs),
        documents: documents.map((d: Record<string, unknown>) => ({
          // Exclude binary storage data, export metadata only
          id: d.id,
          arguidoId: d.arguido_id,
          fileName: d.file_name,
          filePath: d.file_path,
          fileSize: d.file_size,
          fileType: d.file_type,
          category: d.category,
          description: d.description,
          url: d.url,
          createdAt: d.created_at,
        })),
      },
      ...(errors.length > 0 ? { warnings: errors } : {}),
    };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `backup_pgr_${timestamp}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Backup export error:', error);
    return NextResponse.json({ error: 'Failed to export backup' }, { status: 500 });
  }
}
