import React, { useEffect, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { isSupabaseMode } from '../../lib/mode';
import { fetchLpConversoes, fetchLeadsPorLandingPage } from '../../lib/dataService';
import { lerTrackingLocal } from '../../hooks/useAquisicaoMetricas';

// D-104: "Conversões" da Fase 1 = leads que clicaram no WhatsApp
// (whatsapp_click com lead_id). Quando houver atendimento/venda no
// sistema, esta tela evolui pra mostrar essas etapas — sem inventar
// dado antes disso.
export function ConversoesTab({ landingPageId = null }) {
  const { leads: leadsCompartilhados, landingPages, vendedores } = useApp();
  const [eventos, setEventos] = useState(null);
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    let ativo = true;
    if (isSupabaseMode()) {
      Promise.all([fetchLpConversoes(landingPageId), fetchLeadsPorLandingPage(landingPageId)]).then(([evs, lds]) => {
        if (!ativo) return;
        setEventos(evs || []);
        setLeads(lds || []);
      });
    } else {
      const { events } = lerTrackingLocal();
      setEventos(events.filter((e) => e.nome === 'whatsapp_click' && e.leadId && (!landingPageId || e.landingPageId === landingPageId)));
      setLeads(leadsCompartilhados.filter((l) => l.origem === 'landing_page'));
    }
    return () => { ativo = false; };
  }, [landingPageId, leadsCompartilhados]);

  if (eventos === null) return <div className="empty">Carregando conversões...</div>;
  const leadPorId = new Map(leads.map((l) => [l.id, l]));
  const nomeLp = (id) => landingPages.find((lp) => lp.id === id)?.nome || '—';
  const nomeVendedor = (l) => l?.vendedorNome || vendedores.find((v) => v.id === l?.vendedorId)?.nome || 'Não atribuído';

  // 1 linha por lead (último clique) — a pergunta é "quantos leads clicaram", não "quantos cliques"
  const porLead = new Map();
  eventos.forEach((e) => { if (!porLead.has(e.leadId)) porLead.set(e.leadId, { ...e, cliques: 0 }); porLead.get(e.leadId).cliques += 1; });
  const linhas = [...porLead.values()];

  if (linhas.length === 0) return <div className="empty" style={{ marginTop: 16 }}>Nenhum lead clicou no WhatsApp ainda.</div>;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <span className="section-title">Leads que clicaram no WhatsApp ({linhas.length})</span>
      <div className="tbl-wrap">
        <table data-testid="tabela-conversoes">
          <thead><tr><th>Lead</th><th>Telefone</th><th>Landing Page</th><th>Campanha</th><th>Cliques</th><th>Último clique</th><th>Responsável</th></tr></thead>
          <tbody>
            {linhas.map((e) => { const l = leadPorId.get(e.leadId); return (
              <tr key={e.leadId}>
                <td className="strong">{l?.nome || e.leadId}</td>
                <td>{l?.telefone || '—'}</td>
                <td>{nomeLp(e.landingPageId)}</td>
                <td style={{ color: 'var(--text-3)' }}>{l?.utm?.utm_campaign || '—'}</td>
                <td className="mono">{e.cliques}</td>
                <td>{new Date(e.criadoEm).toLocaleString('pt-BR')}</td>
                <td>{nomeVendedor(l)}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <p className="campo-hint" style={{ marginTop: 10, marginBottom: 0 }}>Atendimento e venda ainda não são registrados pelo sistema — a partir daqui o acompanhamento é manual (Fase 2: integração de WhatsApp).</p>
    </div>
  );
}
