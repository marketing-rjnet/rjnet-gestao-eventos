import React from 'react';
import { opcoesFiltroCampanha } from '../../lib/aquisicao';
import { periodoPadrao } from '../../hooks/useAquisicaoMetricas';

const TEMPERATURAS = ['frio', 'morno', 'quente', 'convertido'];
const PERIODOS = [
  { dias: 7, label: 'Últimos 7 dias' },
  { dias: 30, label: 'Últimos 30 dias' },
  { dias: 90, label: 'Últimos 90 dias' },
  { dias: 365, label: 'Últimos 12 meses' },
];

// D-104: filtros do dashboard — todos alimentados por dados reais (LPs
// cadastradas, campanhas/source/medium que apareceram nas sessões,
// vendedores ativos). `porCampanha` vem das próprias métricas carregadas.
export function AquisicaoFiltros({ filtros, setFiltros, landingPages, vendedores, porCampanha, mostrarLp = true }) {
  const set = (patch) => setFiltros((f) => ({ ...f, ...patch }));
  const { sources, mediums, campanhas } = opcoesFiltroCampanha(porCampanha);
  const vendedoresAtivos = (vendedores || []).filter((v) => (v.papel === 'vendedor' || !v.papel) && v.ativo);
  const diasAtual = filtros.dias || 30;

  return (
    <div className="aq-filtros" data-testid="aq-filtros">
      <div>
        <label>Período</label>
        <select value={diasAtual} onChange={(e) => { const dias = Number(e.target.value); set({ dias, ...periodoPadrao(dias) }); }}>
          {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.label}</option>)}
        </select>
      </div>
      {mostrarLp && (
        <div>
          <label>Landing Page</label>
          <select value={filtros.landingPageId || ''} onChange={(e) => set({ landingPageId: e.target.value || null })}>
            <option value="">Todas</option>
            {landingPages.map((lp) => <option key={lp.id} value={lp.id}>{lp.nome}</option>)}
          </select>
        </div>
      )}
      <div>
        <label>Campanha</label>
        <select value={filtros.utmCampaign || ''} onChange={(e) => set({ utmCampaign: e.target.value || null })}>
          <option value="">Todas</option>
          {campanhas.filter((c) => !c.startsWith('(')).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label>Source</label>
        <select value={filtros.utmSource || ''} onChange={(e) => set({ utmSource: e.target.value || null })}>
          <option value="">Todos</option>
          {sources.filter((c) => !c.startsWith('(')).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label>Medium</label>
        <select value={filtros.utmMedium || ''} onChange={(e) => set({ utmMedium: e.target.value || null })}>
          <option value="">Todos</option>
          {mediums.filter((c) => !c.startsWith('(')).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label>Vendedor</label>
        <select value={filtros.vendedorId || ''} onChange={(e) => set({ vendedorId: e.target.value || null })}>
          <option value="">Todos</option>
          {vendedoresAtivos.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
        </select>
      </div>
      <div>
        <label>Status do lead</label>
        <select value={filtros.temperatura || ''} onChange={(e) => set({ temperatura: e.target.value || null })}>
          <option value="">Todos</option>
          {TEMPERATURAS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}
