import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import { Chart, registerables } from 'chart.js';
import { supabaseEnabled } from './lib/supabase';
import { fetchAll, db, subscribeChanges, auth, rankingEvento, invalidarRanking } from './lib/dataService';
import { sanitizeText } from './lib/security';
import { META_DIARIA, SENHA_MIN_LENGTH, MAX_NOME, MAX_ENDERECO, MAX_OBSERVACAO, TOAST_DURATION_MS } from './lib/constants';
import './index.css';
import { AppProvider } from './context';
import Root from './apps/Root';
import FormularioPublico from './public/FormularioPublico';
import SimuladorPublico from './public/SimuladorPublico';

Chart.register(...registerables);

Chart.defaults.color = "#666";
Chart.defaults.font.family = "DM Sans, sans-serif";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, message: "" }; }
  static getDerivedStateFromError(error) { return { hasError: true, message: error?.message || "Erro desconhecido." }; }
  componentDidCatch(error, info) { console.error("[rjnet] Erro não tratado:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red, #ef4444)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="var(--red, #ef4444)"/></svg>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Algo deu errado</div>
          <div style={{ color: "var(--text-3, #666)", fontSize: 14, maxWidth: 320 }}>{this.state.message}</div>
          <button className="btn-primary" onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Form Builder: página pública de captura (sem login, sem AppProvider). O
// app não usa biblioteca de rotas — isso é só um desvio mínimo antes do
// fluxo autenticado normal, checado uma única vez no boot. (D-065: a rota
// /qr/:id do gerador de QR Code standalone foi retirada — todo QR Code
// agora nasce de um formulário do Form Builder, em /f/:slug.)
const formMatch = window.location.pathname.match(/^\/f\/([^/]+)\/?$/);
// Simulador de Perfil de Consumo: mesma exceção mínima, em /s/:slug —
// página pública do quiz gamificado (campanhas de tráfego pago + QR).
const simMatch = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    {formMatch ? (
      <FormularioPublico slug={decodeURIComponent(formMatch[1])} />
    ) : simMatch ? (
      <SimuladorPublico slug={decodeURIComponent(simMatch[1])} />
    ) : (
      <AppProvider><Root /></AppProvider>
    )}
  </ErrorBoundary>
);
