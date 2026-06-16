import { useApp } from '../hooks/useApp';
import { SYNC_STATUS } from '../lib/constants';
import { supabaseEnabled } from '../lib/supabase';

export default function SyncBadge() {
  const { syncStatus } = useApp();
  if (!supabaseEnabled || syncStatus === SYNC_STATUS.IDLE) return null;
  const styles = {
    [SYNC_STATUS.SYNCING]: { color: "var(--text-3)", fontSize: 11 },
    [SYNC_STATUS.ERROR]:   { color: "var(--red, #ef4444)", fontSize: 11, fontWeight: 600 },
  };
  const labels = { [SYNC_STATUS.SYNCING]: "sincronizando…", [SYNC_STATUS.ERROR]: "⚠ erro ao sincronizar" };
  return <span style={styles[syncStatus]}>{labels[syncStatus]}</span>;
}
