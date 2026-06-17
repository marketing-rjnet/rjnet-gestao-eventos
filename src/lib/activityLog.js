const KEY_PREFIX = 'rjnet_activity_';
const MAX_LOGS_PER_DAY = 200;
const MAX_DAYS = 30;

let _pruned = false;

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
  return record;
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
