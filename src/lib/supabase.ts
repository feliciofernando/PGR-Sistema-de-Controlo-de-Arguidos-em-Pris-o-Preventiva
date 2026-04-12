import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
  );
}

// Server-side Supabase client with service_role (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Column name mappings: camelCase (app) <-> snake_case (DB)
const arguidoMap: Record<string, string> = {
  numeroId: 'numero_id',
  numeroProcesso: 'numero_processo',
  nomeArguido: 'nome_arguido',
  dataDetencao: 'data_detencao',
  dataRemessaJg: 'data_remessa_jg',
  dataRegresso: 'data_regresso',
  medidasAplicadas: 'medidas_aplicadas',
  dataMedidasAplicadas: 'data_medidas_aplicadas',
  dataRemessaSic: 'data_remessa_sic',
  fimPrimeiroPrazo: 'fim_primeiro_prazo',
  dataProrrogacao: 'data_prorrogacao',
  duracaoProrrogacao: 'duracao_prorrogacao',
  fimSegundoPrazo: 'fim_segundo_prazo',
  remessaJgAlteracao: 'remessa_jg_alteracao',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const alertaMap: Record<string, string> = {
  arguidoId: 'arguido_id',
  tipoAlerta: 'tipo_alerta',
  diasRestantes: 'dias_restantes',
  canalEnvio: 'canal_envio',
  statusEnvio: 'status_envio',
  dataDisparo: 'data_disparo',
  dataLeitura: 'data_leitura',
  createdAt: 'created_at',
};

function toSnake(str: string, map?: Record<string, string>): string {
  if (map && map[str]) return map[str];
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Deep convert object keys from camelCase to snake_case
export function toSnakeCaseDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCaseDeep);
  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toSnake(key)] = toSnakeCaseDeep(value);
    }
    return result;
  }
  if (obj instanceof Date) return obj.toISOString().slice(0, 10);
  return obj;
}

// Deep convert object keys from snake_case to camelCase
export function toCamelCaseDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCaseDeep);
  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toCamel(key)] = toCamelCaseDeep(value);
    }
    return result;
  }
  return obj;
}

// Add months to a date (for prazo calculations), handling month-end edge cases
export function addMonthsToISO(dateStr: string | null, months: number): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const originalDay = d.getDate();
  // Set month first
  d.setMonth(d.getMonth() + months);
  // If the day rolled over (e.g., Jan 31 + 1 month = Mar 3 instead of Feb 28),
  // go back to the last day of the target month
  if (d.getDate() !== originalDay) {
    d.setDate(0); // Last day of previous month (which is the target month)
  }
  return d.toISOString();
}
