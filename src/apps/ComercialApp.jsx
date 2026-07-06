import React, { useState } from 'react';
import { Icon } from '../components/ui';
import SyncBadge from '../components/SyncBadge';
import { Dashboard, EventosTab, EventDetail } from '../features/events';
import { OfertasTab } from '../features/offers';
import { LeadsTab, MesDetail } from '../features/leads';

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
  const [mesDetalhe, setMesDetalhe] = useState(null);

  const switchTab = (id) => { setTab(id); setDetailId(null); setMesDetalhe(null); };

  // D-060: cards do Início (Dashboard) navegam direto para o detalhe do
  // evento ativo ou do mês corrente, sem passar pela lista.
  const abrirEvento = (eventoId) => { setDetailId(eventoId); setMesDetalhe(null); setTab("eventos"); };
  const abrirMes = (mesRef) => { setMesDetalhe(mesRef); setDetailId(null); setTab("leads"); };

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

      {tab === "inicio" && <Dashboard onOpenEvento={abrirEvento} onOpenMes={abrirMes} />}
      {tab === "eventos" && (detailId
        ? <EventDetail eventoId={detailId} onBack={() => setDetailId(null)} />
        : <EventosTab onOpen={setDetailId} />)}
      {tab === "ofertas" && <OfertasTab />}
      {tab === "leads" && (mesDetalhe
        ? <MesDetail mesReferencia={mesDetalhe} onBack={() => setMesDetalhe(null)} />
        : <LeadsTab session={session} />)}

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
