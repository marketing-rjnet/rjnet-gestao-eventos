import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { Kpi, StatusBadge, Icon } from '../../components/ui';
import { MesDetail } from '../leads';
import { fmtDate, mesAtualRef, mesReferenciaLabel } from '../../utils/format';
import { STATUS_EVENTO, UPCOMING_EVENTS_LIMIT } from '../../lib/constants';

const SERVICO_LABELS = {
  internet_residencial: "Internet Residencial",
  rjnet_movel: "Móvel",
  internet_empresarial: "Empresarial",
  streamings: "Streamings",
  outro: "Outro",
};

const BAR_COLORS = ["#ffcb00", "#22c55e", "#60a5fa", "#fb923c", "#666666"];

export default function Dashboard({ onOpenEvento }) {
  const { eventos, leads, vendedores, getMateriaisDisponiveis, obterRanking, obterRankingMes } = useApp();

  // D-060: mês fica embutido no próprio Início (sem navegar para Relatórios) —
  // diferente do card de Evento, que ainda abre EventDetail na aba Eventos.
  const [mesAberto, setMesAberto] = useState(null);

  const eventoAtivo = eventos.find((e) => e.status === STATUS_EVENTO.ATIVO);
  const qtdAtivos = eventos.filter((e) => e.status === STATUS_EVENTO.ATIVO).length;
  const criticos = getMateriaisDisponiveis().filter((m) => m.disponivel <= 0).length;
  const vendAtivos = vendedores.filter((v) => v.ativo).length;

  const mesAtual = mesAtualRef();

  // D-060: placar via RPC (ranking_evento/ranking_mes), não via `leads` local —
  // esse array só tem o contexto (evento/mês) carregado por último em outra
  // tela (D-039), então ficaria zerado na maioria das visitas ao Início.
  const [rankingEventoAtivo, setRankingEventoAtivo] = useState([]);
  const [rankingMesAtual, setRankingMesAtual] = useState([]);

  useEffect(() => {
    let ativo = true;
    if (eventoAtivo) obterRanking(eventoAtivo.id).then((r) => { if (ativo) setRankingEventoAtivo(r || []); });
    else setRankingEventoAtivo([]);
    return () => { ativo = false; };
  }, [eventoAtivo?.id]);

  useEffect(() => {
    let ativo = true;
    obterRankingMes(mesAtual).then((r) => { if (ativo) setRankingMesAtual(r || []); });
    return () => { ativo = false; };
  }, [mesAtual]);

  const leadsEventoAtivo = rankingEventoAtivo.reduce((acc, r) => acc + Number(r.total || 0), 0);
  const vendedoresEventoAtivo = rankingEventoAtivo.length;
  const leadsMesAtual = rankingMesAtual.reduce((acc, r) => acc + Number(r.total || 0), 0);
  const vendedoresMesAtual = rankingMesAtual.length;

  const dist = useMemo(() => {
    const c = {};
    leads.forEach((l) => {
      const servicos = Array.isArray(l.servicoInteresse) ? l.servicoInteresse : (l.servicoInteresse ? [l.servicoInteresse] : []);
      servicos.forEach((s) => { c[s] = (c[s] || 0) + 1; });
    });
    return c;
  }, [leads]);

  const totalDist = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const barItems = Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .map(([key, val], i) => ({ key, label: SERVICO_LABELS[key] || key, val, pct: Math.round((val / totalDist) * 100), color: BAR_COLORS[i % BAR_COLORS.length] }));

  const upcoming = [...eventos].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)).slice(0, UPCOMING_EVENTS_LIMIT);

  if (mesAberto) {
    return <MesDetail mesReferencia={mesAberto} onBack={() => setMesAberto(null)} />;
  }

  return (
    <div className="section">
      {/* Hero cards — Evento Ativo e Mês/Dia a dia (D-060), clicáveis para o detalhe de cada contexto */}
      <div className="grid-2">
        {eventoAtivo ? (
          <div
            className={"hero-card" + (onOpenEvento ? " hero-card-clickable" : "")}
            onClick={() => onOpenEvento?.(eventoAtivo.id)}
          >
            <div className="hero-label">EVENTO ATIVO</div>
            <div className="hero-title">{eventoAtivo.nome}</div>
            <div className="hero-meta">
              <Icon name="pin" size={13} stroke="var(--text-3)" />
              {eventoAtivo.local} · {fmtDate(eventoAtivo.dataInicio)} – {fmtDate(eventoAtivo.dataFim)}
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-num">{leadsEventoAtivo}</span>
                <span className="hero-stat-label">leads</span>
              </div>
              <div className="hero-stat-div" />
              <div className="hero-stat">
                <span className="hero-stat-num">{vendedoresEventoAtivo}</span>
                <span className="hero-stat-label">vendedores</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="hero-card hero-card-empty">
            <div className="hero-label">EVENTO ATIVO</div>
            <div style={{ color: "var(--text-3)", fontSize: 14, marginTop: 4 }}>Nenhum evento ativo no momento.</div>
          </div>
        )}

        <div
          className="hero-card hero-card-mes hero-card-clickable"
          onClick={() => setMesAberto(mesAtual)}
        >
          <div className="hero-label">MÊS / DIA A DIA</div>
          <div className="hero-title">{mesReferenciaLabel(mesAtual)}</div>
          <div className="hero-meta">
            <Icon name="calendar" size={13} stroke="var(--text-3)" />
            Leads capturados fora de eventos
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-num">{leadsMesAtual}</span>
              <span className="hero-stat-label">leads</span>
            </div>
            <div className="hero-stat-div" />
            <div className="hero-stat">
              <span className="hero-stat-num">{vendedoresMesAtual}</span>
              <span className="hero-stat-label">vendedores</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-kpi" style={{ marginTop: 16 }}>
        <Kpi label="Eventos Ativos" value={qtdAtivos} icon="calendar" />
        <Kpi label="Total Leads" value={leads.length} icon="users" />
        <Kpi label="Materiais Críticos" value={criticos} icon="box" alert={criticos > 0} />
        <Kpi label="Vendedores Ativos" value={vendAtivos} icon="briefcase" />
      </div>

      <div className="grid-2 dashboard-row" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title">Leads por Serviço</div>
          {leads.length === 0 ? (
            <div className="empty">Nenhum lead registrado.</div>
          ) : (
            <div className="service-bars">
              {barItems.map((item) => (
                <div key={item.key} className="service-bar-row">
                  <div className="service-bar-label">{item.label}</div>
                  <div className="service-bar-track">
                    <div className="service-bar-fill" style={{ width: item.pct + "%", background: item.color }} />
                  </div>
                  <div className="service-bar-num">{item.val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="section-title">Próximos Eventos</div>
          {upcoming.length === 0 ? <div className="empty">Sem eventos.</div> : upcoming.map((e) => (
            <div key={e.id} className="ev-meta" style={{ justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{e.nome}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", display:"flex", alignItems:"center", gap:4 }}><Icon name="calendar" size={12} stroke="var(--text-3)" />{fmtDate(e.dataInicio)} – {fmtDate(e.dataFim)}</div>
              </div>
              <StatusBadge s={e.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
