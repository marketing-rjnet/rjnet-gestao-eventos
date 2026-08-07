import React, { useState } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { Icon } from '../components/ui';
import SyncBadge from '../components/SyncBadge';
import { Dashboard, EventosTab, EventDetail } from '../features/events';
import { EstoqueTab } from '../features/inventory';
import { OfertasTab } from '../features/offers';
import { LeadsTab } from '../features/leads';
import { CheckinTab } from '../features/checkin';
import { EquipeTab, EquipeAuthTab } from '../features/team';
import { MonitoringTab } from '../features/monitoring';
import { FormBuilderTab } from '../features/formularios';
import { SimuladorTab } from '../features/simulador';
import { DesafioTab } from '../features/desafio';

// D-065: 3 botões diretos (uso diário) + 1 botão "Mais" com o restante
// agrupado por categoria — mesma estrutura no header desktop e no bottom
// sheet mobile, pra não ter dois modelos mentais de navegação.
const DIRECT_TABS = [
  { id: "inicio",  label: "Início",     ico: "home" },
  { id: "eventos", label: "Eventos",    ico: "calendar" },
  { id: "leads",   label: "Relatórios", ico: "users" },
];

const MORE_GROUPS = [
  { title: "Captação",  items: [{ id: "formularios", label: "Formulários", ico: "edit" }, { id: "simulador", label: "Simulador", ico: "chart" }] },
  { title: "Comercial", items: [{ id: "ofertas", label: "Ofertas", ico: "box" }] },
  { title: "Ativação",  items: [{ id: "desafio", label: "Desafio", ico: "target" }] },
  { title: "Operação",  items: [{ id: "estoque", label: "Estoque", ico: "box" }, { id: "checkin", label: "Check-in", ico: "search" }] },
  { title: "Sistema",   items: [{ id: "equipe", label: "Equipe", ico: "briefcase" }, { id: "monitor", label: "Monitor", ico: "activity" }] },
];

const MORE_TABS = MORE_GROUPS.flatMap((g) => g.items);

export default function MarketingApp({ session, onLogout, darkMode, toggleDark }) {
  const [tab, setTab] = useState("inicio");
  const [detailId, setDetailId] = useState(null);
  const [showMore, setShowMore] = useState(false);

  const switchTab = (id) => { setTab(id); setDetailId(null); setShowMore(false); };

  // D-060: card "Evento Ativo" do Início navega direto para o detalhe do
  // evento, sem passar pela lista. O card "Mês/Dia a dia" fica embutido no
  // próprio Dashboard (ver Dashboard.jsx) — não passa por aqui.
  const abrirEvento = (eventoId) => { setDetailId(eventoId); setTab("eventos"); setShowMore(false); };

  const moreActive = MORE_TABS.some((t) => t.id === tab);

  return (
    <div>
      <header className="app-header">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"36px"}} />
        <nav className="header-nav">
          {DIRECT_TABS.map((t) => (
            <button key={t.id} className={"nav-tab" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
              <Icon name={t.ico} size={17} />{t.label}
            </button>
          ))}
          <div className="nav-more-wrap">
            <button className={"nav-tab" + (moreActive || showMore ? " active" : "")} onClick={() => setShowMore((v) => !v)}>
              <Icon name="menu" size={17} />Mais
            </button>
            {showMore && (
              <>
                <div className="nav-more-scrim" onClick={() => setShowMore(false)} />
                <div className="nav-more-dropdown">
                  {MORE_GROUPS.map((g) => (
                    <div className="nav-more-group" key={g.title}>
                      <div className="nav-more-group-title">{g.title}</div>
                      {g.items.map((t) => (
                        <button key={t.id} className={"nav-more-item" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
                          <Icon name={t.ico} size={17} />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </nav>
        <div className="header-right">
          <SyncBadge />
          <button className="theme-toggle" onClick={toggleDark} title="Alternar tema" aria-label="Alternar tema"><Icon name={darkMode ? "sun" : "moon"} size={17} /></button>
          <span className="user-badge"><span className="dot"></span><span className="ub-name">Marketing</span></span>
        </div>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={onLogout}>Sair</button>
      </header>

      {tab === "inicio" && <Dashboard onOpenEvento={abrirEvento} />}
      {tab === "eventos" && (detailId
        ? <EventDetail eventoId={detailId} onBack={() => setDetailId(null)} />
        : <EventosTab onOpen={setDetailId} />)}
      {tab === "estoque" && <EstoqueTab />}
      {tab === "ofertas" && <OfertasTab />}
      {tab === "formularios" && <FormBuilderTab />}
      {tab === "simulador" && <SimuladorTab session={session} />}
      {tab === "desafio" && <DesafioTab />}
      {tab === "leads" && <LeadsTab session={session} />}
      {tab === "equipe" && (isSupabaseMode() ? <EquipeAuthTab /> : <EquipeTab />)}
      {tab === "checkin" && <CheckinTab />}
      {tab === "monitor" && <MonitoringTab />}

      {/* Bottom nav — mobile only (3 diretos + Mais) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {DIRECT_TABS.map((t) => (
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

      {/* Bottom sheet "Mais" — mesmo agrupamento do dropdown desktop */}
      {showMore && (
        <>
          <div className="more-overlay" onClick={() => setShowMore(false)} />
          <div className="more-sheet">
            <div className="more-sheet-handle" />
            {MORE_GROUPS.map((g) => (
              <div key={g.title} style={{ marginBottom: 14 }}>
                <div className="more-sheet-title">{g.title}</div>
                {g.items.map((t) => (
                  <button key={t.id} className={"more-sheet-item" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
                    <Icon name={t.ico} size={20} stroke={tab === t.id ? "var(--yellow)" : "var(--text-2)"} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
