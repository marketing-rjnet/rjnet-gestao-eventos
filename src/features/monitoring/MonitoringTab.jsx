import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { getActivityLogs, clearActivityLogs } from '../../lib/activityLog';
import { initials } from '../../utils/format';
import { Icon } from '../../components/ui';

/* ─── Configuração visual por tipo ─────────────────────────────── */
const TYPE_CFG = {
  lead_add:      { label: 'lead adicionado',   mark: '✓',  color: 'var(--green)' },
  lead_update:   { label: 'lead atualizado',   mark: '✎',  color: 'var(--rj-blue)' },
  lead_remove:   { label: 'lead removido',     mark: '✕',  color: 'var(--text-3)' },
  lead_sync_ok:  { label: 'sync confirmado',   mark: '⊙',  color: '#16a34a' },
  sync_error:    { label: 'erro de sync',      mark: '✗',  color: 'var(--red)' },
  perf_warn:     { label: 'req. lenta',        mark: '⚡', color: 'var(--yellow)' },
  offline_queue: { label: 'salvo offline',     mark: '◉',  color: 'var(--yellow)' },
};

/* ─── Descrições em linguagem de campo ──────────────────────────── */
const PERF_DESC = {
  fetchAll:          'app demorou para carregar — vendedor aguardou na tela de abertura',
  fetchLeadsEvento:  'lista de leads demorou — vendedor aguardou para ver seus registros',
  fetchLeadsEventos: 'exportação de leads lenta — download levou mais que o esperado',
  rankingEvento:     'placar demorou a atualizar — posição do vendedor pode estar desatualizada',
};

const TYPE_DESC = {
  lead_add:      'registrado no app · aguardando confirmação do servidor',
  lead_update:   'alteração salva no app · aguardando confirmação do servidor',
  lead_remove:   'removido da lista · aguardando confirmação do servidor',
  lead_sync_ok:  'confirmado no servidor — dado salvo com segurança',
  sync_error:    'falha ao salvar no servidor — vendedor pode estar com dado não sincronizado',
  offline_queue: 'sem internet · lead salvo localmente e será enviado ao reconectar',
};

function getDesc(log) {
  if (log.type === 'perf_warn') {
    const key = (log.detail || '').split('(')[0].trim();
    return PERF_DESC[key] || `operação ${log.detail} demorou mais que o esperado`;
  }
  return TYPE_DESC[log.type] || null;
}

/* ─── Utilitários ───────────────────────────────────────────────── */
function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── Card por vendedor ─────────────────────────────────────────── */
function VendedorCard({ nome, sessionLeads, totalLeads, removes, lastTs, hasError }) {
  const ini = initials(nome);
  const mostrarTotal = totalLeads > sessionLeads;
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
      <div style={{ fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>
          {mostrarTotal ? totalLeads : sessionLeads} lead{(mostrarTotal ? totalLeads : sessionLeads) !== 1 ? 's' : ''}
        </span>
        {mostrarTotal && (
          <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 11, marginLeft: 5 }}>
            ({sessionLeads} esta sessão)
          </span>
        )}
        {removes > 0 && (
          <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 4 }}>· {removes} removido{removes !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: hasError ? 'var(--red)' : 'var(--green)' }}>
        {hasError ? '⚠ verificar sincronização' : '✓ sincronização ok'}
      </div>
    </div>
  );
}

/* ─── Entrada do feed ───────────────────────────────────────────── */
function FeedEntry({ log, eventoNome }) {
  const cfg = TYPE_CFG[log.type] || { label: log.type, mark: '·', color: 'var(--text-3)' };
  const desc = getDesc(log);
  const evento = eventoNome(log.eventoId);
  const isSyncOk = log.type === 'lead_sync_ok';
  return (
    <div style={{
      padding: '9px 12px',
      borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${cfg.color}`,
      background: log.level === 'error'
        ? 'rgba(239,68,68,.04)'
        : isSyncOk
          ? 'rgba(22,163,74,.03)'
          : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap', marginTop: 1, minWidth: 74 }}>
          {fmtTime(log.ts)}
        </span>
        <span style={{ color: cfg.color, fontWeight: 700, fontSize: 13, minWidth: 16, marginTop: 1 }}>
          {cfg.mark}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div>
            <span style={{ color: cfg.color, fontWeight: 600, fontSize: 12 }}>{cfg.label}</span>
            {log.vendedor && (
              <span style={{ color: 'var(--text-2)', fontSize: 12 }}> · {log.vendedor}</span>
            )}
            {log.detail && (
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                {' · '}{log.detail}{log.ms ? ` (${log.ms}ms)` : ''}
              </span>
            )}
            {evento && (
              <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 6 }}>[{evento}]</span>
            )}
          </div>
          {desc && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, paddingLeft: 2, lineHeight: 1.4 }}>
              ↳ {desc}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab principal ─────────────────────────────────────────────── */
export default function MonitoringTab() {
  const { eventos, leads } = useApp();
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
    syncs:   logs.filter((l) => l.type === 'sync_error').length,
    perf:    logs.filter((l) => l.type === 'perf_warn').length,
    offline: logs.filter((l) => l.type === 'offline_queue').length,
  }), [logs]);

  /* cards por vendedor — cruza sessão com leads carregados no contexto */
  const vendedores = useMemo(() => {
    const map = {};
    for (const log of logs) {
      if (!log.vendedor) continue;
      if (!map[log.vendedor]) map[log.vendedor] = { nome: log.vendedor, sessionLeads: 0, removes: 0, lastTs: log.ts, hasError: false };
      const v = map[log.vendedor];
      if (log.type === 'lead_add') v.sessionLeads++;
      if (log.type === 'lead_remove') v.removes++;
      if (log.ts > v.lastTs) v.lastTs = log.ts;
    }
    // correlaciona sync_error com vendedor ativo mais próximo (janela 5s)
    const syncErrors = logs.filter((l) => l.type === 'sync_error');
    for (const err of syncErrors) {
      const errMs = new Date(err.ts).getTime();
      for (const v of Object.values(map)) {
        if (Math.abs(errMs - new Date(v.lastTs).getTime()) < 5000) v.hasError = true;
      }
    }
    // total real do contexto (leads já carregados em memória)
    return Object.values(map)
      .map((v) => ({
        ...v,
        totalLeads: leads.filter((l) => l.vendedorNome === v.nome).length,
      }))
      .sort((a, b) => b.sessionLeads - a.sessionLeads);
  }, [logs, leads]);

  const feed = useMemo(() => {
    const reversed = [...logs].reverse();
    if (filter === 'leads') return reversed.filter((l) => l.type.startsWith('lead_'));
    if (filter === 'sync')  return reversed.filter((l) => l.type === 'sync_error');
    if (filter === 'perf')  return reversed.filter((l) => l.type === 'perf_warn' || l.type === 'offline_queue');
    return reversed;
  }, [logs, filter]);

  const filterBtn = (id, label, count, accent) => (
    <button
      onClick={() => setFilter(id)}
      style={{
        padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
        background: filter === id ? (accent || 'var(--rj-blue)') : 'var(--surface2)',
        color: filter === id ? '#111' : count > 0 && accent ? accent : 'var(--text-2)',
        border: `1px solid ${filter === id ? (accent || 'var(--rj-blue)') : 'var(--border)'}`,
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
          <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Atividade em tempo real · dados desta sessão</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--green)' }}>{stats.leads}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>leads</span>
            </span>
            <span style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: stats.syncs > 0 ? 'var(--red)' : 'var(--text-3)' }}>{stats.syncs}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>sync</span>
            </span>
            <span style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: stats.perf > 0 ? 'var(--yellow)' : 'var(--text-3)' }}>{stats.perf}</span>
              <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>perf</span>
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
              style={{ fontSize: 12, color: 'var(--text-3)', padding: '5px 10px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)' }}
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
            {filterBtn('all',   'Todos',  logs.length)}
            {filterBtn('leads', 'Leads',  stats.leads)}
            {filterBtn('sync',  'Sync',   stats.syncs,   stats.syncs > 0 ? 'var(--red)' : undefined)}
            {filterBtn('perf',  'Perf',   stats.perf,    stats.perf  > 0 ? 'var(--yellow)' : undefined)}
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
