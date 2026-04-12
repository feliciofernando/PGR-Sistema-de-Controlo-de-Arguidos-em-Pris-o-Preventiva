import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// POST /api/relatorios/advanced — Advanced report with date range and filters
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dateFrom,
      dateTo,
      crime,
      status,
      magistrado,
    } = body as {
      dateFrom?: string;
      dateTo?: string;
      crime?: string;
      status?: string;
      magistrado?: string;
    };

    const now = new Date();

    // Helper to apply common filters
    const applyFilters = <T extends ReturnType<typeof supabase.from>>(q: T): T => {
      if (magistrado) q = q.eq('magistrado', magistrado) as unknown as T;
      if (dateFrom) q = q.gte('created_at', dateFrom) as unknown as T;
      if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59') as unknown as T;
      if (crime) q = q.eq('crime', crime) as unknown as T;
      if (status) q = q.eq('status', status) as unknown as T;
      return q;
    };

    // 1. Count queries
    const [
      totalRes,
      ativosRes,
      vencidosRes,
    ] = await Promise.all([
      applyFilters(supabase.from('arguidos').select('*', { count: 'exact', head: true })),
      applyFilters(supabase.from('arguidos').select('*', { count: 'exact', head: true })).eq('status', 'ativo'),
      applyFilters(supabase.from('arguidos').select('*', { count: 'exact', head: true })).eq('status', 'vencido'),
    ]);

    const totalArguidos = totalRes.count || 0;
    const ativos = ativosRes.count || 0;
    const vencidos = vencidosRes.count || 0;

    // Count encerrados directly (avoids negative values from subtraction)
    const encerradosRes = await applyFilters(supabase.from('arguidos').select('*', { count: 'exact', head: true })).eq('status', 'encerrado');
    const encerrados = encerradosRes.count || 0;

    // 2. Active with deadlines for prazos stats
    let ativosQuery = supabase
      .from('arguidos')
      .select('id, numero_id, numero_processo, nome_arguido, crime, magistrado, fim_primeiro_prazo, fim_segundo_prazo, created_at')
      .eq('status', 'ativo');
    if (magistrado) ativosQuery = ativosQuery.eq('magistrado', magistrado);
    if (dateFrom) ativosQuery = ativosQuery.gte('created_at', dateFrom);
    if (dateTo) ativosQuery = ativosQuery.lte('created_at', dateTo + 'T23:59:59');
    if (crime) ativosQuery = ativosQuery.eq('crime', crime);
    const { data: ativosComPrazos } = await ativosQuery;

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

    // 3. Crime distribution
    let crimesQuery = supabase.from('arguidos').select('crime');
    if (magistrado) crimesQuery = crimesQuery.eq('magistrado', magistrado);
    if (dateFrom) crimesQuery = crimesQuery.gte('created_at', dateFrom);
    if (dateTo) crimesQuery = crimesQuery.lte('created_at', dateTo + 'T23:59:59');
    if (status) crimesQuery = crimesQuery.eq('status', status);
    const { data: allCrimes } = await crimesQuery;

    const crimeCounts: Record<string, number> = {};
    for (const a of (allCrimes || [])) {
      const c = a.crime || 'Não especificado';
      crimeCounts[c] = (crimeCounts[c] || 0) + 1;
    }
    const crimes = Object.entries(crimeCounts)
      .map(([c, count]) => ({ crime: c, _count: { crime: count } }))
      .sort((a, b) => b._count.crime - a._count.crime);

    // 4. Magistrado distribution
    let magistradosQuery = supabase
      .from('arguidos')
      .select('magistrado')
      .not('magistrado', 'is', null)
      .neq('magistrado', '');
    if (magistrado) magistradosQuery = magistradosQuery.eq('magistrado', magistrado);
    if (dateFrom) magistradosQuery = magistradosQuery.gte('created_at', dateFrom);
    if (dateTo) magistradosQuery = magistradosQuery.lte('created_at', dateTo + 'T23:59:59');
    if (crime) magistradosQuery = magistradosQuery.eq('crime', crime);
    if (status) magistradosQuery = magistradosQuery.eq('status', status);
    const { data: allMagistrados } = await magistradosQuery;

    const magistradoCounts: Record<string, number> = {};
    for (const a of (allMagistrados || [])) {
      const m = a.magistrado || '';
      magistradoCounts[m] = (magistradoCounts[m] || 0) + 1;
    }
    const magistrados = Object.entries(magistradoCounts)
      .map(([m, count]) => ({ magistrado: m, _count: { magistrado: count } }))
      .sort((a, b) => b._count.magistrado - a._count.magistrado);

    // 5. Monthly distribution — use date range if provided, else last 6 months
    const rangeStart = dateFrom || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return d.toISOString().slice(0, 10);
    })();
    const rangeEnd = dateTo || new Date().toISOString().slice(0, 10);

    let monthlyQuery = supabase
      .from('arguidos')
      .select('created_at')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd + 'T23:59:59')
      .order('created_at', { ascending: true });
    if (magistrado) monthlyQuery = monthlyQuery.eq('magistrado', magistrado);
    if (crime) monthlyQuery = monthlyQuery.eq('crime', crime);
    if (status) monthlyQuery = monthlyQuery.eq('status', status);
    const { data: monthlyData } = await monthlyQuery;

    const monthlyCounts: Record<string, number> = {};
    for (const a of (monthlyData || [])) {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    }

    // 6. Status distribution (count by status)
    let statusQuery = supabase.from('arguidos').select('status');
    if (magistrado) statusQuery = statusQuery.eq('magistrado', magistrado);
    if (dateFrom) statusQuery = statusQuery.gte('created_at', dateFrom);
    if (dateTo) statusQuery = statusQuery.lte('created_at', dateTo + 'T23:59:59');
    if (crime) statusQuery = statusQuery.eq('crime', crime);
    const { data: allStatus } = await statusQuery;

    const statusCountsMap: Record<string, number> = {};
    for (const a of (allStatus || [])) {
      const s = a.status || 'outro';
      statusCountsMap[s] = (statusCountsMap[s] || 0) + 1;
    }
    const statusCounts = Object.entries(statusCountsMap)
      .map(([s, count]) => ({ status: s, _count: { status: count } }));

    // 7. Filtered arguidos for export
    let filteredQuery = supabase.from('arguidos').select('*').order('created_at', { ascending: false });
    if (magistrado) filteredQuery = filteredQuery.eq('magistrado', magistrado);
    if (dateFrom) filteredQuery = filteredQuery.gte('created_at', dateFrom);
    if (dateTo) filteredQuery = filteredQuery.lte('created_at', dateTo + 'T23:59:59');
    if (crime) filteredQuery = filteredQuery.eq('crime', crime);
    if (status) filteredQuery = filteredQuery.eq('status', status);
    const { data: filteredArguidos } = await filteredQuery;

    return NextResponse.json({
      totalArguidos,
      ativos,
      vencidos,
      encerrados,
      prazosProximos,
      prazosCriticos,
      processosUrgentes,
      crimes,
      magistrados,
      monthlyCounts,
      statusCounts,
      filteredArguidos: toCamelCaseDeep(filteredArguidos || []),
    });
  } catch (error) {
    console.error('Error generating advanced report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
