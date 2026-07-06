import React, { useState } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { Icon } from '../components/ui';
import SyncBadge from '../components/SyncBadge';
import { Dashboard, EventosTab, EventDetail } from '../features/events';
import { EstoqueTab } from '../features/inventory';
import { OfertasTab } from '../features/offers';
import { LeadsTab, MesDetail } from '../features/leads';
import { CheckinTab } from '../features/checkin';
import { EquipeTab, EquipeAuthTab } from '../features/team';
import { MonitoringTab } from '../features/monitoring';

const MAIN_TABS = [
  { id: "inicio",  label: "Início",   ico: "home" },
  { id: "eventos", label: "Eventos",  ico: "calendar" },
  { id: "equipe",  label: "Equipe",   ico: "briefcase" },
  { id: "checkin", label: "Check-in", ico: "search" },
];

const MORE_TABS = [
  { id: "estoque", label: "Estoque",    ico: "box" },
  { id: "ofertas", label: "Ofertas",    ico: "box" },
  { id: "leads",   label: "Relatórios", ico: "users" },
  { id: "monitor", label: "Monitor",    ico: "activity" },
];

const ALL_TABS = [
  ...MAIN_TABS,
  { id: "estoque", label: "Estoque",    ico: "box" },
  { id: "ofertas", label: "Ofertas",    ico: "box" },
  { id: "leads",   label: "Relatórios", ico: "users" },
  { id: "equipe",  label: "Equipe",     ico: "briefcase" },
  { id: "checkin", label: "Check-in",   ico: "search" },
  { id: "monitor", label: "Monitor",    ico: "activity" },
];

export default function MarketingApp({ session, onLogout, darkMode, toggleDark }) {
  const [tab, setTab] = useState("inicio");
  const [detailId, setDetailId] = useState(null);
  const [mesDetalhe, setMesDetalhe] = useState(null);
  const [showMore, setShowMore] = useState(false);

  const allDesktopTabs = [
    { id: "inicio",  label: "Início",    ico: "home" },
    { id: "eventos", label: "Eventos",   ico: "calendar" },
    { id: "estoque", label: "Estoque",   ico: "box" },
    { id: "ofertas", label: "Ofertas",   ico: "box" },
    { id: "leads",   label: "Relatórios",ico: "users" },
    { id: "equipe",  label: "Equipe",    ico: "briefcase" },
    { id: "checkin", label: "Check-in",  ico: "search" },
    { id: "monitor", label: "Monitor",   ico: "activity" },
  ];

  const switchTab = (id) => { setTab(id); setDetailId(null); setMesDetalhe(null); setShowMore(false); };

  // D-060: cards do Início (Dashboard) navegam direto para o detalhe do
  // evento ativo ou do mês corrente, sem passar pela lista.
  const abrirEvento = (eventoId) => { setDetailId(eventoId); setMesDetalhe(null); setTab("eventos"); setShowMore(false); };
  const abrirMes = (mesRef) => { setMesDetalhe(mesRef); setDetailId(null); setTab("leads"); setShowMore(false); };

  const moreActive = MORE_TABS.some((t) => t.id === tab);

  return (
    <div>
      <header className="app-header">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"36px"}} />
        <nav className="header-nav">
          {allDesktopTabs.map((t) => (
            <button key={t.id} className={"nav-tab" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
              <Icon name={t.ico} size={17} />{t.label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <SyncBadge />
          <button className="theme-toggle" onClick={toggleDark} title="Alternar tema" aria-label="Alternar tema"><Icon name={darkMode ? "sun" : "moon"} size={17} /></button>
          <span className="user-badge"><span className="dot"></span><span className="ub-name">Marketing</span></span>
        </div>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={onLogout}>Sair</button>
      </header>

      {tab === "inicio" && <Dashboard onOpenEvento={abrirEvento} onOpenMes={abrirMes} />}
      {tab === "eventos" && (detailId
        ? <EventDetail eventoId={detailId} onBack={() => setDetailId(null)} />
        : <EventosTab onOpen={setDetailId} />)}
      {tab === "estoque" && <EstoqueTab />}
      {tab === "ofertas" && <OfertasTab />}
      {tab === "leads" && (mesDetalhe
        ? <MesDetail mesReferencia={mesDetalhe} onBack={() => setMesDetalhe(null)} />
        : <LeadsTab session={session} />)}
      {tab === "equipe" && (isSupabaseMode() ? <EquipeAuthTab /> : <EquipeTab />)}
      {tab === "checkin" && <CheckinTab />}
      {tab === "monitor" && <MonitoringTab />}

      {/* Bottom nav — mobile only (5 items + Mais) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {MAIN_TABS.map((t) => (
            <button key={t.id} className={"bn-tab" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
              <span className="bn-ico"><Icon name={t.ico} size={22} /></span>
              {t.label}
            </button>
          ))}
          <button className={"bn-tab" + (moreActive || showMore ? " active" : "")} onClick={() => setShowMore((v) => !v)}>
            <span className="bn-ico"><Icon name="menu" size={22} /></span>
            Mais
          </button>
        </div>
      </nav>

      {/* Bottom sheet "Mais" */}
      {showMore && (
        <>
          <div className="more-overlay" onClick={() => setShowMore(false)} />
          <div className="more-sheet">
            <div className="more-sheet-handle" />
            <div className="more-sheet-title">Mais opções</div>
            {MORE_TABS.map((t) => (
              <button key={t.id} className={"more-sheet-item" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
                <Icon name={t.ico} size={20} stroke={tab === t.id ? "var(--yellow)" : "var(--text-2)"} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
