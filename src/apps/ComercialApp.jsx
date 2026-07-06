import React, { useState } from 'react';
import { Icon } from '../components/ui';
import SyncBadge from '../components/SyncBadge';
import { Dashboard, EventosTab, EventDetail } from '../features/events';
import { OfertasTab } from '../features/offers';
import { LeadsTab } from '../features/leads';

// D-059: shell do perfil comercial — mesmo nível de acesso do marketing em
// eventos/ofertas/relatórios, sem estoque, sem gestão de equipe e sem monitor.
const TABS = [
  { id: "inicio",  label: "Início",     ico: "home" },
  { id: "eventos", label: "Eventos",    ico: "calendar" },
  { id: "ofertas", label: "Ofertas",    ico: "box" },
  { id: "leads",   label: "Relatórios", ico: "users" },
];

export default function ComercialApp({ session, onLogout, darkMode, toggleDark }) {
  const [tab, setTab] = useState("inicio");
  const [detailId, setDetailId] = useState(null);

  const switchTab = (id) => { setTab(id); setDetailId(null); };

  // D-060: card "Evento Ativo" do Início navega direto para o detalhe do
  // evento, sem passar pela lista. O card "Mês/Dia a dia" fica embutido no
  // próprio Dashboard (ver Dashboard.jsx) — não passa por aqui.
  const abrirEvento = (eventoId) => { setDetailId(eventoId); setTab("eventos"); };

  return (
    <div>
      <header className="app-header">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"36px"}} />
        <nav className="header-nav">
          {TABS.map((t) => (
            <button key={t.id} className={"nav-tab" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
              <Icon name={t.ico} size={17} />{t.label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <SyncBadge />
          <button className="theme-toggle" onClick={toggleDark} title="Alternar tema" aria-label="Alternar tema"><Icon name={darkMode ? "sun" : "moon"} size={17} /></button>
          <span className="user-badge"><span className="dot"></span><span className="ub-name">Comercial</span></span>
        </div>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={onLogout}>Sair</button>
      </header>

      {tab === "inicio" && <Dashboard onOpenEvento={abrirEvento} />}
      {tab === "eventos" && (detailId
        ? <EventDetail eventoId={detailId} onBack={() => setDetailId(null)} />
        : <EventosTab onOpen={setDetailId} />)}
      {tab === "ofertas" && <OfertasTab />}
      {tab === "leads" && <LeadsTab session={session} />}

      {/* Bottom nav — mobile only (4 itens cabem sem sheet "Mais") */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {TABS.map((t) => (
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
