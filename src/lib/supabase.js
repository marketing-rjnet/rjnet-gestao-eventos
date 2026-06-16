// Cliente Supabase — ativado quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
// estão definidos (.env.local em dev, variáveis de ambiente na Vercel em prod).
// Sem credenciais o app continua funcionando 100% via localStorage.
import { createClient } from '@supabase/supabase-js';
import { isSupabaseMode, supabaseUrl, supabaseAnonKey } from './mode';

export const supabase = isSupabaseMode()
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: sessionStorage } })
  : null;
export const supabaseConfig = { url: supabaseUrl, anonKey: supabaseAnonKey };

if (!isSupabaseMode()) {
  console.info('[rjnet] Supabase não configurado — usando armazenamento local (localStorage).');
}
