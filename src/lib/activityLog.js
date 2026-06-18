import { supabase } from './supabase';

const KEY_PREFIX = 'rjnet_activity_';
const MAX_LOGS_PER_DAY = 200;
const MAX_DAYS = 30;

let _pruned = false;

/* ─── Canal único Supabase Realtime por cliente ─────────────────── */
let _channel = null;
let _subscribed = false;
let _queue = [];
let _listeners = [];   // callbacks do MonitoringTab

function initChannel() {
  if (!supabase || _channel) return;
  _channel = supabase.channel('rjnet-monitor', {
    config: { broadcast: { self: false } },
  });
  /* listener deve ser registrado ANTES de subscribe() */
  _channel.on('broadcast', { event: 'log' }, ({ payload }) => {
    const isNew = receiveActivityLog(payload);
    if (isNew) _listeners.forEach((fn) => fn());
  });
  _channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    _subscribed = true;
    _queue.forEach((p) =>
      _channel.send({ type: 'broadcast', event: 'log', payload: p }).catch(() => {})
    );
    _queue = [];
  });
}

initChannel();

function broadcast(record) {
  if (!supabase || !_channel) return;
  if (_subscribed) {
    _channel.send({ type: 'broadcast', event: 'log', payload: record }).catch(() => {});
  } else {
    _queue.push(record);
  }
}

/* ─── Helpers de storage ────────────────────────────────────────── */
function todayKey() {
  return KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

function pruneOldDays() {
  if (_pruned) return;
  _pruned = true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX) && k.replace(KEY_PREFIX, '') < cutoffStr) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

/* ─── API pública ───────────────────────────────────────────────── */
export function logActivity(entry) {
  pruneOldDays();
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toISOString(),
    level: 'info',
    vendedor: null,
    eventoId: null,
    detail: null,
    ms: null,
    ...entry,
  };
  const key = todayKey();
  const all = getActivityLogsForDay(key);
  all.push(record);
  if (all.length > MAX_LOGS_PER_DAY) all.splice(0, all.length - MAX_LOGS_PER_DAY);
  try { localStorage.setItem(key, JSON.stringify(all)); } catch {}
  window.dispatchEvent(new CustomEvent('rjnet:activity', { detail: record }));
  broadcast(record);
  return record;
}

/* Persiste evento recebido de outro dispositivo. Retorna true se era novo. */
export function receiveActivityLog(record) {
  const date = (record.ts ?? new Date().toISOString()).slice(0, 10);
  const key = KEY_PREFIX + date;
  const all = getActivityLogsForDay(key);
  if (all.some((l) => l.id === record.id)) return false;
  all.push(record);
  if (all.length > MAX_LOGS_PER_DAY) all.splice(0, all.length - MAX_LOGS_PER_DAY);
  try { localStorage.setItem(key, JSON.stringify(all)); } catch {}
  return true;
}

/* MonitoringTab chama isso para ser notificado de eventos de outros dispositivos.
   Retorna função de cleanup para cancelar a inscrição. */
export function subscribeToRemoteLogs(callback) {
  _listeners.push(callback);
  return () => { _listeners = _listeners.filter((fn) => fn !== callback); };
}

export function getActivityLogs() {
  return getActivityLogsForDay(todayKey());
}

export function getActivityLogsForDay(keyOrDate) {
  const key = keyOrDate.startsWith(KEY_PREFIX) ? keyOrDate : KEY_PREFIX + keyOrDate;
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

export function getActivityDays() {
  try {
    const days = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) days.push(k.replace(KEY_PREFIX, ''));
    }
    return days.sort().reverse();
  } catch { return []; }
}

export function clearActivityDay(date) {
  const today = new Date().toISOString().slice(0, 10);
  const target = date ?? today;
  try { localStorage.removeItem(KEY_PREFIX + target); } catch {}
  if (target === today) {
    window.dispatchEvent(new CustomEvent('rjnet:activity', { detail: null }));
  }
}

export function clearActivityLogs() {
  clearActivityDay(null);
}
