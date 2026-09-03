import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon, Kpi } from '../../components/ui';
import { isSupabaseMode } from '../../lib/mode';
import { supabaseConfig } from '../../lib/supabase';
import { fetchLpEventos, fetchLpSessoes, fetchLeadsPorLandingPage } from '../../lib/dataService';
import { servicoLabel } from '../../utils/format';
import { eventoLabel, fmtInt, fmtPct, taxaConversao, gerarSnippetLp, INTEGRACOES_TRACKING, montarLinkWhatsapp, STATUS_LP_LABEL } from '../../lib/aquisicao';
import { lerTrackingLocal } from '../../hooks/useAquisicaoMetricas';
import { AquisicaoFunil } from './AquisicaoFunil';
import { CampanhasTab } from './CampanhasTab';
import { ConversoesTab } from './ConversoesTab';
import { LandingPageForm } from './LandingPageForm';

const SUB_TABS = [
  { id: 'visao',      label: 'Visão geral', ico: 'chart' },
  { id: 'eventos',    label: 'Eventos',     ico: 'activity' },
  { id: 'leads',      label: 'Leads',       ico: 'users' },
  { id: 'campanhas',  label: 'Campanhas',   ico: 'link' },
  { id: 'conversoes', label: 'Conversões',  ico: 'message' },
  { id: 'integracao', label: 'Integração',  ico: 'globe' },
  { id: 'config',     label: 'Configurar',  ico: 'settings' },
];

// D-104: detalhe de UMA Landing Page — mesmo componente pra qualquer LP.
// Métricas já vêm filtradas por LP (o pai passa `filtros.landingPageId`).
export function LandingPageDetail({ lp, metricas, carregando, onBack, onRecarregar }) {
  const { updateLandingPage, removeLandingPage, leads: leadsCompartilhados, landingPages, vendedores } = useApp();
  const [sub, setSub] = useState('visao');
  const [eventos, setEventos] = useState(null);
  const [sessoes, setSessoes] = useState([]);
  const [leads, setLeads] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    if (isSupabaseMode()) {
      Promise.all([fetchLpEventos(lp.id), fetchLpSessoes(lp.id), fetchLeadsPorLandingPage(lp.id)]).then(([evs, ses, lds]) => {
        if (!ativo) return;
        setEventos(evs || []); setSessoes(ses || []); setLeads(lds || []);
      });
    } else {
      const { events, sessions } = lerTrackingLocal();
      setEventos(events.filter((e) => e.landingPageId === lp.id).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)));
      setSessoes(sessions.filter((s) => s.landingPageId === lp.id));
      setLeads(leadsCompartilhados.filter((l) => l.landingPageId === lp.id));
    }
    return () => { ativo = false; };
  }, [lp.id, leadsCompartilhados]);

  const totais = metricas?.totais || { visitas: 0, interacoes: 0, leads: 0, whatsapp: 0, whatsapp_leads: 0 };
  const sessaoPorId = useMemo(() => new Map(sessoes.map((s) => [s.id, s])), [sessoes]);
  const leadPorId = useMemo(() => new Map((leads || []).map((l) => [l.id, l])), [leads]);
  const sdkUrl = `${window.location.origin}/rjnet-lp.js`;
  const snippet = gerarSnippetLp({ sdkUrl, slug: lp.slug, supabaseUrl: supabaseConfig.url, anonKey: supabaseConfig.anonKey });
  const linkWa = montarLinkWhatsapp(lp.whatsappNumber, lp.whatsappMensagem);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(snippet); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* clipboard indisponível — o snippet fica visível */ }
  };

  return (
    <div>
      <div className="page-head" style={{ marginTop: 12 }}>
        <button type="button" className="btn-ghost" onClick={onBack}><Icon name="back" size={16} /> Voltar</button>
        <div style={{ flex: 1 }}>
          <div className="page-title">{lp.nome} <span className={'badge badge-' + lp.status} style={{ verticalAlign: 'middle', marginLeft: 8 }}>{STATUS_LP_LABEL[lp.status] || lp.status}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }} className="mono">/{lp.slug}{lp.dominio ? ` · ${lp.dominio}` : ''}{lp.servico ? ` · ${servicoLabel(lp.servico)}` : ''}</div>
        </div>
      </div>

      <div className="seg-control" style={{ gridTemplateColumns: `repeat(${SUB_TABS.length}, 1fr)` }}>
        {SUB_TABS.map((t) => (
          <button key={t.id} type="button" className={'seg-btn' + (sub === t.id ? ' active' : '')} style={{ fontSize: 12.5, padding: '10px 6px' }} onClick={() => setSub(t.id)}>
            <Icon name={t.ico} size={13} /> {t.label}
          </button>
        ))}
      </div>

      {sub === 'visao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div className="grid-kpi">
            <Kpi label="Visitas" value={fmtInt(totais.visitas)} icon="globe" />
            <Kpi label="Leads" value={fmtInt(totais.leads)} icon="users" />
            <Kpi label="Conversão" value={fmtPct(taxaConversao(totais.leads, totais.visitas))} icon="chart" />
            <Kpi label="WhatsApp" value={fmtInt(totais.whatsapp)} icon="message" />
          </div>
          <div className="card">
            <span className="section-title">Funil desta landing page</span>
            {carregando && !metricas ? <div className="empty">Carregando...</div> : <AquisicaoFunil totais={totais} />}
          </div>
          <div className="card">
            <span className="section-title">WhatsApp</span>
            {lp.whatsappEnabled ? (
              lp.whatsappNumber
                ? <div style={{ fontSize: 13 }}>Destino: <span className="mono">+{lp.whatsappNumber}</span> · <a href={linkWa} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow)' }}>testar link</a></div>
                : <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Número ainda não definido — o clique já é rastreado; configure o número em "Configurar" quando o atendimento oficial existir.</div>
            ) : <div style={{ fontSize: 13, color: 'var(--text-3)' }}>WhatsApp desabilitado nesta LP.</div>}
          </div>
        </div>
      )}

      {sub === 'eventos' && (
        <div className="card" style={{ marginTop: 16 }}>
          <span className="section-title">Últimos eventos recebidos {eventos ? `(${eventos.length})` : ''}</span>
          {eventos === null ? <div className="empty">Carregando...</div> : eventos.length === 0 ? (
            <div className="empty">Nenhum evento ainda. Assim que o SDK estiver instalado na LP, page_view/cta_click/etc. aparecem aqui — esta é a trilha de diagnóstico do tracking.</div>
          ) : (
            <div className="tbl-wrap">
              <table data-testid="tabela-eventos">
                <thead><tr><th>Quando</th><th>Evento</th><th>Sessão</th><th>Origem (UTM)</th><th>Dispositivo</th><th>Lead</th><th>Detalhes</th></tr></thead>
                <tbody>
                  {eventos.map((e) => { const s = sessaoPorId.get(e.sessionId); const l = leadPorId.get(e.leadId); return (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.criadoEm).toLocaleString('pt-BR')}</td>
                      <td className="strong">{eventoLabel(e.nome)} <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.nome}</span></td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.sessionId ? e.sessionId.slice(0, 8) : '—'}</td>
                      <td style={{ fontSize: 12 }}>{s ? [s.utmSource, s.utmMedium, s.utmCampaign].filter(Boolean).join(' / ') || (s.referrer ? `ref: ${s.referrer}` : 'direto') : '—'}</td>
                      <td>{s?.device || '—'}</td>
                      <td>{l ? l.nome : (e.leadId ? e.leadId.slice(0, 12) : '—')}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{Object.entries(e.propriedades || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {sub === 'leads' && (
        <div className="card" style={{ marginTop: 16 }}>
          <span className="section-title">Leads desta landing page {leads ? `(${leads.length})` : ''}</span>
          {leads === null ? <div className="empty">Carregando...</div> : leads.length === 0 ? (
            <div className="empty">Nenhum lead ainda.</div>
          ) : (
            <div className="tbl-wrap">
              <table data-testid="tabela-leads-lp">
                <thead><tr><th>Nome</th><th>Telefone</th><th>Serviço</th><th>Campanha</th><th>Source / Medium</th><th>Temperatura</th><th>Responsável</th><th>Cadastrado em</th></tr></thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td className="strong">{l.nome}</td>
                      <td>{l.telefone}</td>
                      <td>{servicoLabel(l.servicoInteresse)}</td>
                      <td>{l.utm?.utm_campaign || '—'}</td>
                      <td style={{ color: 'var(--text-3)' }}>{[l.utm?.utm_source, l.utm?.utm_medium].filter(Boolean).join(' / ') || '—'}</td>
                      <td>{l.temperatura}</td>
                      <td>{l.vendedorNome || vendedores.find((v) => v.id === l.vendedorId)?.nome || 'Não atribuído'}</td>
                      <td>{new Date(l.criadoEm).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="campo-hint" style={{ marginTop: 10, marginBottom: 0 }}>Distribuição para vendedores continua em Relatórios → "Leads sem vendedor" (mesma fila do Form Builder/Simulador).</p>
        </div>
      )}

      {sub === 'campanhas' && <CampanhasTab metricas={metricas} carregando={carregando} />}
      {sub === 'conversoes' && <ConversoesTab landingPageId={lp.id} />}

      {sub === 'integracao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div className="card">
            <span className="section-title">1. Instalar o SDK na landing page</span>
            <p className="tab-desc" style={{ margin: '0 0 10px' }}>Cole no <span className="mono">&lt;head&gt;</span> da LP ({lp.dominio || 'domínio da LP'}). A LP continua 100% independente — só este script conversa com o RJNET Gestão, em segundo plano.</p>
            <pre className="lp-snippet" data-testid="lp-snippet">{snippet}</pre>
            <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={copiar}>{copiado ? '✓ Copiado!' : 'Copiar snippet'}</button>
          </div>
          <div className="card">
            <span className="section-title">2. Marcar os elementos da LP</span>
            <pre className="lp-snippet">{`<!-- CTA rastreado -->
<a href="#form" data-rjnet-cta="hero_assinar">Quero assinar</a>

<!-- Formulário de lead (name= dos campos é o contrato) -->
<form data-rjnet-form="principal" data-rjnet-redirect="/obrigado">
  <input name="nome" required>
  <input name="telefone" required>
  <input name="bairro"> <input name="cidade">
  <label><input type="checkbox" name="consentimento" required> Autorizo o contato (LGPD)</label>
  <input name="website" style="display:none" tabindex="-1" autocomplete="off"> <!-- honeypot -->
  <div data-rjnet-erro hidden></div>
  <button type="submit">Enviar</button>
</form>

<!-- Botão de WhatsApp: rastreado e aberto com o número configurado aqui -->
<a href="#" data-rjnet-whatsapp="cta_final">${lp.whatsappLabel || 'Falar no WhatsApp'}</a>`}</pre>
            <p className="campo-hint" style={{ marginTop: 8 }}>UTMs (utm_source/medium/campaign/term/content), referrer e dispositivo são capturados sozinhos no primeiro acesso e viajam com o lead. Sem número de WhatsApp configurado, o botão segue o <span className="mono">href</span> da própria LP — o clique é rastreado do mesmo jeito.</p>
          </div>
          <div className="card">
            <span className="section-title">3. Tracking &amp; integrações desta LP</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div>Tracking interno (banco RJNET): <strong style={{ color: 'var(--green)' }}>ativo</strong></div>
              {INTEGRACOES_TRACKING.map((i) => (
                <div key={i.key}>{i.label.split(' — ')[0]}: {lp.tracking?.[i.key]
                  ? <><strong style={{ color: i.implementado ? 'var(--green)' : 'var(--yellow)' }}>{i.implementado ? 'ativo' : 'configurado (adapter na fase 2)'}</strong> <span className="mono" style={{ color: 'var(--text-3)' }}>{lp.tracking[i.key]}</span></>
                  : <span style={{ color: 'var(--text-3)' }}>desativado</span>}</div>
              ))}
            </div>
            <p className="campo-hint" style={{ marginTop: 10, marginBottom: 0 }}>Eventos internos → camada de tracking → banco RJNET / GTM / (GA4, Ads, Meta quando conectados). A LP nunca fala direto com uma plataforma específica.</p>
          </div>
        </div>
      )}

      {sub === 'config' && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LandingPageForm
            inicial={lp}
            landingPages={landingPages}
            onSalvar={(dados) => { updateLandingPage(lp.id, dados); setSub('visao'); onRecarregar?.(); }}
            onCancelar={() => setSub('visao')}
          />
          <div className="card">
            <span className="section-title">Zona de risco</span>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13 }}>Excluir a LP apaga sessões e eventos dela; os leads permanecem (perdem só o vínculo).</span>
                <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => { removeLandingPage(lp.id); onBack(); }}>Confirmar exclusão</button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>
            ) : (
              <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirmDelete(true)}><Icon name="trash" size={14} /> Excluir landing page</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
