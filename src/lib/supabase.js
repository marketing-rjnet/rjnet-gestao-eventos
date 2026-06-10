// Cliente Supabase — ativado quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
// estão definidos (.env.local em dev, variáveis de ambiente na Vercel em prod).
// Sem credenciais o app continua funcionando 100% via localStorage.
import { createClient } from '@supabase/supabase-js';

// Aceita a URL colada com caminho extra (ex: .../rest/v1) ou barra no final —
// o client espera apenas a base https://SEU-PROJETO.supabase.co
const url = (import.meta.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const supabaseEnabled = Boolean(supabase);

if (!supabaseEnabled) {
  console.info('[rjnet] Supabase não configurado — usando armazenamento local (localStorage).');
}
