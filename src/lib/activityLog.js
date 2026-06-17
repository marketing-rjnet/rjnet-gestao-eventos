const STORAGE_KEY = 'rjnet_activity_log';
const MAX_LOGS = 200;

export function logActivity(entry) {
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
  const all = getActivityLogs();
  all.push(record);
  if (all.length > MAX_LOGS) all.splice(0, all.length - MAX_LOGS);
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
  window.dispatchEvent(new CustomEvent('rjnet:activity', { detail: record }));
  return record;
}

export function getActivityLogs() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

export function clearActivityLogs() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('rjnet:activity', { detail: null }));
}
