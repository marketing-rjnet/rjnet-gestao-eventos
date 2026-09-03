import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { useAquisicaoMetricas, periodoPadrao } from '../../hooks/useAquisicaoMetricas';
import { AquisicaoFiltros } from './AquisicaoFiltros';
import { AquisicaoDashboard } from './AquisicaoDashboard';
import { LandingPagesTab } from './LandingPagesTab';
import { LandingPageDetail } from './LandingPageDetail';
import { CampanhasTab } from './CampanhasTab';
import { ConversoesTab } from './ConversoesTab';

const SUB_TABS = [
  { id: 'visao',      label: 'Dashboard',     ico: 'chart' },
  { id: 'lps',        label: 'Landing Pages', ico: 'globe' },
  { id: 'campanhas',  label: 'Campanhas',     ico: 'link' },
  { id: 'conversoes', label: 'Conversões',    ico: 'message' },
];

// D-104: Aquisição — módulo do marketing pra acompanhar Campanha → Landing
// Page → Visita → Lead → Clique no WhatsApp. Sem biblioteca de rotas (padrão
// do projeto): sub-navegação interna via seg-control, mesmo desenho de
// DesafioDetail.jsx. Marketing-only por construção (só MarketingApp monta).
export function AquisicaoTab() {
  const { landingPages, leads, vendedores } = useApp();
  const [sub, setSub] = useState('visao');
  const [lpAbertaId, setLpAbertaId] = useState(null);
  const [filtros, setFiltros] = useState(() => ({ dias: 30, ...periodoPadrao(30) }));

  // Métricas gerais (filtros da tela) e métricas da LP aberta (mesmos
  // filtros + landingPageId) — duas chamadas independentes, só a
  // necessária roda.
  const geral = useAquisicaoMetricas(filtros, { landingPages, leads });
  // `null` desliga o hook enquanto nenhuma LP está aberta (sem RPC à toa)
  const filtrosLp = lpAbertaId ? { ...filtros, landingPageId: lpAbertaId } : null;
  const daLp = useAquisicaoMetricas(filtrosLp, { landingPages, leads });

  const lpAberta = lpAbertaId ? landingPages.find((l) => l.id === lpAbertaId) : null;
  const abrirLp = (id) => { setLpAbertaId(id); setSub('lps'); };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Aquisição</div>
          <p className="tab-desc">
            Campanha → Landing Page → Visita → Lead → WhatsApp. Cada landing page é uma instância da mesma
            infraestrutura de tracking e atribuição — a LP Fibra é a primeira. Números vêm do banco, sem estimativas.
          </p>
        </div>
      </div>

      <div className="seg-control" style={{ gridTemplateColumns: `repeat(${SUB_TABS.length}, 1fr)` }}>
        {SUB_TABS.map((t) => (
          <button key={t.id} type="button" className={'seg-btn' + (sub === t.id ? ' active' : '')} onClick={() => { setSub(t.id); if (t.id !== 'lps') setLpAbertaId(null); }}>
            <Icon name={t.ico} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {sub === 'lps' && lpAberta ? (
        <LandingPageDetail
          lp={lpAberta}
          metricas={daLp.metricas}
          carregando={daLp.carregando}
          onBack={() => setLpAbertaId(null)}
          onRecarregar={() => { geral.recarregar(); daLp.recarregar(); }}
        />
      ) : (
        <>
          {sub !== 'lps' && (
            <div className="card" style={{ marginTop: 16 }}>
              <AquisicaoFiltros
                filtros={filtros} setFiltros={setFiltros}
                landingPages={landingPages} vendedores={vendedores}
                porCampanha={geral.metricas?.por_campanha}
                mostrarLp={sub !== 'conversoes'}
              />
            </div>
          )}
          {sub === 'visao' && <AquisicaoDashboard metricas={geral.metricas} carregando={geral.carregando} erro={geral.erro} onAbrirLp={abrirLp} />}
          {sub === 'lps' && <LandingPagesTab metricas={geral.metricas} onAbrirLp={abrirLp} />}
          {sub === 'campanhas' && <CampanhasTab metricas={geral.metricas} carregando={geral.carregando} />}
          {sub === 'conversoes' && <ConversoesTab landingPageId={filtros.landingPageId || null} />}
        </>
      )}
    </div>
  );
}
