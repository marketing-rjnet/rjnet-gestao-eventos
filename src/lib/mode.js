// Ponto único de leitura de variáveis de ambiente relacionadas ao modo de execução.
// Nenhum outro módulo pode acessar import.meta.env.VITE_SUPABASE_URL diretamente.
const url = (import.meta.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const MODE = {
  SUPABASE: 'supabase',
  LOCAL: 'local',
};

export function isSupabaseMode() {
  return Boolean(url && anonKey);
}

export function getMode() {
  return isSupabaseMode() ? MODE.SUPABASE : MODE.LOCAL;
}

export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;
