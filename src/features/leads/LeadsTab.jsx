import React, { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { servicoLabel, fmtDateLong, mesesDoAno, mesReferenciaLabel } from '../../utils/format';
import { exportLeadsCSV, exportLeadsConsolidadoCSV, exportLeadsMesCSV, exportLeadsMesConsolidadoCSV } from '../../utils/csv';
import { fetchLeadsEvento, fetchLeadsEventos, fetchLeadsMes, fetchLeadsMeses, fetchLeadsSemVendedor, db } from '../../lib/dataService';
import { isSupabaseMode } from '../../lib/mode';
import { resumoPerfil } from '../../lib/simulador';

const ORIGEM_LABEL = { qrcode: 'QR Code', formulario: 'Formulário', simulador: 'Simulador' };

const TEMPERATURA_COR = { frio: '#60a5fa', morno: '#fb923c', quente: '#ef4444', convertido: '#22c55e' };

// Distribuição: leads sem contexto operacional (QR Code, Form Builder e
// futuros canais frios) chegam sem vendedor. Marketing/Comercial atribui
// manualmente — a mesma operação de negócio pra qualquer origem, sem regra
// nova por canal.
function FilaDistribuicao() {
  const { vendedores, leads: leadsCompartilhados, updateLead, removeLead, camposPersonalizados, simuladores } = useApp();
  const [leadsRemotos, setLeadsRemotos] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const vendedoresAtivos = vendedores.filter((v) => (v.papel === 'vendedor' || !v.papel) && v.ativo);
  // campos_extras é guardado por `key` (não por id) — mapeia pra legenda
  // legível sem precisar redesenhar a tela a cada campo novo criado.
  const labelPorKey = Object.fromEntries(camposPersonalizados.map((c) => [c.key, c.label]));
  const camposExtrasTexto = (l) => Object.entries(l.camposExtras || {})
    .map(([key, valor]) => `${labelPorKey[key] || key}: ${valor}`)
    .join(' · ');

  // Modo Supabase: leads frios não fazem parte do array `leads` do
  // contexto (que só carrega por evento/mês sob demanda) — busca à parte.
  // Modo local: `leads` já contém tudo (sem carregamento sob demanda nesse
  // modo), então já dá pra filtrar direto do contexto compartilhado.
  const carregar = () => { fetchLeadsSemVendedor().then(setLeadsRemotos); };
  useEffect(carregar, []);
  const leadsBrutos = isSupabaseMode() ? leadsRemotos : leadsCompartilhados.filter((l) => l.origem);

  // Simulador: leads chegam com pontuação de intenção calculada no servidor —
  // os mais quentes sobem pro topo da fila pra serem distribuídos primeiro.
  // Leads sem pontuação (QR/formulário) mantêm a ordem por data.
  const leadsFrios = leadsBrutos && [...leadsBrutos].sort((a, b) =>
    (b.pontuacao ?? -1) - (a.pontuacao ?? -1) || new Date(b.criadoEm) - new Date(a.criadoEm)
  );

  // Detalhe da origem: campanha do simulador (nome legível) + utm_campaign
  // do anúncio, quando presentes.
  const nomeSimulador = (id) => simuladores.find((s) => s.id === id)?.nome;
  const origemDetalhe = (l) => {
    const partes = [ORIGEM_LABEL[l.origem] || l.origem];
    if (l.qrCodeLabel) partes.push(l.qrCodeLabel);
    if (l.simuladorId && nomeSimulador(l.simuladorId)) partes.push(nomeSimulador(l.simuladorId));
    if (l.utm?.utm_campaign) partes.push(l.utm.utm_campaign);
    return partes.join(' — ');
  };

  const atribuir = (leadId, vendedorId) => {
    const v = vendedoresAtivos.find((x) => x.id === vendedorId);
    if (!v) return;
    if (isSupabaseMode()) {
      // Este lead não está no array `leads` compartilhado — updateLead()
      // do contexto não o acharia e pularia a gravação silenciosamente.
      const lead = leadsRemotos?.find((l) => l.id === leadId);
      if (!lead) return;
      const atualizado = { ...lead, vendedorNome: v.nome, vendedorId: v.id };
      db.saveLead(atualizado);
      setLeadsRemotos((prev) => prev.map((l) => (l.id === leadId ? atualizado : l)));
    } else {
      updateLead(leadId, { vendedorNome: v.nome, vendedorId: v.id });
    }
  };

  // Moderação: descarta um lead frio (ex: spam, dado suspeito) sem
  // precisar atribuir a ninguém antes. Mesmo padrão de acesso direto ao
  // db do resto deste componente — leadsRemotos não está no array
  // compartilhado do contexto em modo Supabase.
  const excluir = (leadId) => {
    if (isSupabaseMode()) {
      db.removeLead(leadId);
      setLeadsRemotos((prev) => prev.filter((l) => l.id !== leadId));
    } else {
      removeLead(leadId);
    }
    setConfirmDelete(null);
  };

  if (leadsFrios === null) return null;
  if (leadsFrios.length === 0) return null;

  const semVendedor = leadsFrios.filter((l) => !l.vendedorId);

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="section-title" style={{ marginBottom: 0 }}>
          Leads sem vendedor {semVendedor.length > 0 && <span className="badge badge-planejado" style={{ marginLeft: 6 }}>{semVendedor.length} para distribuir</span>}
        </span>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={carregar}>Atualizar</button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Interesse</th>
              <th>Perfil</th>
              <th>Origem</th>
              <th>Responsável</th>
              <th style={{ width: 200 }}></th>
            </tr>
          </thead>
          <tbody>
            {leadsFrios.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="strong">{l.nome}</div>
                  {(l.cidade || l.bairro) && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{[l.bairro, l.cidade].filter(Boolean).join(', ')}</div>
                  )}
                  {camposExtrasTexto(l) && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{camposExtrasTexto(l)}</div>}
                </td>
                <td>{l.telefone}</td>
                <td>{servicoLabel(l.servicoInteresse)}</td>
                <td style={{ fontSize: 12 }}>
                  {l.pontuacao != null ? (
                    <>
                      <span style={{ fontWeight: 700, color: TEMPERATURA_COR[l.temperatura] || 'var(--text-2)' }}>
                        {l.pontuacao} pts · {l.temperatura}
                      </span>
                      {resumoPerfil(l.perfilConsumo).length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', maxWidth: 220 }}>
                          {resumoPerfil(l.perfilConsumo).join(' · ')}
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-3)' }}>—</span>
                  )}
                </td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{origemDetalhe(l)}</td>
                <td>{l.vendedorNome || <span style={{ color: 'var(--text-3)' }}>Não atribuído</span>}</td>
                <td>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={l.vendedorId ?? ''}
                      onChange={(e) => { if (e.target.value) atribuir(l.id, e.target.value); }}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Atribuir a...</option>
                      {vendedoresAtivos.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                    </select>
                    {confirmDelete === l.id ? (
                      <>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: '2px 6px', color: 'var(--red)' }}
                          onClick={() => excluir(l.id)}
                        >
                          Confirmar
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 11, padding: '2px 6px', color: 'var(--text-3)' }}
                        title="Excluir lead (spam, dado suspeito)"
                        onClick={() => setConfirmDelete(l.id)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LeadsTab({ session }) {
  const { eventos } = useApp();
  const [selecionados, setSelecionados] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // D-058: leads do dia a dia, fora de eventos — mesmo padrão de interação
  // da tabela de eventos acima, só que por mês de referência.
  const anoAtual = new Date().getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [mesesSelecionados, setMesesSelecionados] = useState([]);
  const [carregandoMes, setCarregandoMes] = useState(false);
  const mesesDoAnoSelecionado = mesesDoAno(anoSelecionado);

  const evName = (id) => eventos.find((e) => e.id === id)?.nome || id;

  const toggleMes = (value) => setMesesSelecionados((prev) =>
    prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
  );

  const toggleTodosMeses = () =>
    setMesesSelecionados(mesesSelecionados.length === mesesDoAnoSelecionado.length ? [] : mesesDoAnoSelecionado.map((m) => m.value));

  const exportarMes = async () => {
    if (mesesSelecionados.length !== 1) return;
    setCarregandoMes(true);
    const mesRef = mesesSelecionados[0];
    const leads = await fetchLeadsMes(mesRef);
    setCarregandoMes(false);
    if (!leads?.length) { alert('Nenhum lead encontrado para este mês.'); return; }
    const sufixo = mesReferenciaLabel(mesRef).replace(/\s+/g, '_').replace('/', '-');
    exportLeadsMesCSV(leads, sufixo, servicoLabel, mesReferenciaLabel, ({ totalRegistros }) => {
      db.registrarExportacao({
        usuarioId: session?.userId || null,
        usuarioNome: session?.nome || null,
        usuarioEmail: session?.email || null,
        filtros: { mes: mesRef },
        totalRegistros,
      });
    });
  };

  const exportarMesConsolidado = async () => {
    if (mesesSelecionados.length === 0) return;
    setCarregandoMes(true);
    const leads = await fetchLeadsMeses(mesesSelecionados);
    setCarregandoMes(false);
    if (!leads?.length) { alert('Nenhum lead encontrado nos meses selecionados.'); return; }
    exportLeadsMesConsolidadoCSV(leads, mesReferenciaLabel, servicoLabel, ({ totalRegistros, totalMeses }) => {
      db.registrarExportacao({
        usuarioId: session?.userId || null,
        usuarioNome: session?.nome || null,
        usuarioEmail: session?.email || null,
        filtros: { meses: mesesSelecionados },
        totalRegistros,
      });
    });
  };

  const toggle = (id) => setSelecionados((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );

  const toggleTodos = () =>
    setSelecionados(selecionados.length === eventos.length ? [] : eventos.map((e) => e.id));

  const exportarEvento = async () => {
    if (selecionados.length !== 1) return;
    setCarregando(true);
    const eventoId = selecionados[0];
    const leads = await fetchLeadsEvento(eventoId);
    setCarregando(false);
    if (!leads?.length) { alert('Nenhum lead encontrado para este evento.'); return; }
    const sufixo = evName(eventoId).replace(/\s+/g, '_');
    exportLeadsCSV(leads, sufixo, servicoLabel, evName, ({ totalRegistros }) => {
      db.registrarExportacao({
        usuarioId: session?.userId || null,
        usuarioNome: session?.nome || null,
        usuarioEmail: session?.email || null,
        filtros: { evento: eventoId },
        totalRegistros,
      });
    });
  };

  const exportarConsolidado = async () => {
    if (selecionados.length === 0) return;
    setCarregando(true);
    const leads = await fetchLeadsEventos(selecionados);
    setCarregando(false);
    if (!leads?.length) { alert('Nenhum lead encontrado nos eventos selecionados.'); return; }
    exportLeadsConsolidadoCSV(leads, evName, servicoLabel, ({ totalRegistros, totalEventos }) => {
      db.registrarExportacao({
        usuarioId: session?.userId || null,
        usuarioNome: session?.nome || null,
        usuarioEmail: session?.email || null,
        filtros: { eventos: selecionados },
        totalRegistros,
      });
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Exportar Leads</div>
          <p className="tab-desc">Selecione um ou mais eventos para exportar os leads.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            style={{ fontSize: 13 }}
            onClick={exportarEvento}
            disabled={selecionados.length !== 1 || carregando}
            title="Exporta apenas o evento selecionado"
          >
            {carregando ? 'Carregando...' : '↓ Exportar evento'}
          </button>
          <button
            className="btn-primary"
            style={{ fontSize: 13 }}
            onClick={exportarConsolidado}
            disabled={selecionados.length === 0 || carregando}
            title="Exporta todos os eventos selecionados em um único CSV com coluna Evento"
          >
            {carregando ? 'Carregando...' : `↓ Exportar consolidado${selecionados.length > 0 ? ` (${selecionados.length})` : ''}`}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="section-title" style={{ marginBottom: 0 }}>Eventos</span>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={toggleTodos}>
            {selecionados.length === eventos.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>
        {eventos.length === 0 ? (
          <div className="empty">Nenhum evento cadastrado.</div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Evento</th>
                  <th>Status</th>
                  <th>Início</th>
                  <th>Fim</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => toggle(ev.id)}
                    style={{ cursor: 'pointer', background: selecionados.includes(ev.id) ? 'var(--yellow-dim, rgba(245,192,0,0.08))' : undefined }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selecionados.includes(ev.id)}
                        onChange={() => toggle(ev.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td className="strong">{ev.nome}</td>
                    <td><span className={`badge badge-${ev.status}`}>{ev.status}</span></td>
                    <td>{fmtDateLong(ev.dataInicio)}</td>
                    <td>{fmtDateLong(ev.dataFim)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selecionados.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
            {selecionados.length} evento{selecionados.length > 1 ? 's' : ''} selecionado{selecionados.length > 1 ? 's' : ''}.
            {selecionados.length === 1 ? ' Use "Exportar evento" para CSV individual.' : ' Use "Exportar consolidado" para CSV único com coluna Evento.'}
          </div>
        )}
      </div>

      <FilaDistribuicao />

      {/* D-058: leads do dia a dia, fora de eventos — mesmo padrão da tabela acima */}
      <div className="page-head" style={{ marginTop: 28 }}>
        <div>
          <div className="page-title">Atividade Mensal</div>
          <p className="tab-desc">Leads registrados pelo vendedor fora de eventos, por mês de referência.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={anoSelecionado} onChange={(e) => { setAnoSelecionado(Number(e.target.value)); setMesesSelecionados([]); }} style={{ fontSize: 13 }}>
            <option value={anoAtual}>{anoAtual}</option>
            <option value={anoAtual - 1}>{anoAtual - 1}</option>
          </select>
          <button
            className="btn-ghost"
            style={{ fontSize: 13 }}
            onClick={exportarMes}
            disabled={mesesSelecionados.length !== 1 || carregandoMes}
            title="Exporta apenas o mês selecionado"
          >
            {carregandoMes ? 'Carregando...' : '↓ Exportar mês'}
          </button>
          <button
            className="btn-primary"
            style={{ fontSize: 13 }}
            onClick={exportarMesConsolidado}
            disabled={mesesSelecionados.length === 0 || carregandoMes}
            title="Exporta todos os meses selecionados em um único CSV com coluna Mês"
          >
            {carregandoMes ? 'Carregando...' : `↓ Exportar consolidado${mesesSelecionados.length > 0 ? ` (${mesesSelecionados.length})` : ''}`}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="section-title" style={{ marginBottom: 0 }}>Meses de {anoSelecionado}</span>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={toggleTodosMeses}>
            {mesesSelecionados.length === mesesDoAnoSelecionado.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Mês</th>
              </tr>
            </thead>
            <tbody>
              {mesesDoAnoSelecionado.map((m) => (
                <tr
                  key={m.value}
                  onClick={() => toggleMes(m.value)}
                  style={{ cursor: 'pointer', background: mesesSelecionados.includes(m.value) ? 'var(--yellow-dim, rgba(245,192,0,0.08))' : undefined }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={mesesSelecionados.includes(m.value)}
                      onChange={() => toggleMes(m.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td className="strong">{m.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mesesSelecionados.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
            {mesesSelecionados.length} mês{mesesSelecionados.length > 1 ? 'es' : ''} selecionado{mesesSelecionados.length > 1 ? 's' : ''}.
            {mesesSelecionados.length === 1 ? ' Use "Exportar mês" para CSV individual.' : ' Use "Exportar consolidado" para CSV único com coluna Mês.'}
          </div>
        )}
      </div>
    </div>
  );
}
