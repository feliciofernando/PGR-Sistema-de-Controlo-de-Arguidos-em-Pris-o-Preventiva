import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// GET /api/stats - Dashboard statistics
// Supports: ?magistrado=X&startDate=Y&endDate=Z&crime=X&status=X
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const magistradoFilter = searchParams.get('magistrado') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const crimeFilter = searchParams.get('crime') || '';
    const statusFilter = searchParams.get('status') || '';
    const now = new Date();

    // Base query builder with optional filters
    const buildQuery = <T extends 'count' | 'data'>(mode: T) => {
      if (mode === 'count') {
        const q = supabase.from('arguidos').select('*', { count: 'exact', head: true });
        return applyFilters(q);
      }
      const q = supabase.from('arguidos').select('*');
      return applyFilters(q);
    };

    const applyFilters = (q: ReturnType<typeof supabase.from>) => {
      if (magistradoFilter) q = q.eq('magistrado', magistradoFilter);
      if (startDate) q = q.gte('created_at', startDate);
      if (endDate) q = q.lte('created_at', endDate + 'T23:59:59');
      if (crimeFilter) q = q.eq('crime', crimeFilter);
      if (statusFilter) q = q.eq('status', statusFilter);
      return q;
    };

    // Parallel count queries
    const [
      totalRes,
      ativosRes,
      vencidosRes,
      totalAlertasRes,
      alertasPendentesRes,
    ] = await Promise.all([
      buildQuery('count'),
      (() => { const q = supabase.from('arguidos').select('*', { count: 'exact', head: true }); return applyFilters(q).eq('status', 'ativo'); })(),
      (() => { const q = supabase.from('arguidos').select('*', { count: 'exact', head: true }); return applyFilters(q).eq('status', 'vencido'); })(),
      supabase.from('alertas').select('*', { count: 'exact', head: true }),
      supabase.from('alertas').select('*', { count: 'exact', head: true }).eq('status_envio', 'pendente'),
    ]);

    const totalArguidos = totalRes.count || 0;
    const ativos = ativosRes.count || 0;
    const vencidos = vencidosRes.count || 0;
    const totalAlertas = totalAlertasRes.count || 0;
    const alertasPendentes = alertasPendentesRes.count || 0;

    // Active arguidos with deadline info
    let ativosQuery = supabase
      .from('arguidos')
      .select('id, numero_id, numero_processo, nome_arguido, crime, magistrado, fim_primeiro_prazo, fim_segundo_prazo, created_at')
      .eq('status', 'ativo');
    if (magistradoFilter) ativosQuery = ativosQuery.eq('magistrado', magistradoFilter);
    if (startDate) ativosQuery = ativosQuery.gte('created_at', startDate);
    if (endDate) ativosQuery = ativosQuery.lte('created_at', endDate + 'T23:59:59');
    if (crimeFilter) ativosQuery = ativosQuery.eq('crime', crimeFilter);
    const { data: ativosComPrazos } = await ativosQuery;

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

    // Crime distribution
    let crimesQuery = supabase.from('arguidos').select('crime');
    if (magistradoFilter) crimesQuery = crimesQuery.eq('magistrado', magistradoFilter);
    if (startDate) crimesQuery = crimesQuery.gte('created_at', startDate);
    if (endDate) crimesQuery = crimesQuery.lte('created_at', endDate + 'T23:59:59');
    if (statusFilter) crimesQuery = crimesQuery.eq('status', statusFilter);
    const { data: allCrimes } = await crimesQuery;

    const crimeCounts: Record<string, number> = {};
    for (const a of (allCrimes || [])) {
      const crime = a.crime || 'Não especificado';
      crimeCounts[crime] = (crimeCounts[crime] || 0) + 1;
    }
    const crimes = Object.entries(crimeCounts)
      .map(([crime, count]) => ({ crime, _count: { crime: count } }))
      .sort((a, b) => b._count.crime - a._count.crime);

    // Magistrado distribution
    let magistradosQuery = supabase
      .from('arguidos')
      .select('magistrado')
      .not('magistrado', 'is', null)
      .neq('magistrado', '');
    if (magistradoFilter) magistradosQuery = magistradosQuery.eq('magistrado', magistradoFilter);
    if (startDate) magistradosQuery = magistradosQuery.gte('created_at', startDate);
    if (endDate) magistradosQuery = magistradosQuery.lte('created_at', endDate + 'T23:59:59');
    if (crimeFilter) magistradosQuery = magistradosQuery.eq('crime', crimeFilter);
    if (statusFilter) magistradosQuery = magistradosQuery.eq('status', statusFilter);
    const { data: allMagistrados } = await magistradosQuery;

    const magistradoCounts: Record<string, number> = {};
    for (const a of (allMagistrados || [])) {
      const m = a.magistrado || '';
      magistradoCounts[m] = (magistradoCounts[m] || 0) + 1;
    }
    const magistrados = Object.entries(magistradoCounts)
      .map(([magistrado, count]) => ({ magistrado, _count: { magistrado: count } }))
      .sort((a, b) => b._count.magistrado - a._count.magistrado);

    // Monthly trend — use date range if provided, else last 6 months
    const rangeStart = startDate || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return d.toISOString().slice(0, 10);
    })();
    const rangeEnd = endDate || new Date().toISOString().slice(0, 10);

    let monthlyQuery = supabase
      .from('arguidos')
      .select('created_at')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd + 'T23:59:59')
      .order('created_at', { ascending: true });
    if (magistradoFilter) monthlyQuery = monthlyQuery.eq('magistrado', magistradoFilter);
    if (crimeFilter) monthlyQuery = monthlyQuery.eq('crime', crimeFilter);
    if (statusFilter) monthlyQuery = monthlyQuery.eq('status', statusFilter);
    const { data: monthlyData } = await monthlyQuery;

    const monthlyCounts: Record<string, number> = {};
    for (const a of (monthlyData || [])) {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    }

    // Status distribution
    let statusQuery = supabase.from('arguidos').select('status');
    if (magistradoFilter) statusQuery = statusQuery.eq('magistrado', magistradoFilter);
    if (startDate) statusQuery = statusQuery.gte('created_at', startDate);
    if (endDate) statusQuery = statusQuery.lte('created_at', endDate + 'T23:59:59');
    if (crimeFilter) statusQuery = statusQuery.eq('crime', crimeFilter);
    const { data: allStatus } = await statusQuery;

    const statusCountsMap: Record<string, number> = {};
    for (const a of (allStatus || [])) {
      const s = a.status || 'outro';
      statusCountsMap[s] = (statusCountsMap[s] || 0) + 1;
    }
    const statusCounts = Object.entries(statusCountsMap)
      .map(([status, count]) => ({ status, _count: { status: count } }));

    // Magistrado-specific: "Meus Processos"
    let meusProcessos: Array<{
      id: number;
      numeroId: string;
      numeroProcesso: string;
      nomeArguido: string;
      crime: string;
      status: string;
      fimPrimeiroPrazo: string | null;
      diasRestantes: number | null;
    }> = [];

    if (magistradoFilter) {
      let mpQuery = supabase
        .from('arguidos')
        .select('id, numero_id, numero_processo, nome_arguido, crime, status, magistrado, fim_primeiro_prazo, fim_segundo_prazo')
        .eq('magistrado', magistradoFilter)
        .order('created_at', { ascending: false });
      if (startDate) mpQuery = mpQuery.gte('created_at', startDate);
      if (endDate) mpQuery = mpQuery.lte('created_at', endDate + 'T23:59:59');
      const { data: mpData } = await mpQuery;

      for (const a of (mpData || [])) {
        const days = a.fim_primeiro_prazo
          ? Math.ceil((new Date(a.fim_primeiro_prazo).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        meusProcessos.push({
          id: a.id,
          numeroId: a.numero_id,
          numeroProcesso: a.numero_processo,
          nomeArguido: a.nome_arguido,
          crime: a.crime,
          status: a.status,
          fimPrimeiroPrazo: a.fim_primeiro_prazo,
          diasRestantes: days,
        });
      }
      meusProcessos.sort((a, b) => {
        const da = a.diasRestantes ?? 9999;
        const db = b.diasRestantes ?? 9999;
        return da - db;
      });
      meusProcessos = meusProcessos.slice(0, 10);
    }

    // Also return filtered arguidos list for report export
    let filteredQuery = supabase.from('arguidos').select('*').order('created_at', { ascending: false });
    if (magistradoFilter) filteredQuery = filteredQuery.eq('magistrado', magistradoFilter);
    if (startDate) filteredQuery = filteredQuery.gte('created_at', startDate);
    if (endDate) filteredQuery = filteredQuery.lte('created_at', endDate + 'T23:59:59');
    if (crimeFilter) filteredQuery = filteredQuery.eq('crime', crimeFilter);
    if (statusFilter) filteredQuery = filteredQuery.eq('status', statusFilter);
    const { data: filteredArguidos } = await filteredQuery;

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
      meusProcessos,
      filteredArguidos: toCamelCaseDeep(filteredArguidos || []),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
