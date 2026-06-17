import React, { useState } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { Icon } from '../components/ui';
import SyncBadge from '../components/SyncBadge';
import { Dashboard, EventosTab, EventDetail } from '../features/events';
import { EstoqueTab } from '../features/inventory';
import { LeadsTab } from '../features/leads';
import { CheckinTab } from '../features/checkin';
import { EquipeTab, EquipeAuthTab } from '../features/team';
import { MonitoringTab } from '../features/monitoring';

export default function MarketingApp({ session, onLogout, darkMode, toggleDark }) {
  const [tab, setTab] = useState("eventos");
  const [detailId, setDetailId] = useState(null);

  const tabs = [
    { id: "eventos", label: "Eventos", ico: "calendar" },
    { id: "estoque", label: "Estoque", ico: "box" },
    { id: "leads", label: "Leads", ico: "users" },
    { id: "equipe", label: "Equipe", ico: "briefcase" },
    { id: "checkin", label: "Check-in", ico: "search" },
    { id: "monitor", label: "Monitor", ico: "activity" },
  ];

  const switchTab = (id) => { setTab(id); setDetailId(null); };

  return (
    <div>
      <header className="app-header">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"36px"}} />
        <nav className="header-nav">
          {tabs.map((t) => (
            <button key={t.id} className={"nav-tab" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
              <Icon name={t.ico} size={17} />{t.label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <SyncBadge />
          <button className="theme-toggle" onClick={toggleDark} title="Alternar tema"><Icon name={darkMode ? "sun" : "moon"} size={17} /></button>
          <span className="user-badge"><span className="dot"></span><span className="ub-name">Marketing</span></span>
        </div>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={onLogout}>Sair</button>
      </header>

      {tab === "eventos" && (detailId
        ? <EventDetail eventoId={detailId} onBack={() => setDetailId(null)} />
        : <EventosTab onOpen={setDetailId} />)}
      {tab === "estoque" && <EstoqueTab />}
      {tab === "leads" && <LeadsTab session={session} />}
      {tab === "equipe" && (isSupabaseMode() ? <EquipeAuthTab /> : <EquipeTab />)}
      {tab === "checkin" && <CheckinTab />}
      {tab === "monitor" && <MonitoringTab />}

      {/* Bottom nav — mobile only */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {tabs.map((t) => (
            <button key={t.id} className={"bn-tab" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
              <span className="bn-ico"><Icon name={t.ico} size={22} /></span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
