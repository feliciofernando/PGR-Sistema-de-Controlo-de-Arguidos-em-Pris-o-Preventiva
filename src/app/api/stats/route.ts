import { NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// GET /api/stats - Dashboard statistics
export async function GET() {
  try {
    const now = new Date();

    // Parallel count queries
    const [
      totalRes,
      ativosRes,
      vencidosRes,
      totalAlertasRes,
      alertasPendentesRes,
    ] = await Promise.all([
      supabase.from('arguidos').select('*', { count: 'exact', head: true }),
      supabase.from('arguidos').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
      supabase.from('arguidos').select('*', { count: 'exact', head: true }).eq('status', 'vencido'),
      supabase.from('alertas').select('*', { count: 'exact', head: true }),
      supabase.from('alertas').select('*', { count: 'exact', head: true }).eq('status_envio', 'pendente'),
    ]);

    const totalArguidos = totalRes.count || 0;
    const ativos = ativosRes.count || 0;
    const vencidos = vencidosRes.count || 0;
    const totalAlertas = totalAlertasRes.count || 0;
    const alertasPendentes = alertasPendentesRes.count || 0;

    // Active arguidos with deadline info
    const { data: ativosComPrazos } = await supabase
      .from('arguidos')
      .select('id, numero_id, numero_processo, nome_arguido, crime, magistrado, fim_primeiro_prazo, fim_segundo_prazo')
      .eq('status', 'ativo');

    // Calculate deadline categories
    let prazosProximos = 0;
    let prazosCriticos = 0;
    const processosUrgentes: Array<{
      id: number;
      numeroId: string;
      numeroProcesso: string;
      nomeArguido: string;
      crime: string;
      diasRestantes: number;
      dataVencimento: string;
      tipo: string;
    }> = [];

    for (const a of (ativosComPrazos || [])) {
      const deadlines = [
        { date: a.fim_primeiro_prazo as string | null, type: '1º Prazo' },
        { date: a.fim_segundo_prazo as string | null, type: '2º Prazo' },
      ].filter(d => d.date !== null);

      if (deadlines.length === 0) continue;

      const nearest = deadlines.reduce((prev, curr) =>
        new Date(prev.date!) < new Date(curr.date!) ? prev : curr
      );

      const daysRemaining = Math.ceil(
        (new Date(nearest.date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysRemaining <= 7 && daysRemaining > 0) prazosProximos++;
      if (daysRemaining <= 3 && daysRemaining > 0) prazosCriticos++;

      if (daysRemaining <= 7) {
        processosUrgentes.push({
          id: a.id,
          numeroId: a.numero_id,
          numeroProcesso: a.numero_processo,
          nomeArguido: a.nome_arguido,
          crime: a.crime,
          diasRestantes: daysRemaining,
          dataVencimento: nearest.date!,
          tipo: nearest.type,
        });
      }
    }

    processosUrgentes.sort((a, b) => a.diasRestantes - b.diasRestantes);

    // Crime distribution - use a column-based approach since Supabase doesn't have groupBy
    const { data: allCrimes } = await supabase
      .from('arguidos')
      .select('crime');

    const crimeCounts: Record<string, number> = {};
    for (const a of (allCrimes || [])) {
      const crime = a.crime || 'Não especificado';
      crimeCounts[crime] = (crimeCounts[crime] || 0) + 1;
    }
    const crimes = Object.entries(crimeCounts)
      .map(([crime, count]) => ({ crime, _count: { crime: count } }))
      .sort((a, b) => b._count.crime - a._count.crime);

    // Magistrado distribution
    const { data: allMagistrados } = await supabase
      .from('arguidos')
      .select('magistrado')
      .not('magistrado', 'is', null)
      .neq('magistrado', '');

    const magistradoCounts: Record<string, number> = {};
    for (const a of (allMagistrados || [])) {
      const m = a.magistrado || '';
      magistradoCounts[m] = (magistradoCounts[m] || 0) + 1;
    }
    const magistrados = Object.entries(magistradoCounts)
      .map(([magistrado, count]) => ({ magistrado, _count: { magistrado: count } }))
      .sort((a, b) => b._count.magistrado - a._count.magistrado);

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: monthlyData } = await supabase
      .from('arguidos')
      .select('created_at')
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    const monthlyCounts: Record<string, number> = {};
    for (const a of (monthlyData || [])) {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    }

    // Status distribution
    const { data: allStatus } = await supabase
      .from('arguidos')
      .select('status');

    const statusCountsMap: Record<string, number> = {};
    for (const a of (allStatus || [])) {
      const s = a.status || 'outro';
      statusCountsMap[s] = (statusCountsMap[s] || 0) + 1;
    }
    const statusCounts = Object.entries(statusCountsMap)
      .map(([status, count]) => ({ status, _count: { status: count } }));

    return NextResponse.json({
      totalArguidos,
      ativos,
      vencidos,
      encerrados: totalArguidos - ativos - vencidos,
      totalAlertas,
      alertasPendentes,
      prazosProximos,
      prazosCriticos,
      processosUrgentes,
      crimes,
      magistrados,
      monthlyCounts,
      statusCounts,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
