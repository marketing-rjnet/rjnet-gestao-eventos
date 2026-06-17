import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { getActivityLogs, clearActivityLogs } from '../../lib/activityLog';
import { initials } from '../../utils/format';
import { Icon } from '../../components/ui';

const TYPE_CFG = {
  lead_add:      { label: 'lead adicionado',  mark: '✓', color: 'var(--green)' },
  lead_update:   { label: 'lead atualizado',  mark: '✎', color: 'var(--rj-blue)' },
  lead_remove:   { label: 'lead removido',    mark: '✕', color: 'var(--text-3)' },
  sync_error:    { label: 'erro de sync',     mark: '✗', color: 'var(--red)' },
  perf_warn:     { label: 'req. lenta',       mark: '⚡', color: 'var(--yellow)' },
  offline_queue: { label: 'salvo offline',    mark: '◉', color: 'var(--yellow)' },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── Vendedor card ─────────────────────────────────────────────── */
function VendedorCard({ nome, leads, removes, lastTs, hasError }) {
  const ini = initials(nome);
  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${hasError ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: '14px 16px', minWidth: 160, flex: '1 1 160px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 12, flexShrink: 0, color: 'var(--rj-blue)',
        }}>{ini}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>{nome}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>há {timeAgo(lastTs)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          {leads} lead{leads !== 1 ? 's' : ''}
          {removes > 0 && <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 11, marginLeft: 4 }}>−{removes}</span>}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: hasError ? 'var(--red)' : 'var(--green)' }}>
          {hasError ? '⚠ erro' : '✓ ok'}
        </span>
      </div>
    </div>
  );
}

/* ─── Feed entry ────────────────────────────────────────────────── */
function FeedEntry({ log, eventoNome }) {
  const cfg = TYPE_CFG[log.type] || { label: log.type, mark: '·', color: 'var(--text-3)' };
  const evento = eventoNome(log.eventoId);
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
      borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${cfg.color}`,
      background: log.level === 'error' ? 'rgba(239,68,68,.04)' : 'transparent',
    }}>
      <span style={{ color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap', marginTop: 1, minWidth: 74 }}>
        {fmtTime(log.ts)}
      </span>
      <span style={{ color: cfg.color, fontWeight: 700, fontSize: 13, minWidth: 16, marginTop: 1 }}>
        {cfg.mark}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: cfg.color, fontWeight: 600, fontSize: 12 }}>{cfg.label}</span>
        {log.vendedor && (
          <span style={{ color: 'var(--text-2)', fontSize: 12 }}> · {log.vendedor}</span>
        )}
        {log.detail && (
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}> · {log.detail}{log.ms ? ` (${log.ms}ms)` : ''}</span>
        )}
        {evento && (
          <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 6 }}>[{evento}]</span>
        )}
      </div>
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────── */
export default function MonitoringTab() {
  const { eventos } = useApp();
  const [logs, setLogs] = useState(() => getActivityLogs());
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const handler = (e) => setLogs(e.detail === null ? [] : getActivityLogs());
    window.addEventListener('rjnet:activity', handler);
    return () => window.removeEventListener('rjnet:activity', handler);
  }, []);

  const eventoNome = (id) => id ? (eventos.find((e) => e.id === id)?.nome ?? id.slice(-6)) : null;

  const stats = useMemo(() => ({
    leads:   logs.filter((l) => l.type === 'lead_add').length,
    erros:   logs.filter((l) => l.level === 'error').length,
    warns:   logs.filter((l) => l.level === 'warn').length,
    offline: logs.filter((l) => l.type === 'offline_queue').length,
  }), [logs]);

  const vendedores = useMemo(() => {
    const map = {};
    for (const log of logs) {
      if (!log.vendedor) continue;
      if (!map[log.vendedor]) map[log.vendedor] = { nome: log.vendedor, leads: 0, removes: 0, lastTs: log.ts, hasError: false };
      const v = map[log.vendedor];
      if (log.type === 'lead_add') v.leads++;
      if (log.type === 'lead_remove') v.removes++;
      if (log.ts > v.lastTs) v.lastTs = log.ts;
    }
    // correlaciona sync_error com o vendedor ativo mais próximo (janela de 5s)
    const syncErrors = logs.filter((l) => l.type === 'sync_error');
    for (const err of syncErrors) {
      const errMs = new Date(err.ts).getTime();
      for (const v of Object.values(map)) {
        if (Math.abs(errMs - new Date(v.lastTs).getTime()) < 5000) v.hasError = true;
      }
    }
    return Object.values(map).sort((a, b) => b.leads - a.leads);
  }, [logs]);

  const feed = useMemo(() => {
    const reversed = [...logs].reverse();
    if (filter === 'erros') return reversed.filter((l) => l.level === 'error' || l.level === 'warn');
    if (filter === 'leads') return reversed.filter((l) => l.type.startsWith('lead_'));
    return reversed;
  }, [logs, filter]);

  const filterBtn = (id, label, count) => (
    <button
      onClick={() => setFilter(id)}
      style={{
        padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
        background: filter === id ? 'var(--rj-blue)' : 'var(--surface2)',
        color: filter === id ? '#111' : 'var(--text-2)',
        border: `1px solid ${filter === id ? 'var(--rj-blue)' : 'var(--border)'}`,
        transition: 'all .15s',
      }}
    >
      {label}{count > 0 ? ` (${count})` : ''}
    </button>
  );

  return (
    <div style={{ padding: '20px 24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="activity" size={18} /> Monitor
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 12 }}>
            Atividade em tempo real · dados desta sessão
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* stats bar */}
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--green)' }}>{stats.leads}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>leads</span>
            </span>
            <span style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: stats.erros > 0 ? 'var(--red)' : 'var(--text-3)' }}>{stats.erros}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>erros</span>
            </span>
            {stats.offline > 0 && (
              <span style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--yellow)' }}>{stats.offline}</span>
                <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>offline</span>
              </span>
            )}
          </div>
          {logs.length > 0 && (
            <button
              onClick={clearActivityLogs}
              style={{
                fontSize: 12, color: 'var(--text-3)', padding: '5px 10px',
                borderRadius: 6, background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Vendedor cards */}
      {vendedores.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Vendedores ativos esta sessão
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {vendedores.map((v) => <VendedorCard key={v.nome} {...v} />)}
          </div>
        </div>
      )}

      {/* Feed */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Atividade
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {filterBtn('all', 'Todos', logs.length)}
            {filterBtn('erros', 'Erros', stats.erros + stats.warns)}
            {filterBtn('leads', 'Leads', stats.leads)}
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--surface)' }}>
          {feed.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
              {logs.length === 0
                ? 'Nenhuma atividade registrada ainda. Ações dos vendedores aparecerão aqui em tempo real.'
                : 'Nenhum resultado para este filtro.'}
            </div>
          ) : (
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {feed.map((log) => <FeedEntry key={log.id} log={log} eventoNome={eventoNome} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
