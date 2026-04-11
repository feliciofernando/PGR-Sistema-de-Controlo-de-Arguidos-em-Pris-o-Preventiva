import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// GET /api/arguidos/[id]/history - Combined audit logs + alert history for a specific arguido
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch audit logs for this arguido
    const { data: auditLogs, error: auditErr } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('arguido_id', parseInt(id))
      .order('created_at', { ascending: false });

    if (auditErr) {
      console.error('History audit error:', auditErr);
      // Non-blocking — continue with alerts
    }

    // Fetch alert history for this arguido
    const { data: alertLogs, error: alertErr } = await supabase
      .from('alertas')
      .select('*')
      .eq('arguido_id', parseInt(id))
      .order('data_disparo', { ascending: false });

    if (alertErr) {
      console.error('History alerts error:', alertErr);
    }

    // Combine into a unified timeline (most recent first)
    interface TimelineEntry {
      id: number | string;
      type: 'audit' | 'alerta';
      action: string;
      description: string;
      fieldChanged: string | null;
      oldValue: string | null;
      newValue: string | null;
      username: string | null;
      createdAt: string;
      metadata?: Record<string, unknown>;
    }

    const timeline: TimelineEntry[] = [];

    // Process audit logs
    if (auditLogs) {
      const camelLogs = toCamelCaseDeep(auditLogs) as Array<Record<string, unknown>>;
      for (const log of camelLogs) {
        const action = String(log.action || '');
        const fieldChanged = log.fieldChanged ? String(log.fieldChanged) : null;
        const oldValue = log.oldValue ? String(log.oldValue) : null;
        const newValue = log.newValue ? String(log.newValue) : null;

        let description = '';
        switch (action) {
          case 'criacao':
            description = newValue || 'Arguido cadastrado no sistema';
            break;
          case 'atualizacao':
            description = fieldChanged
              ? `Campo "${fieldChanged}" alterado`
              : 'Dados atualizados';
            break;
          case 'remocao':
            description = newValue || 'Arguido removido do sistema';
            break;
          case 'status_change':
            description = `Status alterado de "${oldValue}" para "${newValue}"`;
            break;
          default:
            description = action;
        }

        timeline.push({
          id: `audit-${log.id}`,
          type: 'audit',
          action,
          description,
          fieldChanged,
          oldValue,
          newValue,
          username: log.username ? String(log.username) : null,
          createdAt: String(log.createdAt || ''),
        });
      }
    }

    // Process alert logs
    if (alertLogs) {
      const camelAlerts = toCamelCaseDeep(alertLogs) as Array<Record<string, unknown>>;
      for (const alert of camelAlerts) {
        const tipoAlerta = String(alert.tipoAlerta || '').replace(/_/g, ' ');
        const diasRestantes = alert.diasRestantes !== null ? Number(alert.diasRestantes) : null;
        const mensagem = String(alert.mensagem || '');
        const statusEnvio = String(alert.statusEnvio || '');

        let urgencyLabel = '';
        if (diasRestantes !== null) {
          if (diasRestantes < 0) urgencyLabel = `Expirado há ${Math.abs(diasRestantes)} dia(s)`;
          else if (diasRestantes === 0) urgencyLabel = 'Vence hoje!';
          else if (diasRestantes <= 3) urgencyLabel = `Crítico: ${diasRestantes} dia(s) restante(s)`;
          else if (diasRestantes <= 7) urgencyLabel = `Atenção: ${diasRestantes} dia(s) restante(s)`;
          else urgencyLabel = `${diasRestantes} dia(s) restante(s)`;
        }

        timeline.push({
          id: `alerta-${alert.id}`,
          type: 'alerta',
          action: tipoAlerta,
          description: mensagem || `Alerta de prazo (${tipoAlerta})`,
          fieldChanged: null,
          oldValue: urgencyLabel,
          newValue: statusEnvio,
          username: null,
          createdAt: String(alert.dataDisparo || alert.createdAt || ''),
          metadata: {
            diasRestantes,
            tipoAlerta,
            canalEnvio: alert.canalEnvio,
          },
        });
      }
    }

    // Sort by date (most recent first)
    timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      arguidoId: parseInt(id),
      timeline,
      totalAuditLogs: auditLogs?.length || 0,
      totalAlertLogs: alertLogs?.length || 0,
    });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
