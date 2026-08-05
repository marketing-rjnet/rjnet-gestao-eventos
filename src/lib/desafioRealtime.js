// Desafio RJNet — Acerte 00:03:33 (D-089)
// Realtime da tela pública de TV via Supabase Realtime Broadcast — mesmo
// idioma já usado pelo Monitor (src/lib/activityLog.js, canal
// `rjnet-monitor`), reaproveitado aqui porque a tela de TV é ANÔNIMA e
// não tem policy de SELECT nas tabelas do módulo: uma subscription
// `postgres_changes` não entregaria nada a ela (Realtime respeita RLS).
// Broadcast é pub/sub puro, sem depender de RLS/publication — o painel
// autenticado avisa "algo mudou nesse dia", a tela de TV reage buscando
// de novo via RPC pública (fonte de verdade continua sendo o banco).
import { supabase } from './supabase';
import { isSupabaseMode } from './mode';

const canalDesafio = (eventId) => `desafio-painel-${eventId}`;

// Chamado pelo painel administrativo depois de qualquer gravação
// (cadastro, edição, exclusão, entrega de prêmio) bem-sucedida.
export function broadcastDesafioPainel(eventId) {
  if (!isSupabaseMode() || !supabase || !eventId) return;
  const channel = supabase.channel(canalDesafio(eventId), { config: { broadcast: { self: false } } });
  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    channel.send({ type: 'broadcast', event: 'painel', payload: { at: Date.now() } })
      .catch(() => {})
      .finally(() => supabase.removeChannel(channel));
  });
}

// Chamado pela tela de TV (anon) — dispara `onUpdate` sempre que o painel
// administrativo gravar algo nesse dia. Retorna função de cleanup.
export function subscribeDesafioPainel(eventId, onUpdate) {
  if (!isSupabaseMode() || !supabase || !eventId) return () => {};
  const channel = supabase
    .channel(canalDesafio(eventId), { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'painel' }, () => onUpdate())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
