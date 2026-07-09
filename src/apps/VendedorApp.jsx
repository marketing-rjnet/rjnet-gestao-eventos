import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { useRanking } from '../hooks/useRanking';
import { Icon } from '../components/ui';
import SyncBadge from '../components/SyncBadge';
import { SERVICO_LABEL, TIPO_LABEL, servicoLabel, mesesDoAno, mesReferenciaLabel } from '../utils/format';
import { maskCpf, maskTel, validarTelefone } from '../utils/masks';
import { sanitizeText } from '../lib/security';
import { META_BRONZE, META_PRATA, META_OURO, META_DIARIA, STATUS_EVENTO, TOAST_DURATION_MS } from '../lib/constants';
import { resumoPerfil, PACOTES_INTERNET, APPS_ADICIONAIS, PLANOS_MOVEL } from '../lib/simulador';
import { SearchInput } from '../components/SearchInput';

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
    servicoInteresse: Array.isArray(lead.servicoInteresse)
      ? lead.servicoInteresse
      : (lead.servicoInteresse ? [lead.servicoInteresse] : []),
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
        <label>CPF <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-3)" }}>(opcional — para visita técnica)</span></label>
        <input value={e.cpf} onChange={(ev) => upd("cpf", maskCpf(ev.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
      </div>
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>Endereço</label>
        <input value={e.endereco} onChange={(ev) => upd("endereco", ev.target.value)} />
      </div>
      <div className="big-field" style={{ marginBottom: 10 }}>
        <label>Serviços de interesse (selecione um ou mais)</label>
        <div className="seg-control">
          {Object.keys(SERVICO_LABEL).map((s) => (
            <button type="button" key={s}
              className={"seg-btn" + (e.servicoInteresse.includes(s) ? " active" : "")}
              onClick={() => {
                const arr = e.servicoInteresse.includes(s)
                  ? e.servicoInteresse.filter((x) => x !== s)
                  : [...e.servicoInteresse, s];
                upd("servicoInteresse", arr);
              }}>
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
      <div className="big-field" style={{ marginBottom: 14 }}>
        <label>Já é cliente RJNet?</label>
        <div className="seg-control">
          <button type="button" className={"seg-btn" + (!e.jaClienteRjnet ? " active" : "")} onClick={() => upd("jaClienteRjnet", false)}>Não</button>
          <button type="button" className={"seg-btn" + (e.jaClienteRjnet ? " active" : "")} onClick={() => upd("jaClienteRjnet", true)}>Sim</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => onSave(e)}>Salvar</button>
        <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

// D-057: baixa a imagem via blob — o atributo download do <a> é ignorado pelo
// navegador em links de outra origem (imagem fica no domínio do Supabase)
async function baixarOfertaImagem(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank');
  }
}

// D-057: 1 modal por lead listando as ofertas disponíveis pros serviços de interesse dele
function OfertaPickerModal({ lead, tel, ofertasDoLead, eventoId, mesReferencia, session, ofertaJaEnviada, registrarOfertaEnviada, onClose }) {
  return (
    <div className="modal-overlay oferta-picker-overlay" onClick={onClose}>
      <div className="modal-box oferta-picker-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Enviar oferta — {lead.nome}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
          {ofertasDoLead.map((oferta) => (
            <div key={oferta.servico} className="lm-contacts">
              <a
                href={"https://wa.me/55" + tel + "?text=" + encodeURIComponent(oferta.copy)}
                target="_blank" rel="noreferrer"
                className="lm-contact-btn lm-contact-whats"
                onClick={() => registrarOfertaEnviada({ leadId: lead.id, eventoId, mesReferencia, servico: oferta.servico, vendedorId: session.userId, vendedorNome: session.vendedorNome })}
              >
                {SERVICO_LABEL[oferta.servico]}
              </a>
              {oferta.imagemUrl && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ flex: "0 0 auto" }}
                  onClick={() => baixarOfertaImagem(oferta.imagemUrl, oferta.imagemPath || `oferta-${oferta.servico}.jpg`)}
                >
                  ⬇️ Baixar
                </button>
              )}
              {ofertaJaEnviada(lead.id, oferta.servico) && (
                <span style={{ fontSize: 11, color: "var(--green)", alignSelf: "center" }}>✓</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// D-058: mês corrente como mes_referencia ("2026-07-01")
const mesAtualRef = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export default function VendedorApp({ session, onLogout, darkMode, toggleDark }) {
  const { getEventosAtivos, addLead, removeLead, updateLead, leads, eventos, carregarLeadsEvento, carregarLeadsMes, carregarLeadsQrCode, obterRankingMes, ofertas, ofertaJaEnviada, registrarOfertaEnviada, camposPersonalizados } = useApp();
  // campos_extras é guardado por `key` — mapeia pra legenda legível
  const labelPorKeyExtra = Object.fromEntries(camposPersonalizados.map((c) => [c.key, c.label]));
  const camposExtrasTexto = (l) => Object.entries(l.camposExtras || {})
    .map(([key, valor]) => `${labelPorKeyExtra[key] || key}: ${valor}`)
    .join(' · ');
  const ativos = getEventosAtivos();
  const [eventoId, setEventoId] = useState(ativos[0]?.id || "");
  // D-058: modo de captação — "evento" (fluxo de sempre) ou "mes" (dia a dia,
  // fora de eventos). Default inteligente: evento se houver um ativo, senão
  // mês — mas o vendedor pode alternar livremente a qualquer momento.
  // QR Code: um terceiro item na mesma seleção visual, mas NÃO é um contexto
  // operacional como Evento/Mês — não tem registro manual, ranking nem meta;
  // só mostra os leads já distribuídos a este vendedor (ver DECISIONS/D-061).
  const [contextoTipo, setContextoTipo] = useState(() => (ativos.length > 0 ? "evento" : "mes"));
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualRef);
  const mesesDisponiveis = mesesDoAno(new Date().getFullYear());

  useEffect(() => {
    if (!ativos.some((e) => e.id === eventoId)) {
      setEventoId(ativos[0]?.id || "");
    }
  }, [ativos, eventoId]);

  useEffect(() => {
    if (contextoTipo === "evento" && eventoId) carregarLeadsEvento(eventoId);
    if (contextoTipo === "mes" && mesSelecionado) carregarLeadsMes(mesSelecionado);
    if (contextoTipo === "qrcode") carregarLeadsQrCode();
  }, [contextoTipo, eventoId, mesSelecionado]);

  const [aba, setAba] = useState("registrar");
  const FORM_VAZIO = { nome: "", telefone: "", cpf: "", endereco: "", servicoInteresse: ["internet_residencial"], temperatura: "morno", observacao: "", jaClienteRjnet: false, consentimentoColetado: false };
  const [f, setF] = useState(FORM_VAZIO);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [modoRapido, setModoRapido] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmandoDelId, setConfirmandoDelId] = useState(null);
  const [buscaLead, setBuscaLead] = useState("");
  const [ofertaPickerLeadId, setOfertaPickerLeadId] = useState(null);
  const [showPacotes, setShowPacotes] = useState(false);

  const eventoAtual = eventos.find((e) => e.id === eventoId);
  const leadsDoContexto = contextoTipo === "evento"
    ? leads.filter((l) => l.eventoId === eventoId && l.vendedorNome === session.vendedorNome)
    : contextoTipo === "mes"
    ? leads.filter((l) => l.mesReferencia === mesSelecionado && l.vendedorNome === session.vendedorNome)
    : leads.filter((l) => l.origem && l.vendedorNome === session.vendedorNome);

  const pct = Math.min((leadsDoContexto.length / META_OURO) * 100, 100);
  const metaBronze = leadsDoContexto.length >= META_BRONZE;
  const metaPrata  = leadsDoContexto.length >= META_PRATA;
  const metaOuro   = leadsDoContexto.length >= META_OURO;
  const nivelMeta  = metaOuro ? "ouro" : metaPrata ? "prata" : metaBronze ? "bronze" : "";

  const { ranking, rankingLoading } = useRanking(
    contextoTipo === "evento" ? eventoId : contextoTipo === "mes" ? mesSelecionado : null,
    leads.length,
    contextoTipo === "mes" ? obterRankingMes : undefined,
  );
  const meRef = useRef(null);

  useEffect(() => {
    if (meRef.current) meRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [ranking]);

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

  const [etapa, setEtapa] = useState(1);
  const [formErro, setFormErro] = useState("");

  const avancar = () => { setFormErro(""); setEtapa((v) => v + 1); };
  const voltar  = () => { setFormErro(""); setEtapa((v) => v - 1); };

  // D-058: valida o contexto ativo (evento ou mês) antes de registrar.
  // Em modo mês não há status de evento a checar — mês é sempre "aberto".
  const validarContexto = () => {
    if (contextoTipo === "evento") {
      if (!eventoId) return "Selecione um evento antes de registrar.";
      const eventoSel = eventos.find((ev) => ev.id === eventoId);
      if (!eventoSel || eventoSel.status === STATUS_EVENTO.ENCERRADO) return "Este evento está encerrado e não aceita novos leads.";
    } else if (contextoTipo === "mes") {
      if (!mesSelecionado) return "Selecione um mês antes de registrar.";
    } else {
      return "Leads de captação digital chegam automaticamente — não é possível registrar manualmente neste contexto.";
    }
    return "";
  };

  const submit = (e) => {
    e.preventDefault();
    setFormErro("");
    const erroContexto = validarContexto();
    if (erroContexto) { setFormErro(erroContexto); return; }
    const nome = sanitizeText(f.nome, 120);
    if (!nome) { setFormErro("Nome é obrigatório."); return; }
    if (!validarTelefone(f.telefone)) { setFormErro("Telefone inválido. Informe DDD + número (10 ou 11 dígitos)."); return; }
    if (!f.servicoInteresse.length) { setFormErro("Selecione ao menos um serviço de interesse."); return; }
    // D-043: validação de consentimento suspensa temporariamente — campo oculto da UI até decisão externa
    const novo = addLead({
      ...f,
      nome,
      cpf: sanitizeText(f.cpf, 14),
      endereco: sanitizeText(f.endereco, 200),
      observacao: sanitizeText(f.observacao, 500),
      eventoId: contextoTipo === "evento" ? eventoId : null,
      mesReferencia: contextoTipo === "mes" ? mesSelecionado : null,
      vendedorNome: session.vendedorNome,
      vendedorId: session.userId || null,
    });
    if (typeof navigator.vibrate === "function") navigator.vibrate(80);
    showToast(novo.id, nome);
    setF(FORM_VAZIO);
    setEtapa(1);
  };

  const addObs = (txt) => set("observacao", f.observacao ? f.observacao + ". " + txt : txt);

  const salvarEdicao = (id, dados) => {
    updateLead(id, {
      ...dados,
      nome:       sanitizeText(dados.nome, 120),
      cpf:        sanitizeText(dados.cpf || "", 14),
      endereco:   sanitizeText(dados.endereco || "", 200),
      observacao: sanitizeText(dados.observacao || "", 500),
    });
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
        {/* D-058: alterna entre captação vinculada a um evento de campo e
            captação do dia a dia por mês de referência — sempre disponível,
            independente de haver evento ativo. */}
        <div className="big-field" style={{ marginBottom: 10 }}>
          <div className="seg-control">
            <button type="button" className={"seg-btn" + (contextoTipo === "evento" ? " active" : "")} onClick={() => { setContextoTipo("evento"); setEditandoId(null); }}>
              Evento
            </button>
            <button type="button" className={"seg-btn" + (contextoTipo === "mes" ? " active" : "")} onClick={() => { setContextoTipo("mes"); setEditandoId(null); }}>
              Atividade do Mês
            </button>
            <button type="button" className={"seg-btn" + (contextoTipo === "qrcode" ? " active" : "")} onClick={() => { setContextoTipo("qrcode"); setEditandoId(null); }}>
              Captação
            </button>
          </div>
        </div>

        {/* Seletor de evento / mês compartilhado — QR Code não tem seletor
            próprio (não é um contexto ao vivo, só os leads já distribuídos) */}
        {contextoTipo !== "qrcode" && (
          <div className="big-field big-select" style={{ marginBottom: 20 }}>
            {contextoTipo === "evento" ? (
              <>
                <label>Evento</label>
                {ativos.length === 0 ? (
                  <div className="empty" style={{ textAlign: "left", padding: "10px 0" }}>Nenhum evento ativo no momento.</div>
                ) : (
                  <select value={eventoId} onChange={(e) => { setEventoId(e.target.value); setEditandoId(null); }}>
                    {ativos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                )}
              </>
            ) : (
              <>
                <label>Mês</label>
                <select value={mesSelecionado} onChange={(e) => { setMesSelecionado(e.target.value); setEditandoId(null); }}>
                  {mesesDisponiveis.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </>
            )}
          </div>
        )}

        {/* ---- ABA REGISTRAR ---- */}
        {aba === "registrar" && contextoTipo === "qrcode" && (
          <div className="empty" style={{ padding: "48px 16px", textAlign: "center" }}>
            <Icon name="search" size={36} stroke="var(--text-3)" />
            <div style={{ marginTop: 12, fontWeight: 700, fontSize: 15, color: "var(--text-2)" }}>Leads de captação digital chegam automaticamente</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)", maxWidth: 280, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
              Quem escaneia um QR Code ou responde um formulário/simulador preenche os próprios dados. O marketing distribui esses leads para você — acompanhe em "Meus Leads".
            </div>
          </div>
        )}
        {aba === "registrar" && contextoTipo !== "qrcode" && (
          <>
            <div className="vend-top">
              <span style={{ fontSize: 18, fontWeight: 700 }}>Novo Lead</span>
              <span className="count-badge" style={
                metaOuro ? { background: "var(--green)" } :
                metaPrata ? { background: "#9ca3af", color: "#111" } :
                metaBronze ? { background: "#b45309" } : {}
              }>
                {metaOuro ? "🥇" : metaPrata ? "🥈" : metaBronze ? "🥉" : ""} {leadsDoContexto.length} leads
              </span>
            </div>
            <div className="meta-bar-wrap">
              <div className="meta-bar-header">
                <span className="meta-bar-label">
                  {metaOuro ? "Meta Ouro atingida! 🥇" : metaPrata ? "Meta Prata atingida! 🥈" : metaBronze ? "Meta Bronze atingida! 🥉" : "Progresso das metas"}
                </span>
                <span className="meta-bar-count">{leadsDoContexto.length} de {META_OURO}</span>
              </div>
              <div className="meta-bar-track">
                <div className={"meta-bar-fill" + (nivelMeta ? " " + nivelMeta : "")} style={{ width: pct + "%" }} />
              </div>
              <div className="meta-bar-stages">
                <span className={"meta-stage" + (metaBronze ? " achieved" : "")}>🥉 {META_BRONZE}</span>
                <span className={"meta-stage" + (metaPrata ? " achieved" : "")}>🥈 {META_PRATA}</span>
                <span className={"meta-stage" + (metaOuro ? " achieved" : "")}>🥇 {META_OURO}</span>
              </div>
            </div>
            <label className="modo-rapido-toggle">
              <span className={"toggle-switch" + (modoRapido ? " on" : "")} onClick={() => setModoRapido((v) => !v)} />
              Modo rápido — só essencial
            </label>
            {contextoTipo === "evento" && ativos.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 16px", gap: 14 }}>
                <Icon name="calendar" size={44} stroke="var(--text-3)" />
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-2)" }}>Sem eventos ativos</div>
                <div style={{ fontSize: 14, color: "var(--text-3)", maxWidth: 280, lineHeight: 1.6 }}>
                  Aguarde o marketing ativar um evento, ou registre pela Atividade do Mês.
                </div>
                <button type="button" className="btn-primary" style={{ fontSize: 13 }} onClick={() => setContextoTipo("mes")}>
                  Registrar por mês
                </button>
              </div>
            ) : (
              <>
                {/* Indicador de progresso */}
                <div className="wizard-progress">
                  {[1,2,3].map((n) => (
                    <div key={n} className={"wizard-step" + (etapa === n ? " current" : etapa > n ? " done" : "")} />
                  ))}
                </div>
                <div className="wizard-step-label">{etapa === 1 ? "Identificação" : etapa === 2 ? "Serviço" : "Detalhes"} — {etapa} de {modoRapido ? 2 : 3}</div>

                {/* Etapa 1 — Nome + Telefone + Endereço */}
                {etapa === 1 && (
                  <div className="wizard-slide">
                    <div className="big-field">
                      <label>Nome completo *</label>
                      <input required maxLength={120} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome do cliente" autoComplete="off" autoFocus />
                    </div>
                    <div className="big-field">
                      <label>Telefone *</label>
                      <input required maxLength={15} value={f.telefone} onChange={(e) => set("telefone", maskTel(e.target.value))} placeholder="(24) 99999-9999" inputMode="tel" autoComplete="off" />
                    </div>
                    <div className="big-field">
                      <label>Endereço <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-3)" }}>(opcional)</span></label>
                      <input maxLength={200} value={f.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número, bairro" />
                    </div>
                    {formErro && <div className="form-erro">{formErro}</div>}
                    <button type="button" className="btn-primary btn-full lead-submit"
                      disabled={!f.nome.trim() || !f.telefone.trim()}
                      onClick={() => {
                        if (!validarTelefone(f.telefone)) { setFormErro("Telefone inválido. Informe DDD + número (10 ou 11 dígitos)."); return; }
                        avancar();
                      }}>
                      Próximo →
                    </button>
                  </div>
                )}

                {/* Etapa 2 — Serviço visual */}
                {etapa === 2 && (
                  <div className="wizard-slide">
                    <div className="big-field">
                      <label>Serviço de interesse * (selecione um ou mais)</label>
                      <div className="servico-grid">
                        {[
                          { key: "internet_residencial", ico: "🌐", label: "Internet Residencial" },
                          { key: "rjnet_movel",           ico: "📶", label: "Móvel" },
                          { key: "internet_empresarial", ico: "💼", label: "Empresarial" },
                          { key: "outro",                ico: "📦", label: "Outro" },
                        ].map(({ key, ico, label }) => (
                          <button type="button" key={key}
                            className={"servico-btn" + (f.servicoInteresse.includes(key) ? " active" : "")}
                            onClick={() => {
                              const arr = f.servicoInteresse.includes(key)
                                ? f.servicoInteresse.filter((x) => x !== key)
                                : [...f.servicoInteresse, key];
                              set("servicoInteresse", arr);
                            }}>
                            <span className="servico-ico">{ico}</span>
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {formErro && <div className="form-erro">{formErro}</div>}
                    <div className="wizard-actions">
                      <button type="button" className="btn-ghost" onClick={voltar}>← Voltar</button>
                      {modoRapido ? (
                        <button type="button" className="btn-primary" style={{ flex: 1 }}
                          disabled={!f.servicoInteresse.length}
                          onClick={() => {
                            if (!f.servicoInteresse.length) { setFormErro("Selecione ao menos um serviço."); return; }
                            const erroContexto = validarContexto();
                            if (erroContexto) { setFormErro(erroContexto); return; }
                            const nome = sanitizeText(f.nome, 120);
                            const novo = addLead({
                              ...f, nome, cpf: sanitizeText(f.cpf, 14), endereco: sanitizeText(f.endereco, 200), observacao: sanitizeText(f.observacao, 500),
                              eventoId: contextoTipo === "evento" ? eventoId : null,
                              mesReferencia: contextoTipo === "mes" ? mesSelecionado : null,
                              vendedorNome: session.vendedorNome, vendedorId: session.userId || null,
                            });
                            if (typeof navigator.vibrate === "function") navigator.vibrate(80);
                            showToast(novo.id, nome);
                            setF(FORM_VAZIO);
                            setEtapa(1);
                          }}>
                          ✓ Registrar
                        </button>
                      ) : (
                        <button type="button" className="btn-primary" style={{ flex: 1 }}
                          disabled={!f.servicoInteresse.length}
                          onClick={() => {
                            if (!f.servicoInteresse.length) { setFormErro("Selecione ao menos um serviço."); return; }
                            avancar();
                          }}>
                          Próximo →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Etapa 3 — Temperatura + opcionais */}
                {etapa === 3 && (
                  <form className="wizard-slide" onSubmit={submit}>
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
                    <div className="big-field">
                      <label>Já é cliente RJNet?</label>
                      <div className="seg-control">
                        <button type="button" className={"seg-btn" + (!f.jaClienteRjnet ? " active" : "")} onClick={() => set("jaClienteRjnet", false)}>Não</button>
                        <button type="button" className={"seg-btn" + (f.jaClienteRjnet ? " active" : "")} onClick={() => set("jaClienteRjnet", true)}>Sim</button>
                      </div>
                    </div>
                    <div className="big-field">
                      <label>Observação</label>
                      <div className="obs-chips">
                        {OBS_ATALHOS.map((a) => (
                          <button type="button" key={a} className="obs-chip" onClick={() => addObs(a)}>{a}</button>
                        ))}
                      </div>
                      <textarea rows="2" maxLength={500} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="Informações adicionais..." />
                    </div>
                    <div className="big-field">
                      <label>CPF <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-3)" }}>(opcional)</span></label>
                      <input maxLength={14} value={f.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
                    </div>
                    {/* D-043: campo de consentimento LGPD oculto até decisão externa */}
                    {formErro && <div className="form-erro">{formErro}</div>}
                    <div className="wizard-actions">
                      <button type="button" className="btn-ghost" onClick={voltar}>← Voltar</button>
                      <button type="submit" className="btn-primary lead-submit" style={{ flex: 1 }}>✓ Registrar</button>
                    </div>
                  </form>
                )}
              </>
            )}
          </>
        )}

        {/* ---- ABA MEUS LEADS ---- */}
        {aba === "meus-leads" && (
          <div>
            {leadsDoContexto.length === 0 ? (
              <div className="empty" style={{ padding: "48px 0", textAlign: "center" }}>
                <Icon name="person" size={36} stroke="var(--text-3)" />
                <div style={{ marginTop: 12, color: "var(--text-3)", fontSize: 14 }}>
                  {contextoTipo === "evento" ? "Nenhum lead registrado neste evento ainda."
                    : contextoTipo === "mes" ? "Nenhum lead registrado neste mês ainda."
                    : "Nenhum lead de captação digital distribuído a você ainda."}
                </div>
              </div>
            ) : (
              <div className="meus-leads">
                <SearchInput
                  value={buscaLead}
                  onChange={setBuscaLead}
                  placeholder="Buscar por nome…"
                  onClear={() => setBuscaLead("")}
                />
                <h3>{leadsDoContexto.length} lead{leadsDoContexto.length > 1 ? "s" : ""} {contextoTipo === "evento" ? "neste evento" : contextoTipo === "mes" ? "neste mês" : "de captação digital"}</h3>
                {leadsDoContexto.filter((l) => !buscaLead.trim() || l.nome.toLowerCase().includes(buscaLead.toLowerCase())).length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13, padding: "24px 0" }}>Nenhum lead com esse nome.</div>
                ) : leadsDoContexto.filter((l) => !buscaLead.trim() || l.nome.toLowerCase().includes(buscaLead.toLowerCase())).map((l) => {
                  const tc = TEMPERATURA_CONFIG[l.temperatura] || TEMPERATURA_CONFIG.morno;
                  const editando = editandoId === l.id;
                  const tel = l.telefone.replace(/\D/g, "");
                  // D-057: mostra todas as ofertas configuradas (não só o interesse declarado no
                  // cadastro) — o vendedor pode perceber interesse em outro serviço na conversa e
                  // enviar na hora, sem precisar editar o lead antes. Interesse declarado vem primeiro.
                  const interessesDoLead = Array.isArray(l.servicoInteresse) ? l.servicoInteresse : [l.servicoInteresse];
                  const ofertasDoLead = Object.keys(SERVICO_LABEL)
                    .map((s) => ofertas.find((o) => o.servico === s && o.copy))
                    .filter(Boolean)
                    .sort((a, b) => interessesDoLead.includes(b.servico) - interessesDoLead.includes(a.servico));
                  return (
                    <div key={l.id} className={"lead-mini" + (editando ? " editing" : "")}>
                      {editando ? (
                        <LeadEditInline lead={l} onSave={(dados) => salvarEdicao(l.id, dados)} onCancel={() => setEditandoId(null)} />
                      ) : (
                        <>
                          <div className="lm-row">
                            <div className="lm-name">{l.nome}</div>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: "2px 6px", color: "var(--text-3)" }} title="Editar dados" onClick={() => { setEditandoId(l.id); setConfirmandoDelId(null); }}>
                                <Icon name="edit" size={14} />
                              </button>
                              <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: "2px 6px", color: "var(--text-3)" }} title="Excluir lead" onClick={() => { setConfirmandoDelId(l.id); setEditandoId(null); }}>
                                <Icon name="trash" size={14} />
                              </button>
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
                          </div>
                          <div className="lm-sub" style={{ marginTop: 4 }}>
                            {l.cpf && <span className="mono" style={{ marginRight: 6 }}>{l.cpf}</span>}
                            {servicoLabel(l.servicoInteresse)}
                            {l.jaClienteRjnet && <span className="badge badge-ativo" style={{ marginLeft: 6, fontSize: 10 }}>Já cliente</span>}
                          </div>
                          {camposExtrasTexto(l) && (
                            <div className="lm-sub" style={{ marginTop: 2, fontSize: 11, color: "var(--text-3)" }}>{camposExtrasTexto(l)}</div>
                          )}
                          {/* Simulador: perfil de consumo declarado pelo próprio lead —
                              o vendedor aborda já sabendo a dor e o uso da casa */}
                          {l.perfilConsumo && resumoPerfil(l.perfilConsumo).length > 0 && (
                            <div className="lm-sub" style={{ marginTop: 2, fontSize: 11, color: "var(--text-3)" }}>
                              Perfil: {resumoPerfil(l.perfilConsumo).join(" · ")}
                            </div>
                          )}
                          <div className="lm-contacts">
                            <a href={"https://wa.me/55" + tel} target="_blank" rel="noreferrer" className="lm-contact-btn lm-contact-whats">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                              WhatsApp
                            </a>
                          </div>
                          {/* D-057: 1 botão que abre um seletor de ofertas prontas pro serviço de interesse do lead */}
                          {ofertasDoLead.length > 0 && (
                            <button type="button" className="lm-contact-btn lm-contact-whats" style={{ width: "100%", marginTop: 8 }} onClick={() => setOfertaPickerLeadId(l.id)}>
                              Enviar oferta
                            </button>
                          )}
                          {ofertaPickerLeadId === l.id && (
                            <OfertaPickerModal
                              lead={l} tel={tel} ofertasDoLead={ofertasDoLead}
                              eventoId={contextoTipo === "evento" ? eventoId : null}
                              mesReferencia={contextoTipo === "mes" ? mesSelecionado : null}
                              session={session}
                              ofertaJaEnviada={ofertaJaEnviada} registrarOfertaEnviada={registrarOfertaEnviada}
                              onClose={() => setOfertaPickerLeadId(null)}
                            />
                          )}
                          {confirmandoDelId === l.id && (
                            <div className="lm-del-confirm">
                              <span>Confirmar exclusão do lead?</span>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" className="lm-del-confirm-yes" onClick={() => { removeLead(l.id); setConfirmandoDelId(null); }}>Sim, excluir</button>
                                <button type="button" className="lm-del-confirm-no" onClick={() => setConfirmandoDelId(null)}>Cancelar</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---- PACOTES (acessível dentro da aba Evento) ---- */}
        {aba === "evento" && showPacotes && (
          <div className="pacotes-wrap">
            {/* INTERNET FIBRA */}
            <div className="pacotes-section">
              <div className="pacotes-section-title">📶 Internet Fibra</div>
              <table className="pacotes-table">
                <thead><tr><th>Plano</th><th>Valor</th></tr></thead>
                <tbody>
                  {PACOTES_INTERNET.map((p) => (
                    <tr key={p.mega} className={p.destaque ? 'pacotes-destaque' : undefined}>
                      <td>{p.mega} Mega{p.destaque ? ' ⭐' : ''}</td>
                      <td>R$ {p.preco.toFixed(2).replace('.', ',')}</td>
                    </tr>
                  ))}
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
                  {PLANOS_MOVEL.map((p) => (
                    <tr key={p.key}><td>{p.plano}</td><td>{p.franquia}</td><td>R$ {p.preco.toFixed(2).replace('.', ',')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* APPS */}
            <div className="pacotes-section">
              <div className="pacotes-section-title">🎁 Apps</div>
              <div className="pacotes-apps-grid">
                {APPS_ADICIONAIS.map((app) => (
                  <div key={app.key} className={`pacotes-app-card pacotes-app-${app.key}`}>
                    <div className="pacotes-app-header">
                      <span className="pacotes-app-name">{app.nome}</span>
                      <span className="pacotes-app-price">R$ {app.preco.toFixed(2).replace('.', ',')}/mês</span>
                    </div>
                    <ul className="pacotes-app-list">
                      {app.itens.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---- ABA EVENTO / ATIVIDADE DO MÊS ---- */}
        {aba === "evento" && (
          <div>
            {contextoTipo === "evento" && !eventoAtual ? (
              <div className="empty" style={{ padding: "48px 0", textAlign: "center" }}>Nenhum evento selecionado.</div>
            ) : (
              <>
                {contextoTipo === "evento" && (
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
                )}

                {contextoTipo === "mes" && (
                  <div className="ev-info-card">
                    <div className="ev-info-row">
                      <span className="ev-info-label">Mês</span>
                      <span className="ev-info-value" style={{ fontWeight: 700 }}>{mesReferenciaLabel(mesSelecionado)}</span>
                    </div>
                    <div className="ev-info-row">
                      <span className="ev-info-label">Total leads</span>
                      <span className="ev-info-value" style={{ fontWeight: 700, color: "var(--rj-blue)" }}>{totalLeadsEvento}</span>
                    </div>
                  </div>
                )}

                {contextoTipo === "evento" && mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-mapa">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Abrir no Maps
                  </a>
                )}

                {contextoTipo === "qrcode" ? (
                  <div className="ev-info-card">
                    <div className="ev-info-row">
                      <span className="ev-info-label">Total de leads de captação digital</span>
                      <span className="ev-info-value" style={{ fontWeight: 700, color: "var(--rj-blue)" }}>{leadsDoContexto.length}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      Placar da equipe
                      {rankingLoading && <span style={{ width: 12, height: 12, border: "2px solid var(--text-3)", borderTopColor: "var(--yellow,#ffcb00)", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
                    </div>
                    {ranking.length === 0 && !rankingLoading ? (
                      <div style={{ color: "var(--text-3)", fontSize: 14, textAlign: "center", padding: "20px 0" }}>Nenhum lead registrado ainda.</div>
                    ) : ranking.length === 0 ? (
                      <div style={{ color: "var(--text-3)", fontSize: 14, textAlign: "center", padding: "20px 0" }}>Carregando placar…</div>
                    ) : (
                      <div className="ranking-list">
                        {ranking.map((item, i) => (
                          <div key={item.nome} ref={item.nome === session.vendedorNome ? meRef : null} className={"ranking-item" + (item.nome === session.vendedorNome ? " me" : "")}>
                            <div className="ranking-header">
                              <span className={"ranking-pos" + (i < 3 ? " " + posColors[i] : "")}>{i + 1}º</span>
                              <span className="ranking-name">{item.nome}{item.nome === session.vendedorNome && <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>(você)</span>}</span>
                              <span className="ranking-count">
                                {item.total}
                                {item.total >= META_OURO ? " 🥇" : item.total >= META_PRATA ? " 🥈" : item.total >= META_BRONZE ? " 🥉" : ""}
                              </span>
                            </div>
                            <div className="ranking-bar-track">
                              <div className="ranking-bar-fill" style={{ width: Math.round((item.total / maxRanking) * 100) + "%" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ width: "100%", marginTop: 16, fontSize: 13 }}
                  onClick={() => setShowPacotes((v) => !v)}
                >
                  {showPacotes ? "▲ Ocultar tabela de preços" : "▼ Ver tabela de preços"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Barra de navegação inferior */}
      <nav className="vend-bottom-nav">
        <button className={"vend-nav-btn" + (aba === "registrar" ? " active" : "")} onClick={() => setAba("registrar")}>
          <Icon name="plus" size={22} stroke={aba === "registrar" ? "#ffcb00" : "#5a7a9a"} strokeWidth={1.8} />
          Registrar
        </button>
        <button className={"vend-nav-btn" + (aba === "meus-leads" ? " active" : "")} onClick={() => { setAba("meus-leads"); setEditandoId(null); setConfirmandoDelId(null); }}>
          <Icon name="person" size={22} stroke={aba === "meus-leads" ? "#ffcb00" : "#5a7a9a"} strokeWidth={1.8} />
          Meus Leads
          {leadsDoContexto.length > 0 && <span className="vend-nav-badge">{leadsDoContexto.length}</span>}
        </button>
        <button className={"vend-nav-btn" + (aba === "evento" ? " active" : "")} onClick={() => setAba("evento")}>
          <Icon name="calendar" size={22} stroke={aba === "evento" ? "#ffcb00" : "#5a7a9a"} strokeWidth={1.8} />
          Evento
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
