import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { Icon } from '../components/ui';
import SyncBadge from '../components/SyncBadge';
import { SERVICO_LABEL, TIPO_LABEL, servicoLabel } from '../utils/format';
import { maskCpf, maskTel, validarTelefone } from '../utils/masks';
import { sanitizeText } from '../lib/security';
import { META_DIARIA, STATUS_EVENTO, RANKING_DEBOUNCE_MS, RANKING_POLL_MS, TOAST_DURATION_MS } from '../lib/constants';

const TEMPERATURA_CONFIG = {
  frio:       { label: "Frio",       cor: "#60a5fa", cls: "temp-frio" },
  morno:      { label: "Morno",      cor: "#fb923c", cls: "temp-morno" },
  quente:     { label: "Quente",     cor: "#ef4444", cls: "temp-quente" },
  convertido: { label: "Convertido", cor: "#22c55e", cls: "temp-convertido" },
};

const OBS_ATALHOS = [
  "Mora em área coberta",
  "Já tem outro provedor",
  "Quer portabilidade",
  "Interesse em combo",
  "Retornar amanhã",
  "Aguardando visita técnica",
];

function LeadEditInline({ lead, onSave, onCancel }) {
  const [e, setE] = useState({
    nome: lead.nome,
    telefone: lead.telefone,
    cpf: lead.cpf || "",
    endereco: lead.endereco || "",
    servicoInteresse: lead.servicoInteresse,
    temperatura: lead.temperatura,
    observacao: lead.observacao || "",
    jaClienteRjnet: lead.jaClienteRjnet || false,
  });
  const upd = (k, v) => setE((p) => ({ ...p, [k]: v }));
  return (
    <div className="lead-edit-form">
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>Nome completo *</label>
        <input required value={e.nome} onChange={(ev) => upd("nome", ev.target.value)} autoComplete="off" />
      </div>
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>Telefone *</label>
        <input required value={e.telefone} onChange={(ev) => upd("telefone", maskTel(ev.target.value))} inputMode="tel" autoComplete="off" />
      </div>
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>CPF</label>
        <input value={e.cpf} onChange={(ev) => upd("cpf", maskCpf(ev.target.value))} inputMode="numeric" />
      </div>
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>Endereço</label>
        <input value={e.endereco} onChange={(ev) => upd("endereco", ev.target.value)} />
      </div>
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>Serviço de interesse</label>
        <div className="seg-control">
          {Object.keys(SERVICO_LABEL).map((s) => (
            <button type="button" key={s} className={"seg-btn" + (e.servicoInteresse === s ? " active" : "")} onClick={() => upd("servicoInteresse", s)}>
              {SERVICO_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>Temperatura</label>
        <div className="temp-grid">
          {Object.entries(TEMPERATURA_CONFIG).map(([k, cfg]) => (
            <button type="button" key={k} className={"temp-btn " + cfg.cls + (e.temperatura === k ? " active" : "")} style={{ "--tc": cfg.cor }} onClick={() => upd("temperatura", k)}>
              {cfg.label}
            </button>
          ))}
        </div>
      </div>
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>Observação</label>
        <textarea rows="2" value={e.observacao} onChange={(ev) => upd("observacao", ev.target.value)} />
      </div>
      <label className="checkbox-field" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={e.jaClienteRjnet} onChange={(ev) => upd("jaClienteRjnet", ev.target.checked)} />
        <span>Já é cliente RJNet?</span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => onSave(e)}>Salvar</button>
        <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export default function VendedorApp({ session, onLogout, darkMode, toggleDark }) {
  const { getEventosAtivos, addLead, removeLead, updateLead, leads, eventos, obterRanking } = useApp();
  const ativos = getEventosAtivos();
  const [eventoId, setEventoId] = useState(ativos[0]?.id || "");

  useEffect(() => {
    if (!ativos.some((e) => e.id === eventoId)) {
      setEventoId(ativos[0]?.id || "");
    }
  }, [ativos, eventoId]);

  const [aba, setAba] = useState("registrar");
  const FORM_VAZIO = { nome: "", telefone: "", endereco: "", cpf: "", servicoInteresse: "internet_residencial", temperatura: "morno", observacao: "", jaClienteRjnet: false };
  const [f, setF] = useState(FORM_VAZIO);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [modoRapido, setModoRapido] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [editandoId, setEditandoId] = useState(null);

  const eventoAtual = eventos.find((e) => e.id === eventoId);
  const leadsDoEvento = leads.filter((l) => l.eventoId === eventoId && l.vendedorNome === session.vendedorNome);

  const pct = Math.min((leadsDoEvento.length / META_DIARIA) * 100, 100);
  const metaBatida = leadsDoEvento.length >= META_DIARIA;

  const [ranking, setRanking] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const rankingDebounce = useRef(null);

  const atualizarRanking = useRef(null);
  atualizarRanking.current = async (eventoId) => {
    if (!eventoId) { setRanking([]); return; }
    setRankingLoading(true);
    const r = await obterRanking(eventoId);
    setRanking(r || []);
    setRankingLoading(false);
  };

  useEffect(() => {
    atualizarRanking.current(eventoId);
  }, [eventoId]);

  useEffect(() => {
    if (!eventoId) return;
    clearTimeout(rankingDebounce.current);
    rankingDebounce.current = setTimeout(() => atualizarRanking.current(eventoId), RANKING_DEBOUNCE_MS);
    return () => clearTimeout(rankingDebounce.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length]);

  useEffect(() => {
    if (!eventoId) return;
    const interval = setInterval(() => atualizarRanking.current(eventoId), RANKING_POLL_MS);
    return () => clearInterval(interval);
  }, [eventoId]);

  const totalLeadsEvento = ranking.reduce((a, r) => a + r.total, 0);
  const maxRanking = ranking[0]?.total || 1;

  const showToast = (id, nome) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id, nome });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };

  const handleUndo = () => {
    if (!toast) return;
    removeLead(toast.id);
    clearTimeout(toastTimer.current);
    setToast(null);
  };

  const [formErro, setFormErro] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setFormErro("");
    if (!eventoId) { setFormErro("Selecione um evento antes de registrar."); return; }
    const eventoSel = eventos.find((ev) => ev.id === eventoId);
    if (!eventoSel || eventoSel.status === STATUS_EVENTO.ENCERRADO) { setFormErro("Este evento está encerrado e não aceita novos leads."); return; }
    const nome = sanitizeText(f.nome, 120);
    if (!nome) { setFormErro("Nome é obrigatório."); return; }
    if (!validarTelefone(f.telefone)) { setFormErro("Telefone inválido. Informe DDD + número (10 ou 11 dígitos)."); return; }
    const novoId = "l" + Date.now() + Math.random().toString(36).slice(2,7);
    addLead({
      id: novoId,
      ...f,
      nome,
      cpf: sanitizeText(f.cpf, 14),
      endereco: sanitizeText(f.endereco, 200),
      observacao: sanitizeText(f.observacao, 500),
      eventoId,
      vendedorNome: session.vendedorNome,
      vendedorId: session.userId || null,
    });
    if (typeof navigator.vibrate === "function") navigator.vibrate(80);
    showToast(novoId, nome);
    setF(FORM_VAZIO);
  };

  const addObs = (txt) => set("observacao", f.observacao ? f.observacao + ". " + txt : txt);

  const salvarEdicao = (id, dados) => {
    updateLead(id, dados);
    setEditandoId(null);
  };

  const posColors = ["gold", "silver", "bronze"];

  const formatDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

  const mapUrl = eventoAtual?.local
    ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(eventoAtual.local)
    : null;

  return (
    <div>
      <header className="app-header">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"36px"}} />
        <div className="header-right" style={{ marginLeft: "auto", gap: 8 }}>
          <SyncBadge />
          <button className="theme-toggle" onClick={toggleDark} title="Alternar tema"><Icon name={darkMode ? "sun" : "moon"} size={17} /></button>
          <span className="user-badge"><span className="vendedor-avatar" style={{ width: 22, height: 22, fontSize: 11 }}>{session.vendedorNome.charAt(0)}</span><span className="ub-name">{session.vendedorNome}</span></span>
        </div>
        <button className="btn-ghost" onClick={onLogout}>Sair</button>
      </header>

      <div className="vend-shell">
        {/* Seletor de evento compartilhado */}
        <div className="big-field big-select" style={{ marginBottom: 20 }}>
          <label>Evento</label>
          {ativos.length === 0 ? (
            <div className="empty" style={{ textAlign: "left", padding: "10px 0" }}>Nenhum evento ativo no momento.</div>
          ) : (
            <select value={eventoId} onChange={(e) => { setEventoId(e.target.value); setEditandoId(null); }}>
              {ativos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          )}
        </div>

        {/* ---- ABA REGISTRAR ---- */}
        {aba === "registrar" && (
          <>
            <div className="vend-top">
              <span style={{ fontSize: 18, fontWeight: 700 }}>Novo Lead</span>
              <span className="count-badge" style={metaBatida ? { background: "var(--green)" } : {}}>
                {leadsDoEvento.length}/{META_DIARIA} leads
              </span>
            </div>
            <div className="meta-bar-wrap">
              <div className="meta-bar-header">
                <span className="meta-bar-label">{metaBatida ? "Meta batida! 🎯" : "Meta diária"}</span>
                <span className="meta-bar-count">{leadsDoEvento.length} de {META_DIARIA}</span>
              </div>
              <div className="meta-bar-track">
                <div className={"meta-bar-fill" + (metaBatida ? " done" : "")} style={{ width: pct + "%" }} />
              </div>
            </div>
            <label className="modo-rapido-toggle">
              <span className={"toggle-switch" + (modoRapido ? " on" : "")} onClick={() => setModoRapido((v) => !v)} />
              Modo rápido — só essencial
            </label>
            {ativos.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 16px", gap: 14 }}>
                <Icon name="calendar" size={44} stroke="var(--text-3)" />
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-2)" }}>Sem eventos ativos</div>
                <div style={{ fontSize: 14, color: "var(--text-3)", maxWidth: 280, lineHeight: 1.6 }}>
                  Aguarde o marketing ativar um evento para começar a registrar leads.
                </div>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="big-field">
                  <label>Nome completo *</label>
                  <input required maxLength={120} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome do cliente" autoComplete="off" />
                </div>
                <div className="big-field">
                  <label>Telefone *</label>
                  <input required maxLength={15} value={f.telefone} onChange={(e) => set("telefone", maskTel(e.target.value))} placeholder="(24) 99999-9999" inputMode="tel" autoComplete="off" />
                </div>
                <div className="big-field">
                  <label>CPF do cliente</label>
                  <input maxLength={14} value={f.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
                </div>
                {!modoRapido && (
                  <div className="big-field">
                    <label>Endereço</label>
                    <input maxLength={200} value={f.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número, bairro" />
                  </div>
                )}
                <div className="big-field">
                  <label>Serviço de interesse *</label>
                  <div className="seg-control">
                    {Object.keys(SERVICO_LABEL).map((s) => (
                      <button type="button" key={s} className={"seg-btn" + (f.servicoInteresse === s ? " active" : "")} onClick={() => set("servicoInteresse", s)}>
                        {SERVICO_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="checkbox-field">
                  <input type="checkbox" checked={f.jaClienteRjnet} onChange={(e) => set("jaClienteRjnet", e.target.checked)} />
                  <span>Já é cliente RJNet?</span>
                  {f.jaClienteRjnet && <span className="badge badge-ativo" style={{ marginLeft: 8, fontSize: 11 }}>Sim</span>}
                </label>
                <div className="big-field">
                  <label>Temperatura do lead</label>
                  <div className="temp-grid">
                    {Object.entries(TEMPERATURA_CONFIG).map(([k, cfg]) => (
                      <button type="button" key={k} className={"temp-btn " + cfg.cls + (f.temperatura === k ? " active" : "")} style={{ "--tc": cfg.cor }} onClick={() => set("temperatura", k)}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                {!modoRapido && (
                  <div className="big-field">
                    <label>Observação</label>
                    <div className="obs-chips">
                      {OBS_ATALHOS.map((a) => (
                        <button type="button" key={a} className="obs-chip" onClick={() => addObs(a)}>{a}</button>
                      ))}
                    </div>
                    <textarea rows="2" maxLength={500} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="Informações adicionais..." />
                  </div>
                )}
                {formErro && <div style={{ color:"var(--red)", fontSize:13, padding:"8px 12px", background:"var(--red-bg)", borderRadius:8, marginBottom:4 }}>{formErro}</div>}
                <button type="submit" className="btn-primary btn-full lead-submit">Registrar Lead</button>
              </form>
            )}
          </>
        )}

        {/* ---- ABA MEUS LEADS ---- */}
        {aba === "meus-leads" && (
          <div>
            {leadsDoEvento.length === 0 ? (
              <div className="empty" style={{ padding: "48px 0", textAlign: "center" }}>
                <Icon name="person" size={36} stroke="var(--text-3)" />
                <div style={{ marginTop: 12, color: "var(--text-3)", fontSize: 14 }}>Nenhum lead registrado neste evento ainda.</div>
              </div>
            ) : (
              <div className="meus-leads">
                <h3>{leadsDoEvento.length} lead{leadsDoEvento.length > 1 ? "s" : ""} neste evento</h3>
                {leadsDoEvento.map((l) => {
                  const tc = TEMPERATURA_CONFIG[l.temperatura] || TEMPERATURA_CONFIG.morno;
                  const editando = editandoId === l.id;
                  const tel = l.telefone.replace(/\D/g, "");
                  return (
                    <div key={l.id} className={"lead-mini" + (editando ? " editing" : "")}>
                      {editando ? (
                        <LeadEditInline lead={l} onSave={(dados) => salvarEdicao(l.id, dados)} onCancel={() => setEditandoId(null)} />
                      ) : (
                        <>
                          <div className="lm-row">
                            <div className="lm-name">{l.nome}</div>
                            <button
                              type="button"
                              className="temp-btn"
                              style={{ "--tc": tc.cor, fontSize: 11, padding: "3px 10px", borderRadius: 999, color: tc.cor, background: "color-mix(in srgb," + tc.cor + " 12%, transparent)", boxShadow: "0 0 0 1px " + tc.cor }}
                              onClick={() => {
                                const ordem = Object.keys(TEMPERATURA_CONFIG);
                                const idx = ordem.indexOf(l.temperatura || "morno");
                                updateLead(l.id, { temperatura: ordem[(idx + 1) % ordem.length] });
                              }}
                              title="Toque para alterar temperatura"
                            >{tc.label}</button>
                          </div>
                          <div className="lm-sub" style={{ marginTop: 4 }}>
                            {l.cpf && <span className="mono" style={{ marginRight: 6 }}>{l.cpf}</span>}
                            {servicoLabel(l.servicoInteresse)}
                            {l.jaClienteRjnet && <span className="badge badge-ativo" style={{ marginLeft: 6, fontSize: 10 }}>Já cliente</span>}
                          </div>
                          <div className="lm-contacts">
                            <a href={"tel:" + tel} className="lm-contact-btn lm-contact-call">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.33 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 5.93 5.93l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              Ligar
                            </a>
                            <a href={"https://wa.me/55" + tel} target="_blank" rel="noreferrer" className="lm-contact-btn lm-contact-whats">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                              WhatsApp
                            </a>
                          </div>
                          <button type="button" className="lm-edit-btn" onClick={() => setEditandoId(l.id)}>Editar dados</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---- ABA PACOTES ---- */}
        {aba === "pacotes" && (
          <div className="pacotes-wrap">
            {/* INTERNET FIBRA */}
            <div className="pacotes-section">
              <div className="pacotes-section-title">📶 Internet Fibra</div>
              <table className="pacotes-table">
                <thead><tr><th>Plano</th><th>Valor</th></tr></thead>
                <tbody>
                  <tr><td>60 Mega</td><td>R$ 49,90</td></tr>
                  <tr><td>90 Mega</td><td>R$ 74,90</td></tr>
                  <tr><td>120 Mega</td><td>R$ 79,90</td></tr>
                  <tr><td>240 Mega</td><td>R$ 89,90</td></tr>
                  <tr className="pacotes-destaque"><td>420 Mega ⭐</td><td>R$ 99,90</td></tr>
                  <tr><td>680 Mega</td><td>R$ 119,90</td></tr>
                </tbody>
              </table>
            </div>

            {/* TV */}
            <div className="pacotes-section">
              <div className="pacotes-section-title">📺 TV</div>
              <table className="pacotes-table">
                <thead><tr><th>Plano</th><th>Canais</th><th>Valor</th></tr></thead>
                <tbody>
                  <tr><td>Start</td><td>27</td><td>R$ 29,90</td></tr>
                  <tr><td>Multi+</td><td>88</td><td>R$ 89,90</td></tr>
                </tbody>
              </table>
              <div className="pacotes-sub-title">Premium (adicionais)</div>
              <table className="pacotes-table">
                <thead><tr><th>Canal</th><th>Valor</th></tr></thead>
                <tbody>
                  <tr><td>Telecine</td><td>R$ 29,90</td></tr>
                  <tr><td>Premiere</td><td>R$ 59,90</td></tr>
                  <tr><td>Combate</td><td>R$ 34,90</td></tr>
                </tbody>
              </table>
            </div>

            {/* MÓVEL */}
            <div className="pacotes-section">
              <div className="pacotes-section-title">📱 Móvel</div>
              <div className="pacotes-chips">
                <span className="pacotes-chip">WhatsApp ilimitado</span>
                <span className="pacotes-chip">Cobertura nacional</span>
                <span className="pacotes-chip">Dados acumulativos</span>
              </div>
              <table className="pacotes-table">
                <thead><tr><th>Plano</th><th>Franquia</th><th>Valor</th></tr></thead>
                <tbody>
                  <tr><td>Pré</td><td>2 GB</td><td>R$ 29,90</td></tr>
                  <tr><td>Controle</td><td>10 GB</td><td>R$ 39,90</td></tr>
                  <tr><td>Controle</td><td>24 GB</td><td>R$ 54,90</td></tr>
                  <tr><td>Controle</td><td>35 GB</td><td>R$ 69,90</td></tr>
                </tbody>
              </table>
            </div>

            {/* APPS */}
            <div className="pacotes-section">
              <div className="pacotes-section-title">🎁 Apps</div>
              <div className="pacotes-apps-grid">
                <div className="pacotes-app-card pacotes-app-yellow">
                  <div className="pacotes-app-header">
                    <span className="pacotes-app-name">Yellow</span>
                    <span className="pacotes-app-price">R$ 15,00/mês</span>
                  </div>
                  <ul className="pacotes-app-list">
                    <li>Deezer</li>
                    <li>Ubook</li>
                    <li>Kaspersky</li>
                    <li>PlayKids</li>
                    <li>Estuda+</li>
                    <li>HUB Vantagens</li>
                    <li>e outros</li>
                  </ul>
                </div>
                <div className="pacotes-app-card pacotes-app-black">
                  <div className="pacotes-app-header">
                    <span className="pacotes-app-name">Black</span>
                    <span className="pacotes-app-price">R$ 30,00/mês</span>
                  </div>
                  <ul className="pacotes-app-list">
                    <li>Max</li>
                    <li>Disney+</li>
                    <li>NBA</li>
                    <li>Smart Fit</li>
                    <li>Zen</li>
                    <li>Queima Diária</li>
                    <li>Kaspersky</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- ABA EVENTO ---- */}
        {aba === "evento" && (
          <div>
            {!eventoAtual ? (
              <div className="empty" style={{ padding: "48px 0", textAlign: "center" }}>Nenhum evento selecionado.</div>
            ) : (
              <>
                <div className="ev-info-card">
                  <div className="ev-info-row">
                    <span className="ev-info-label">Nome</span>
                    <span className="ev-info-value" style={{ fontWeight: 700 }}>{eventoAtual.nome}</span>
                  </div>
                  <div className="ev-info-row">
                    <span className="ev-info-label">Local</span>
                    <span className="ev-info-value">{eventoAtual.local || "—"}</span>
                  </div>
                  <div className="ev-info-row">
                    <span className="ev-info-label">Período</span>
                    <span className="ev-info-value">{formatDate(eventoAtual.dataInicio)} → {formatDate(eventoAtual.dataFim)}</span>
                  </div>
                  <div className="ev-info-row">
                    <span className="ev-info-label">Tipo</span>
                    <span className="ev-info-value">{TIPO_LABEL[eventoAtual.tipo] || eventoAtual.tipo}</span>
                  </div>
                  <div className="ev-info-row">
                    <span className="ev-info-label">Total leads</span>
                    <span className="ev-info-value" style={{ fontWeight: 700, color: "var(--rj-blue)" }}>{totalLeadsEvento}</span>
                  </div>
                  {eventoAtual.observacoes && (
                    <div className="ev-info-row">
                      <span className="ev-info-label">Obs.</span>
                      <span className="ev-info-value" style={{ fontStyle: "italic", color: "var(--text-3)" }}>{eventoAtual.observacoes}</span>
                    </div>
                  )}
                </div>

                {mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-mapa">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Abrir no Maps
                  </a>
                )}

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    Placar da equipe
                    {rankingLoading && <span style={{ width: 12, height: 12, border: "2px solid var(--text-3)", borderTopColor: "var(--yellow,#f5c000)", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
                  </div>
                  {ranking.length === 0 && !rankingLoading ? (
                    <div style={{ color: "var(--text-3)", fontSize: 14, textAlign: "center", padding: "20px 0" }}>Nenhum lead registrado ainda.</div>
                  ) : ranking.length === 0 ? (
                    <div style={{ color: "var(--text-3)", fontSize: 14, textAlign: "center", padding: "20px 0" }}>Carregando placar…</div>
                  ) : (
                    <div className="ranking-list">
                      {ranking.map((item, i) => (
                        <div key={item.nome} className={"ranking-item" + (item.nome === session.vendedorNome ? " me" : "")}>
                          <div className="ranking-header">
                            <span className={"ranking-pos" + (i < 3 ? " " + posColors[i] : "")}>{i + 1}º</span>
                            <span className="ranking-name">{item.nome}{item.nome === session.vendedorNome && <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>(você)</span>}</span>
                            <span className="ranking-count">{item.total}</span>
                          </div>
                          <div className="ranking-bar-track">
                            <div className="ranking-bar-fill" style={{ width: Math.round((item.total / maxRanking) * 100) + "%" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Barra de navegação inferior */}
      <nav className="vend-bottom-nav">
        <button className={"vend-nav-btn" + (aba === "registrar" ? " active" : "")} onClick={() => setAba("registrar")}>
          <Icon name="plus" size={22} stroke={aba === "registrar" ? "#f5c000" : "#5a7a9a"} strokeWidth={1.8} />
          Registrar
        </button>
        <button className={"vend-nav-btn" + (aba === "meus-leads" ? " active" : "")} onClick={() => { setAba("meus-leads"); setEditandoId(null); }}>
          <Icon name="person" size={22} stroke={aba === "meus-leads" ? "#f5c000" : "#5a7a9a"} strokeWidth={1.8} />
          Meus Leads
          {leadsDoEvento.length > 0 && <span className="vend-nav-badge">{leadsDoEvento.length}</span>}
        </button>
        <button className={"vend-nav-btn" + (aba === "evento" ? " active" : "")} onClick={() => setAba("evento")}>
          <Icon name="calendar" size={22} stroke={aba === "evento" ? "#f5c000" : "#5a7a9a"} strokeWidth={1.8} />
          Evento
        </button>
        <button className={"vend-nav-btn" + (aba === "pacotes" ? " active" : "")} onClick={() => setAba("pacotes")}>
          <Icon name="box" size={22} stroke={aba === "pacotes" ? "#f5c000" : "#5a7a9a"} strokeWidth={1.8} />
          Pacotes
        </button>
      </nav>

      {toast && (
        <div className="toast">
          <span>Lead <b>{toast.nome}</b> registrado</span>
          <button className="toast-undo" onClick={handleUndo}>Desfazer</button>
        </div>
      )}
    </div>
  );
}
