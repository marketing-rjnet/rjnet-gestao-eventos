import React, { useState, useContext, createContext, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Chart, registerables } from 'chart.js';
import './index.css';

Chart.register(...registerables);


      /* ============================================================
         SVG ICON SYSTEM — stroke-based, geometric, clean
         ============================================================ */
      const Icon = ({ name, size = 16, stroke = "currentColor", strokeWidth = 1.6 }) => {
        const s = { width: size, height: size, display: "inline-block", verticalAlign: "middle", flexShrink: 0 };
        const p = { fill: "none", stroke, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };
        const paths = {
          // Calendar
          calendar: <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>,
          // Box / Package
          box: <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
          // People / Users
          users: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>,
          // Briefcase / Team
          briefcase: <svg style={s} viewBox="0 0 24 24" {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
          // Pin / Location
          pin: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
          // Sun
          sun: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
          // Moon
          moon: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
          // X / Close
          x: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
          // Arrow left / Back
          back: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
          // Plus
          plus: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
          // Circle dot — status
          dot_green: <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#22c55e"/></svg>,
          dot_yellow: <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#f5c000"/></svg>,
          dot_red: <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#ef4444"/></svg>,
          // Chart bar
          chart: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
          // Lead / person
          person: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="8" r="4"/><path d="M4 20v-1a8 8 0 0 1 16 0v1"/></svg>,
          // Arrow right
          arrow_right: <svg style={s} viewBox="0 0 24 24" {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
          // Search / magnifier
          search: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
          // Check circle
          check_circle: <svg style={s} viewBox="0 0 24 24" {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
          // X circle
          x_circle: <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
        };
        return paths[name] || null;
      };

      /* ============================================================
         MOCK DATA (Supabase-ready structures)
         ============================================================ */
      const MOCK_MATERIAIS = [
        { id: "m1", nome: "Wind Banner 2m", quantidade: 6, descricao: "Banner vertical 2 metros" },
        { id: "m2", nome: "Wind Banner 5m", quantidade: 4, descricao: "Banner vertical 5 metros" },
        { id: "m3", nome: "Tenda Inflável", quantidade: 2 },
        { id: "m4", nome: "Balão Inflável", quantidade: 3 },
        { id: "m5", nome: "Placa Hotspot", quantidade: 10 },
        { id: "m6", nome: "Rádio Wi-Fi", quantidade: 8 },
        { id: "m7", nome: "Banner Gradil", quantidade: 12 },
        { id: "m8", nome: "Banner Poste", quantidade: 15 },
        { id: "m9", nome: 'Banner "Como Acessar"', quantidade: 8 },
        { id: "m10", nome: 'Banner "Evento Conectado RJNet"', quantidade: 6 },
      ];

      const MOCK_VENDEDORES = [
        { id: "v1", nome: "Carlos Silva",   cpf: "",  ativo: true },
        { id: "v2", nome: "Ana Oliveira",   cpf: "",  ativo: true },
        { id: "v3", nome: "Marcos Lima",    cpf: "",  ativo: true },
        { id: "v4", nome: "Juliana Costa",  cpf: "",  ativo: true },
        { id: "v5", nome: "Thiago",         cpf: "",  ativo: true },
        { id: "v6", nome: "Ramon",          cpf: "",  ativo: true },
      ];

      const MOCK_EVENTOS = [
        {
          id: "e1", nome: "Festa do Pescador - Angra",
          local: "Praia do Anil, Angra dos Reis",
          dataInicio: "2025-06-07", dataFim: "2025-06-08",
          status: "ativo", tipo: "presenca_comercial",
          observacoes: "Evento com grande público esperado. Levar estrutura completa.",
          materiais: [
            { materialId: "m1", quantidade: 3, estadoSaida: "ok", retornado: false },
            { materialId: "m5", quantidade: 4, estadoSaida: "ok", retornado: false },
            { materialId: "m7", quantidade: 6, estadoSaida: "ok", retornado: false },
            { materialId: "m10", quantidade: 2, estadoSaida: "ok", retornado: false },
          ],
          criadoEm: "2025-05-28T10:00:00Z",
        },
        {
          id: "e2", nome: "Feira de Tecnologia RJ",
          local: "Centro de Convenções, Rio de Janeiro",
          dataInicio: "2025-06-14", dataFim: "2025-06-15",
          status: "planejado", tipo: "ativacao_especial",
          materiais: [], criadoEm: "2025-06-01T09:00:00Z",
        },
      ];

      const MOCK_LEADS = [
        {
          id: "l1", eventoId: "e1", vendedorNome: "Carlos Silva",
          nome: "João Pereira", telefone: "(24) 99876-5432",
          endereco: "Rua das Flores, 45 - Angra dos Reis",
          servicoInteresse: "internet_residencial",
          temperatura: "quente",
          observacao: "Muito interesse, mora em área com cobertura",
          criadoEm: "2025-06-07T14:30:00Z",
        },
      ];

      const META_DIARIA = 15;

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

      /* ============================================================
         LABEL HELPERS
         ============================================================ */
      const SERVICO_LABEL = {
        internet_residencial: "Internet Residencial",
        internet_empresarial: "Internet Empresarial",
        rjnet_movel: "RJNET Móvel",
        streamings: "Streamings",
        outro: "Outro",
      };
      const SERVICO_SHORT = {
        internet_residencial: "Int. Res.",
        internet_empresarial: "Int. Emp.",
        rjnet_movel: "RJ Móvel",
        streamings: "Streamings",
        outro: "Outro",
      };
      const TIPO_LABEL = {
        sinalizacao: "Sinalização",
        presenca_comercial: "Presença Comercial",
        ativacao_especial: "Ativação Especial",
      };
      const STATUS_LABEL = { ativo: "Ativo", planejado: "Planejado", encerrado: "Encerrado" };
      const servicoLabel = (s) => SERVICO_LABEL[s] || s;
      const tipoLabel = (t) => TIPO_LABEL[t] || t;
      const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
      const fmtDateLong = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";
      const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

      const CHART_COLORS = ["#f5c000", "#22c55e", "#ef4444", "#666666"];
      Chart.defaults.color = "#666";
      Chart.defaults.font.family = "DM Sans, sans-serif";

      /* ============================================================
         APP CONTEXT (state + Supabase-ready actions)
         ============================================================ */
      const AppContext = createContext(null);
      const useApp = () => {
        const ctx = useContext(AppContext);
        if (!ctx) throw new Error("useApp must be inside AppProvider");
        return ctx;
      };

      // Helpers de persistência local — substitua por chamadas Supabase para sincronização entre dispositivos
      function usePersisted(key, fallback) {
        const [state, setState] = useState(() => {
          try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
          } catch { return fallback; }
        });
        const set = (v) => {
          setState((prev) => {
            const next = typeof v === "function" ? v(prev) : v;
            try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
            return next;
          });
        };
        return [state, set];
      }

      function AppProvider({ children }) {
        const [materiais, setMateriais] = usePersisted("rjnet_materiais", MOCK_MATERIAIS);
        const [eventos, setEventos] = usePersisted("rjnet_eventos", MOCK_EVENTOS);
        const [leads, setLeads] = usePersisted("rjnet_leads", MOCK_LEADS);
        const [vendedores, setVendedores] = usePersisted("rjnet_vendedores", MOCK_VENDEDORES);

        const value = {
          materiais, eventos, leads, vendedores,
          addEvento: (e) => setEventos((p) => [...p, { ...e, id: "e" + Date.now(), criadoEm: new Date().toISOString() }]),
          updateEvento: (id, patch) => setEventos((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e))),
          removeEvento: (id) => setEventos((p) => p.filter((e) => e.id !== id)),
          addLead: (l) => setLeads((p) => [...p, { ...l, id: "l" + Date.now(), criadoEm: new Date().toISOString() }]),
          updateLead: (id, patch) => setLeads((p) => p.map((l) => l.id === id ? { ...l, ...patch } : l)),
          removeLead: (id) => setLeads((p) => p.filter((l) => l.id !== id)),
          addMaterial: (m) => setMateriais((p) => [...p, { ...m, id: "m" + Date.now() }]),
          updateMaterial: (id, patch) => setMateriais((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m))),
          addMaterialEvento: (eventoId, materialId, quantidade) =>
            setEventos((p) => p.map((e) => e.id !== eventoId ? e : {
              ...e, materiais: [...e.materiais, { materialId, quantidade: Number(quantidade), estadoSaida: "ok", retornado: false }]
            })),
          removeMaterialEvento: (eventoId, idx) =>
            setEventos((p) => p.map((e) => e.id !== eventoId ? e : {
              ...e, materiais: e.materiais.filter((_, i) => i !== idx)
            })),
          toggleRetornadoEvento: (eventoId, idx) =>
            setEventos((p) => p.map((e) => e.id !== eventoId ? e : {
              ...e, materiais: e.materiais.map((m, i) => i === idx ? { ...m, retornado: !m.retornado } : m)
            })),
          addVendedor: (nome) => setVendedores((p) => [...p, { id: "v" + Date.now(), nome, ativo: true }]),
          updateVendedor: (id, patch) => setVendedores((p) => p.map((v) => v.id === id ? { ...v, ...patch } : v)),
          toggleVendedor: (id) => setVendedores((p) => p.map((v) => (v.id === id ? { ...v, ativo: !v.ativo } : v))),
          getLeadsEvento: (eid) => leads.filter((l) => l.eventoId === eid),
          getEventosAtivos: () => eventos.filter((e) => e.status === "ativo"),
          getMateriaisDisponiveis: () =>
            materiais.map((mat) => {
              const emCampo = eventos
                .filter((e) => e.status === "ativo" || e.status === "planejado")
                .flatMap((e) => e.materiais)
                .filter((mm) => mm.materialId === mat.id && !mm.retornado)
                .reduce((acc, mm) => acc + mm.quantidade, 0);
              return { material: mat, emCampo, disponivel: mat.quantidade - emCampo };
            }),
        };
        return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
      }

      const AUTH = {
        marketing: { user: "marketing", pass: "mkt2025" },
        comercial: { user: "comercial", pass: "com2025" },
      };

      /* ============================================================
         CHART COMPONENTS (useEffect + useRef + destroy cleanup)
         ============================================================ */
      function ChartView({ type, data, options }) {
        const ref = useRef(null);
        const inst = useRef(null);
        useEffect(() => {
          if (!ref.current) return;
          inst.current = new Chart(ref.current, {
            type,
            data,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              ...options,
            },
          });
          return () => { if (inst.current) inst.current.destroy(); };
        }, [JSON.stringify(data), type, JSON.stringify(options)]);
        return <canvas ref={ref} />;
      }

      const darkScale = {
        x: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" } },
        y: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" }, beginAtZero: true },
      };

      /* ============================================================
         LOGIN
         ============================================================ */
      function Login({ onLogin, darkMode, toggleDark }) {
        const { vendedores } = useApp();
        const [stage, setStage] = useState("login");
        const [u, setU] = useState("");
        const [p, setP] = useState("");
        const [err, setErr] = useState("");

        if (stage === "select_vendedor") {
          return (
            <div className="login-bg">
              <div className="login-card">
                <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"90px",marginBottom:"8px"}} />
                <p className="login-tag">Gestão de Eventos</p>
                <p className="login-sub">Selecione seu perfil</p>
                <div className="vendedor-list">
                  {vendedores.filter((v) => v.ativo).map((v) => (
                    <button key={v.id} className="vendedor-btn" onClick={() => onLogin({ role: "comercial", vendedorNome: v.nome })}>
                      <span className="vendedor-avatar">{v.nome.charAt(0)}</span>
                      {v.nome}
                    </button>
                  ))}
                </div>
                <button className="back-btn" onClick={() => setStage("login")} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="back" size={15} /> Voltar</button>
              </div>
            </div>
          );
        }

        const submit = (e) => {
          e.preventDefault();
          setErr("");
          if (u === AUTH.marketing.user && p === AUTH.marketing.pass) onLogin({ role: "marketing" });
          else if (u === AUTH.comercial.user && p === AUTH.comercial.pass) setStage("select_vendedor");
          else setErr("Usuário ou senha incorretos.");
        };

        return (
          <div className="login-bg">
            <div className="login-card">
              <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"90px",marginBottom:"8px"}} />
              <p className="login-tag">Gestão de Eventos</p>
              <p className="login-sub">Sistema de Gestão de Eventos</p>
              <form onSubmit={submit} className="login-form">
                <div className="field-group">
                  <label>Usuário</label>
                  <input value={u} onChange={(e) => setU(e.target.value)} placeholder="marketing / comercial" autoComplete="username" />
                </div>
                <div className="field-group">
                  <label>Senha</label>
                  <input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </div>
                {err && <p className="error-msg">{err}</p>}
                <button type="submit" className="login-btn">Entrar</button>
              </form>
              <p className="login-hint">Angra dos Reis · RJ</p>
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button className="theme-toggle" onClick={toggleDark} title="Alternar tema" style={{ margin: "0 auto" }}>
                  <Icon name={darkMode ? "sun" : "moon"} size={17} />
                </button>
              </div>
            </div>
          </div>
        );
      }

      /* ============================================================
         EVENT FORM MODAL
         ============================================================ */
      function EventModal({ onClose, evento }) {
        const { addEvento, updateEvento } = useApp();
        const [f, setF] = useState({
          nome: evento?.nome || "",
          local: evento?.local || "",
          dataInicio: evento?.dataInicio || "",
          dataFim: evento?.dataFim || "",
          tipo: evento?.tipo || "sinalizacao",
          status: evento?.status || "planejado",
          observacoes: evento?.observacoes || "",
        });
        const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
        const submit = (e) => {
          e.preventDefault();
          if (evento) updateEvento(evento.id, f);
          else addEvento({ ...f, materiais: [] });
          onClose();
        };
        return (
          <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{evento ? "Editar Evento" : "Novo Evento"}</h2>
                <button className="modal-close" onClick={onClose}><Icon name="x" size={18} /></button>
              </div>
              <form onSubmit={submit} className="modal-form">
                <div className="field-group">
                  <label>Nome do Evento *</label>
                  <input required value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Festa do Pescador" />
                </div>
                <div className="field-group">
                  <label>Local *</label>
                  <input required value={f.local} onChange={(e) => set("local", e.target.value)} placeholder="Endereço / Praça / Espaço" />
                </div>
                <div className="field-row">
                  <div className="field-group">
                    <label>Data Início *</label>
                    <input required type="date" value={f.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label>Data Fim *</label>
                    <input required type="date" value={f.dataFim} onChange={(e) => set("dataFim", e.target.value)} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field-group">
                    <label>Tipo</label>
                    <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
                      <option value="sinalizacao">Sinalização</option>
                      <option value="presenca_comercial">Presença Comercial</option>
                      <option value="ativacao_especial">Ativação Especial</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Status</label>
                    <select value={f.status} onChange={(e) => set("status", e.target.value)}>
                      <option value="planejado">Planejado</option>
                      <option value="ativo">Ativo</option>
                      <option value="encerrado">Encerrado</option>
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label>Observações</label>
                  <textarea rows="3" value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Detalhes adicionais..." />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                  <button type="submit" className="btn-primary">{evento ? "Salvar" : "Criar Evento"}</button>
                </div>
              </form>
            </div>
          </div>
        );
      }

      /* ============================================================
         MATERIAL MODAL
         ============================================================ */
      function MaterialModal({ onClose }) {
        const { addMaterial } = useApp();
        const [f, setF] = useState({ nome: "", quantidade: 1, descricao: "" });
        const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
        const submit = (e) => {
          e.preventDefault();
          addMaterial({ ...f, quantidade: Number(f.quantidade) });
          onClose();
        };
        return (
          <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Adicionar Material</h2>
                <button className="modal-close" onClick={onClose}><Icon name="x" size={18} /></button>
              </div>
              <form onSubmit={submit} className="modal-form">
                <div className="field-group">
                  <label>Nome *</label>
                  <input required value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Wind Banner 2m" autoFocus />
                </div>
                <div className="field-group">
                  <label>Quantidade *</label>
                  <input required type="number" min="1" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Descrição</label>
                  <input value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Opcional" />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                  <button type="submit" className="btn-primary">Adicionar</button>
                </div>
              </form>
            </div>
          </div>
        );
      }

      /* ============================================================
         SHARED SMALL COMPONENTS
         ============================================================ */
      const StatusBadge = ({ s }) => (
        <span className={"badge badge-" + s}>{STATUS_LABEL[s] || s}</span>
      );
      const TipoBadge = ({ t }) => <span className="badge badge-tipo">{tipoLabel(t)}</span>;

      function Kpi({ label, value, icon, alert }) {
        return (
          <div className={"kpi" + (alert ? " alert" : "")}>
            <div className="kpi-label">{icon && <Icon name={icon} size={14} stroke="var(--text-3)" />}{label}</div>
            <div className="kpi-value">{value}</div>
          </div>
        );
      }

      /* ============================================================
         DASHBOARD (top of Eventos tab)
         ============================================================ */
      function Dashboard() {
        const { eventos, leads, vendedores, getMateriaisDisponiveis } = useApp();
        const ativos = eventos.filter((e) => e.status === "ativo").length;
        const criticos = getMateriaisDisponiveis().filter((m) => m.disponivel <= 0).length;
        const vendAtivos = vendedores.filter((v) => v.ativo).length;

        const dist = useMemo(() => {
          const c = { fibra_residencial: 0, fibra_empresarial: 0, hotspot: 0, outro: 0 };
          leads.forEach((l) => { c[l.servicoInteresse] = (c[l.servicoInteresse] || 0) + 1; });
          return c;
        }, [leads]);

        const doughData = {
          labels: ["Fibra Res", "Fibra Emp", "Hotspot", "Outro"],
          datasets: [{
            data: [dist.fibra_residencial, dist.fibra_empresarial, dist.hotspot, dist.outro],
            backgroundColor: CHART_COLORS,
            borderColor: "#1a1a1a",
            borderWidth: 2,
          }],
        };

        const upcoming = [...eventos].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)).slice(0, 3);

        return (
          <div className="section">
            <div className="grid-kpi">
              <Kpi label="Eventos Ativos" value={ativos} icon="calendar" />
              <Kpi label="Total Leads" value={leads.length} icon="users" />
              <Kpi label="Materiais Críticos" value={criticos} icon="box" alert={criticos > 0} />
              <Kpi label="Vendedores Ativos" value={vendAtivos} icon="briefcase" />
            </div>
            <div className="grid-2 dashboard-row" style={{ marginTop: 16 }}>
              <div className="card">
                <div className="section-title">Leads por Serviço</div>
                {leads.length === 0 ? (
                  <div className="empty">Nenhum lead registrado.</div>
                ) : (
                  <div className="chart-box">
                    <ChartView type="doughnut" data={doughData} options={{
                      cutout: "62%",
                      plugins: { legend: { position: "bottom", labels: { color: "#b0b0b0", padding: 14, usePointStyle: true } } },
                    }} />
                  </div>
                )}
              </div>
              <div className="card">
                <div className="section-title">Próximos Eventos</div>
                {upcoming.length === 0 ? <div className="empty">Sem eventos.</div> : upcoming.map((e) => (
                  <div key={e.id} className="ev-meta" style={{ justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{e.nome}</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", display:"flex", alignItems:"center", gap:4 }}><Icon name="calendar" size={12} stroke="var(--text-3)" />{fmtDate(e.dataInicio)} – {fmtDate(e.dataFim)}</div>
                    </div>
                    <StatusBadge s={e.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }

      /* ============================================================
         EVENTOS TAB
         ============================================================ */
      function EventosTab({ onOpen }) {
        const { eventos, getLeadsEvento, leads } = useApp();
        const [filter, setFilter] = useState("todos");
        const [showModal, setShowModal] = useState(false);

        const filtered = eventos.filter((e) => filter === "todos" || e.status === filter);
        const vendoresDoEvento = (eid) => [...new Set(getLeadsEvento(eid).map((l) => l.vendedorNome))];

        return (
          <div className="page">
            <div className="page-head">
              <div className="chips">
                {["todos", "ativo", "planejado", "encerrado"].map((c) => (
                  <button key={c} className={"chip" + (filter === c ? " active" : "")} onClick={() => setFilter(c)}>
                    {c === "todos" ? "Todos" : STATUS_LABEL[c]}
                  </button>
                ))}
              </div>
              <button className="btn-primary" onClick={() => setShowModal(true)}>+ Novo Evento</button>
            </div>

            {filtered.length === 0 ? <div className="empty">Nenhum evento encontrado.</div> : (
              <div className="event-grid">
                {filtered.map((e) => {
                  const vs = vendoresDoEvento(e.id);
                  return (
                    <div key={e.id} className="event-card" onClick={() => onOpen(e.id)}>
                      <span className="ev-status"><StatusBadge s={e.status} /></span>
                      <div className="ev-name">{e.nome}</div>
                      <div className="ev-meta"><Icon name="pin" size={13} stroke="var(--text-3)" /> {e.local}</div>
                      <div className="ev-meta"><Icon name="calendar" size={13} stroke="var(--text-3)" /> {fmtDate(e.dataInicio)} – {fmtDate(e.dataFim)}</div>
                      <div style={{ marginTop: 10 }}><TipoBadge t={e.tipo} /></div>
                      <div className="ev-foot">
                        <span className="ev-leads"><Icon name="users" size={13} stroke="var(--text-3)" /> <b>{getLeadsEvento(e.id).length}</b> leads</span>
                        <div className="avatars">
                          {vs.slice(0, 4).map((n, i) => <div key={i} className="av">{initials(n)}</div>)}
                          {vs.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Dashboard />
            {showModal && <EventModal onClose={() => setShowModal(false)} />}
          </div>
        );
      }

      /* ============================================================
         EVENT DETAIL VIEW
         ============================================================ */
      function EventDetail({ eventoId, onBack }) {
        const { eventos, materiais, getLeadsEvento, getMateriaisDisponiveis,
                addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento, updateEvento, removeEvento } = useApp();
        const ev = eventos.find((e) => e.id === eventoId);
        if (!ev) return null;

        const evLeads = getLeadsEvento(eventoId);
        const disp = getMateriaisDisponiveis();
        const matName = (id) => materiais.find((m) => m.id === id)?.nome || id;
        const emCampo = ev.materiais.filter((m) => !m.retornado).reduce((a, m) => a + m.quantidade, 0);

        // Add material form state
        const [addMatId, setAddMatId] = useState("");
        const [addMatQtd, setAddMatQtd] = useState(1);
        const [showAddMat, setShowAddMat] = useState(false);
        const [editEvento, setEditEvento] = useState(false);

        // Materials not yet in the event
        const matsDisponiveis = materiais.filter(
          (m) => !ev.materiais.find((em) => em.materialId === m.id)
        );

        const handleAddMat = (e) => {
          e.preventDefault();
          if (!addMatId) return;
          addMaterialEvento(eventoId, addMatId, addMatQtd);
          setAddMatId(""); setAddMatQtd(1); setShowAddMat(false);
        };

        const porVendedor = useMemo(() => {
          const c = {};
          evLeads.forEach((l) => { c[l.vendedorNome] = (c[l.vendedorNome] || 0) + 1; });
          return c;
        }, [evLeads]);

        const barData = {
          labels: Object.keys(porVendedor),
          datasets: [{ label: "Leads", data: Object.values(porVendedor), backgroundColor: "#f5c000", borderRadius: 6 }],
        };

        return (
          <div className="page">
            {/* Back + Edit + Delete */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 14 }}>
              <button className="back-btn" onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <Icon name="back" size={15} /> Voltar para Eventos
              </button>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-ghost" style={{ fontSize:13 }} onClick={() => setEditEvento(true)}>
                  Editar Evento
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize:13, color:"var(--red)", borderColor:"var(--red)" }}
                  onClick={() => {
                    if (confirm(`Excluir o evento "${ev.nome}"? Esta ação também removerá todos os leads vinculados a ele.`)) {
                      removeEvento(eventoId);
                      onBack();
                    }
                  }}
                >
                  <Icon name="x" size={14} stroke="var(--red)" /> Excluir Evento
                </button>
              </div>
            </div>

            <div className="detail-hero">
              <h1>{ev.nome}</h1>
              <StatusBadge s={ev.status} />
              <TipoBadge t={ev.tipo} />
            </div>

            <div className="grid-2" style={{ marginTop: 18 }}>
              <div className="card">
                <div className="section-title">Informações</div>
                <div className="info-line"><span className="k">Local</span><span className="v" style={{ display:"flex", alignItems:"center", gap:5 }}><Icon name="pin" size={13} stroke="var(--text-3)" />{ev.local}</span></div>
                <div className="info-line"><span className="k">Datas</span><span className="v" style={{ display:"flex", alignItems:"center", gap:5 }}><Icon name="calendar" size={13} stroke="var(--text-3)" />{fmtDateLong(ev.dataInicio)} → {fmtDateLong(ev.dataFim)}</span></div>
                <div className="info-line"><span className="k">Observações</span><span className="v">{ev.observacoes || "—"}</span></div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div className="mini-stat"><div className="ms-v">{evLeads.length}</div><div className="ms-l">Leads captados</div></div>
                <div className="mini-stat"><div className="ms-v">{emCampo}</div><div className="ms-l">Materiais em campo</div></div>
              </div>
            </div>

            {/* ── MATERIAIS ── */}
            <div className="section">
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <span className="section-title" style={{ marginBottom:0 }}>Materiais</span>
                <button className="btn-primary" style={{ fontSize:12, padding:"7px 14px" }}
                  onClick={() => setShowAddMat((v) => !v)}>
                  {showAddMat ? "Cancelar" : "+ Adicionar Material"}
                </button>
              </div>

              {/* Inline add form */}
              {showAddMat && (
                <form onSubmit={handleAddMat} className="inline-form-card" style={{ marginBottom:14 }}>
                  <div className="field-row" style={{ alignItems:"flex-end", gap:10 }}>
                    <div className="field-group" style={{ marginBottom:0, flex:2 }}>
                      <label>Material *</label>
                      <select required value={addMatId} onChange={(e) => setAddMatId(e.target.value)}>
                        <option value="">Selecione...</option>
                        {matsDisponiveis.map((m) => {
                          const d = disp.find((x) => x.material.id === m.id);
                          return <option key={m.id} value={m.id}>{m.nome} (disponível: {d ? d.disponivel : 0})</option>;
                        })}
                        {matsDisponiveis.length === 0 && <option disabled>Todos os materiais já adicionados</option>}
                      </select>
                    </div>
                    <div className="field-group" style={{ marginBottom:0, flex:1 }}>
                      <label>Quantidade *</label>
                      <input type="number" min="1" required value={addMatQtd} onChange={(e) => setAddMatQtd(e.target.value)} />
                    </div>
                    <button type="submit" className="btn-primary" style={{ height:42, padding:"0 18px", whiteSpace:"nowrap" }}>Confirmar</button>
                  </div>
                </form>
              )}

              {ev.materiais.length === 0 ? (
                <div className="empty">Nenhum material vinculado. Clique em + Adicionar Material para começar.</div>
              ) : (
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Qtd.</th>
                        <th>Estoque Total</th>
                        <th>Disponível</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.materiais.map((m, i) => {
                        const d = disp.find((x) => x.material.id === m.materialId);
                        const dv = d ? d.disponivel : 0;
                        const cls = dv <= 0 ? "crit" : dv <= 3 ? "warn" : "ok";
                        return (
                          <tr key={i} style={{ opacity: m.retornado ? .45 : 1 }}>
                            <td className="strong" style={{ textDecoration: m.retornado ? "line-through" : "none" }}>
                              {matName(m.materialId)}
                            </td>
                            <td>{m.quantidade}</td>
                            <td>{d ? d.material.quantidade : "—"}</td>
                            <td><span className={"badge badge-" + cls}>{dv}</span></td>
                            <td>
                              <button
                                onClick={() => toggleRetornadoEvento(eventoId, i)}
                                className={"badge " + (m.retornado ? "badge-encerrado" : "badge-ativo")}
                                style={{ cursor:"pointer", border:"none" }}
                                title={m.retornado ? "Marcar como em campo" : "Marcar como retornado"}
                              >
                                {m.retornado ? "Retornado" : "Em campo"}
                              </button>
                            </td>
                            <td>
                              <button
                                onClick={() => { if(confirm("Remover este material do evento?")) removeMaterialEvento(eventoId, i); }}
                                style={{ color:"var(--red)", fontSize:13, padding:"4px 8px" }}
                                title="Remover material"
                              >
                                <Icon name="x" size={14} stroke="var(--red)" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── LEADS ── */}
            <div className="section">
              <div className="section-title">Leads Captados</div>
              {evLeads.length === 0 ? <div className="empty">Nenhum lead captado neste evento.</div> : (
                <>
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="section-title">Leads por Vendedor</div>
                    <div className="chart-box sm">
                      <ChartView type="bar" data={barData} options={{
                        plugins: { legend: { display: false } },
                        scales: darkScale,
                      }} />
                    </div>
                  </div>
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Serviço</th><th>Vendedor</th></tr></thead>
                      <tbody>
                        {evLeads.map((l) => (
                          <tr key={l.id}>
                            <td className="strong">{l.nome}</td>
                            <td className="mono">{l.telefone}</td>
                            <td>{l.endereco}</td>
                            <td><span className="badge badge-tipo">{servicoLabel(l.servicoInteresse)}</span></td>
                            <td>{l.vendedorNome}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {editEvento && <EventModal evento={ev} onClose={() => setEditEvento(false)} />}
          </div>
        );
      }

      /* ============================================================
         ESTOQUE TAB
         ============================================================ */
      function EstoqueTab() {
        const { getMateriaisDisponiveis } = useApp();
        const [showModal, setShowModal] = useState(false);
        const list = getMateriaisDisponiveis();
        const totalItens = list.reduce((a, m) => a + m.material.quantidade, 0);
        const emCampo = list.reduce((a, m) => a + m.emCampo, 0);
        const crit = list.filter((m) => m.disponivel <= 0);
        const warn = list.filter((m) => m.disponivel >= 1 && m.disponivel <= 3);
        const ok = list.filter((m) => m.disponivel >= 4);

        const Group = ({ title, dot, cls, rows }) => rows.length === 0 ? null : (
          <div className="stock-group">
            <h3><Icon name={dot} size={10} /> {title} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({rows.length})</span></h3>
            {rows.map((m) => (
              <div key={m.material.id} className={"stock-row " + cls}>
                <div className="sr-main">
                  <div className="sr-name">{m.material.nome}</div>
                  <div className="sr-desc">{m.material.descricao || "Sem descrição"}</div>
                </div>
                <div className="sr-num"><b>{m.material.quantidade}</b>total</div>
                <div className="sr-num"><b>{m.emCampo}</b>em campo</div>
                <div className="sr-num">
                  <span className={"badge badge-" + (cls === "crit" ? "crit" : cls === "warn" ? "warn" : "ok")}>{m.disponivel} disp.</span>
                </div>
              </div>
            ))}
          </div>
        );

        return (
          <div className="page">
            <div className="page-head">
              <div>
                <div className="page-title">Estoque</div>
                <p className="tab-desc">Controle de materiais e disponibilidade em tempo real.</p>
              </div>
              <button className="btn-primary" onClick={() => setShowModal(true)}>+ Adicionar Material</button>
            </div>

            <div className="grid-kpi-3">
              <Kpi label="Total Tipos" value={list.length} icon="box" />
              <Kpi label="Total Itens" value={totalItens} icon="🔢" />
              <Kpi label="Em Campo" value={emCampo} icon="🚚" />
            </div>

            <Group title="CRÍTICO" dot="dot_red" cls="crit" rows={crit} />
            <Group title="ATENÇÃO" dot="dot_yellow" cls="warn" rows={warn} />
            <Group title="OK" dot="dot_green" cls="ok" rows={ok} />

            {showModal && <MaterialModal onClose={() => setShowModal(false)} />}
          </div>
        );
      }

      /* ============================================================
         LEADS TAB
         ============================================================ */
      function LeadsTab() {
        const { leads, eventos, vendedores } = useApp();
        const [fEvento, setFEvento] = useState("");
        const [fVend, setFVend] = useState("");
        const [fServ, setFServ] = useState("");
        const evName = (id) => eventos.find((e) => e.id === id)?.nome || id;

        const filtered = leads.filter((l) =>
          (!fEvento || l.eventoId === fEvento) &&
          (!fVend || l.vendedorNome === fVend) &&
          (!fServ || l.servicoInteresse === fServ)
        );

        const byService = (s) => leads.filter((l) => l.servicoInteresse === s).length;

        const exportarCSV = () => {
          const dados = fEvento ? leads.filter((l) => l.eventoId === fEvento) : leads;
          if (dados.length === 0) return;
          const nomeEvento = fEvento ? evName(fEvento) : "todos_eventos";
          const cabecalho = ["Nome", "CPF", "Telefone", "Endereço", "Serviço", "Temperatura", "Já Cliente RJNet", "Vendedor", "Evento", "Observação", "Cadastrado em"];
          const linhas = dados.map((l) => [
            l.nome, l.cpf || "", l.telefone, l.endereco || "",
            servicoLabel(l.servicoInteresse), l.temperatura,
            l.jaClienteRjnet ? "Sim" : "Não",
            l.vendedorNome, evName(l.eventoId),
            (l.observacao || "").replace(/"/g, '""'),
            new Date(l.criadoEm).toLocaleString("pt-BR"),
          ]);
          const csv = [cabecalho, ...linhas].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
          const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `leads_${nomeEvento.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        const porEvento = useMemo(() => {
          const c = {};
          leads.forEach((l) => { c[l.eventoId] = (c[l.eventoId] || 0) + 1; });
          return c;
        }, [leads]);

        const barData = {
          labels: Object.keys(porEvento).map(evName),
          datasets: [{ label: "Leads", data: Object.values(porEvento), backgroundColor: "#f5c000", borderRadius: 6 }],
        };

        return (
          <div className="page">
            <div className="page-head">
              <div>
                <div className="page-title">Leads</div>
                <p className="tab-desc">Todos os leads captados pela equipe comercial.</p>
              </div>
              <button
                className="btn-primary"
                style={{ display:"flex", alignItems:"center", gap:6, fontSize:13 }}
                onClick={exportarCSV}
                disabled={leads.length === 0}
                title={fEvento ? "Exportar leads do evento selecionado" : "Selecione um evento no filtro para exportar"}
              >
                ↓ Exportar CSV {fEvento ? `(${evName(fEvento)})` : "(selecione evento)"}
              </button>
            </div>

            <div className="grid-kpi">
              <Kpi label="Total" value={leads.length} icon="users" />
              <Kpi label="Fibra Res" value={byService("fibra_residencial")} icon="🏠" />
              <Kpi label="Fibra Emp" value={byService("fibra_empresarial")} icon="🏢" />
              <Kpi label="Hotspot" value={byService("hotspot")} icon="📶" />
            </div>

            <div className="card" style={{ marginTop: 18 }}>
              <div className="section-title">Leads por Evento</div>
              {leads.length === 0 ? <div className="empty">Sem dados.</div> : (
                <div className="chart-box">
                  <ChartView type="bar" data={barData} options={{
                    indexAxis: "y",
                    plugins: { legend: { display: false } },
                    scales: darkScale,
                  }} />
                </div>
              )}
            </div>

            <div className="section">
              <div className="filter-row">
                <select value={fEvento} onChange={(e) => setFEvento(e.target.value)}>
                  <option value="">Todos os eventos</option>
                  {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <select value={fVend} onChange={(e) => setFVend(e.target.value)}>
                  <option value="">Todos os vendedores</option>
                  {vendedores.map((v) => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                </select>
                <select value={fServ} onChange={(e) => setFServ(e.target.value)}>
                  <option value="">Todos os serviços</option>
                  {Object.keys(SERVICO_LABEL).map((s) => <option key={s} value={s}>{SERVICO_LABEL[s]}</option>)}
                </select>
              </div>

              {filtered.length === 0 ? <div className="empty">Nenhum lead encontrado.</div> : (
                <div className="tbl-wrap">
                  <table>
                    <thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Serviço</th><th>Evento</th><th>Vendedor</th></tr></thead>
                    <tbody>
                      {filtered.map((l) => (
                        <tr key={l.id}>
                          <td className="strong">{l.nome}</td>
                          <td className="mono">{l.telefone}</td>
                          <td>{l.endereco}</td>
                          <td><span className="badge badge-tipo">{servicoLabel(l.servicoInteresse)}</span></td>
                          <td>{evName(l.eventoId)}</td>
                          <td>{l.vendedorNome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      }

      /* ============================================================
         EQUIPE TAB
         ============================================================ */
      function EquipeTab() {
        const { vendedores, leads, eventos, addVendedor, updateVendedor, toggleVendedor } = useApp();
        const [showForm, setShowForm] = useState(false);
        const [novoNome, setNovoNome] = useState("");

        const submit = (e) => {
          e.preventDefault();
          if (novoNome.trim()) {
            addVendedor(novoNome.trim());
            setNovoNome(""); setShowForm(false);
          }
        };

        const leadsDoVendedor = (n) => leads.filter((l) => l.vendedorNome === n);

        return (
          <div className="page">
            <div className="page-head">
              <div>
                <div className="page-title">Equipe</div>
                <p className="tab-desc">Gerencie os perfis da equipe comercial. Vendedores ativos aparecem na tela de login do acesso Comercial.</p>
              </div>
              <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>+ Adicionar Vendedor</button>
            </div>

            {showForm && (
              <form onSubmit={submit} className="inline-form-card">
                <div className="field-row">
                  <div className="field-group">
                    <label>Nome completo *</label>
                    <input required value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Pedro Souza" autoFocus />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">Adicionar</button>
                </div>
              </form>
            )}

            <div className="vendor-grid">
              {vendedores.map((v) => {
                const vl = leadsDoVendedor(v.nome);
                const recent = [...eventos]
                  .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
                  .slice(-5)
                  .map((ev) => ({ ev, n: vl.filter((l) => l.eventoId === ev.id).length }));
                const hasData = recent.some((r) => r.n > 0);
                const barData = {
                  labels: recent.map((r) => fmtDate(r.ev.dataInicio)),
                  datasets: [{ data: recent.map((r) => r.n), backgroundColor: "#f5c000", borderRadius: 4 }],
                };
                return (
                  <div key={v.id} className="vendor-card">
                    <div className="v-av">{initials(v.nome)}</div>
                    <div className="v-name">{v.nome}</div>
                    <div className="v-big">{vl.length}</div>
                    <div className="v-cap">leads captados</div>
                    <div style={{ marginTop: 8 }}>
                      <span className={"badge " + (v.ativo ? "badge-ativo" : "badge-encerrado")}>{v.ativo ? "Ativo" : "Inativo"}</span>
                    </div>
                    {hasData && (
                      <div className="v-chart">
                        <ChartView type="bar" data={barData} options={{
                          plugins: { legend: { display: false }, tooltip: { enabled: true } },
                          scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
                        }} />
                      </div>
                    )}
                    <button className="btn-ghost vendor-toggle" onClick={() => toggleVendedor(v.id)}>
                      {v.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      /* ============================================================
         MARKETING APP SHELL
         ============================================================ */
      /* ============================================================
         CHECK-IN TAB — consulta de lead por CPF em um evento
         ============================================================ */
      function CheckinTab() {
        const { leads, eventos } = useApp();
        const [eventoId, setEventoId] = useState("");
        const [cpfInput, setCpfInput] = useState("");
        const [resultado, setResultado] = useState(null); // null | { found: bool, lead?: obj }
        const [buscado, setBuscado] = useState(false);

        const TEMP_LABEL = { frio: "Frio", morno: "Morno", quente: "Quente", convertido: "Convertido" };
        const TEMP_COLOR = { frio: "#60a5fa", morno: "#fb923c", quente: "#ef4444", convertido: "#22c55e" };

        const handleCpf = (v) => {
          setCpfInput(maskCpf(v));
          setResultado(null);
          setBuscado(false);
        };

        const buscar = (e) => {
          e.preventDefault();
          if (!eventoId || cpfInput.replace(/\D/g, "").length < 11) return;
          const cpfNorm = cpfInput.replace(/\D/g, "");
          const lead = leads.find(
            (l) => l.eventoId === eventoId && l.cpf && l.cpf.replace(/\D/g, "") === cpfNorm
          );
          setResultado(lead ? { found: true, lead } : { found: false });
          setBuscado(true);
        };

        const limpar = () => {
          setCpfInput("");
          setResultado(null);
          setBuscado(false);
        };

        const eventoSelecionado = eventos.find((e) => e.id === eventoId);

        return (
          <div className="page">
            <div className="page-head">
              <div>
                <div className="page-title">Check-in por CPF</div>
                <p className="tab-desc">Verifique se um lead já foi cadastrado no evento selecionado.</p>
              </div>
            </div>

            <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
              <form onSubmit={buscar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Evento</label>
                  <select
                    value={eventoId}
                    onChange={(e) => { setEventoId(e.target.value); setResultado(null); setBuscado(false); }}
                    required
                  >
                    <option value="">Selecione o evento…</option>
                    {eventos.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">CPF do Lead</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="form-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={cpfInput}
                      onChange={(e) => handleCpf(e.target.value)}
                      style={{ flex: 1, fontFamily: "monospace", letterSpacing: 1 }}
                    />
                    {cpfInput && (
                      <button type="button" className="btn-ghost" onClick={limpar} title="Limpar">
                        <Icon name="x" size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!eventoId || cpfInput.replace(/\D/g, "").length < 11}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Icon name="search" size={16} stroke="#000" /> Consultar
                </button>
              </form>
            </div>

            {buscado && resultado && (
              <div style={{ maxWidth: 520, margin: "20px auto 0" }}>
                {resultado.found ? (
                  <div className="card" style={{ borderLeft: "4px solid #22c55e" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <Icon name="check_circle" size={26} stroke="#22c55e" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#22c55e" }}>Lead cadastrado</div>
                        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{eventoSelecionado?.nome}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="info-line"><span className="k">Nome</span><span className="v strong">{resultado.lead.nome}</span></div>
                      <div className="info-line"><span className="k">CPF</span><span className="v mono">{resultado.lead.cpf}</span></div>
                      <div className="info-line"><span className="k">Telefone</span><span className="v mono">{resultado.lead.telefone}</span></div>
                      {resultado.lead.endereco && (
                        <div className="info-line"><span className="k">Endereço</span><span className="v">{resultado.lead.endereco}</span></div>
                      )}
                      <div className="info-line">
                        <span className="k">Serviço</span>
                        <span className="v"><span className="badge badge-tipo">{servicoLabel(resultado.lead.servicoInteresse)}</span></span>
                      </div>
                      <div className="info-line">
                        <span className="k">Temperatura</span>
                        <span className="v">
                          <span style={{ color: TEMP_COLOR[resultado.lead.temperatura], fontWeight: 600 }}>
                            {TEMP_LABEL[resultado.lead.temperatura] || resultado.lead.temperatura}
                          </span>
                        </span>
                      </div>
                      <div className="info-line"><span className="k">Vendedor</span><span className="v">{resultado.lead.vendedorNome}</span></div>
                      <div className="info-line">
                        <span className="k">Cadastrado em</span>
                        <span className="v" style={{ fontSize: 12, color: "var(--text-3)" }}>
                          {new Date(resultado.lead.criadoEm).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {resultado.lead.observacao && (
                        <div className="info-line"><span className="k">Obs.</span><span className="v" style={{ fontStyle: "italic", color: "var(--text-3)" }}>{resultado.lead.observacao}</span></div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ borderLeft: "4px solid #ef4444" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon name="x_circle" size={26} stroke="#ef4444" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#ef4444" }}>CPF não encontrado</div>
                        <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                          Nenhum lead com este CPF foi cadastrado em <b>{eventoSelecionado?.nome}</b>.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      function MarketingApp({ session, onLogout, darkMode, toggleDark }) {
        const [tab, setTab] = useState("eventos");
        const [detailId, setDetailId] = useState(null);

        const tabs = [
          { id: "eventos", label: "Eventos", ico: "calendar" },
          { id: "estoque", label: "Estoque", ico: "box" },
          { id: "leads", label: "Leads", ico: "users" },
          { id: "equipe", label: "Equipe", ico: "briefcase" },
          { id: "checkin", label: "Check-in", ico: "search" },
        ];

        const switchTab = (id) => { setTab(id); setDetailId(null); };

        return (
          <div>
            <header className="app-header">
              <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"36px"}} />
              <nav className="header-nav">
                {tabs.map((t) => (
                  <button key={t.id} className={"nav-tab" + (tab === t.id ? " active" : "")} onClick={() => switchTab(t.id)}>
                    <Icon name={t.ico} size={17} />{t.label}
                  </button>
                ))}
              </nav>
              <div className="header-right">
                <button className="theme-toggle" onClick={toggleDark} title="Alternar tema"><Icon name={darkMode ? "sun" : "moon"} size={17} /></button>
                <span className="user-badge"><span className="dot"></span><span className="ub-name">Marketing</span></span>
              </div>
              <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={onLogout}>Sair</button>
            </header>

            {tab === "eventos" && (detailId
              ? <EventDetail eventoId={detailId} onBack={() => setDetailId(null)} />
              : <EventosTab onOpen={setDetailId} />)}
            {tab === "estoque" && <EstoqueTab />}
            {tab === "leads" && <LeadsTab />}
            {tab === "equipe" && <EquipeTab />}
            {tab === "checkin" && <CheckinTab />}

            {/* Bottom nav — mobile only */}
            <nav className="bottom-nav">
              <div className="bottom-nav-inner">
                {tabs.map((t) => (
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

      /* ============================================================
         HELPERS — máscara de telefone
         ============================================================ */
      function maskCpf(v) {
        const d = v.replace(/\D/g, "").slice(0, 11);
        if (d.length <= 3) return d;
        if (d.length <= 6) return d.slice(0,3) + "." + d.slice(3);
        if (d.length <= 9) return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6);
        return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6,9) + "-" + d.slice(9);
      }

      function maskTel(v) {
        const d = v.replace(/\D/g, "").slice(0, 11);
        if (d.length <= 2) return d.length ? "(" + d : "";
        if (d.length <= 7) return "(" + d.slice(0,2) + ") " + d.slice(2);
        if (d.length <= 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
        return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
      }

      /* ============================================================
         VENDEDOR (COMERCIAL) VIEW — mobile-first
         ============================================================ */
      function VendedorApp({ session, onLogout, darkMode, toggleDark }) {
        const { getEventosAtivos, addLead, removeLead, updateLead, leads } = useApp();
        const ativos = getEventosAtivos();
        const [eventoId, setEventoId] = useState(ativos[0]?.id || "");
        const FORM_VAZIO = { nome: "", telefone: "", endereco: "", cpf: "", servicoInteresse: "internet_residencial", temperatura: "morno", observacao: "", jaClienteRjnet: false };
        const [f, setF] = useState(FORM_VAZIO);
        const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
        const [modoRapido, setModoRapido] = useState(false);
        const [toast, setToast] = useState(null); // { id, nome }
        const toastTimer = useRef(null);

        const hoje = new Date().toDateString();
        const meusLeadsHoje = leads.filter((l) =>
          l.vendedorNome === session.vendedorNome && new Date(l.criadoEm).toDateString() === hoje
        );

        const pct = Math.min((meusLeadsHoje.length / META_DIARIA) * 100, 100);
        const metaBatida = meusLeadsHoje.length >= META_DIARIA;

        const showToast = (id, nome) => {
          if (toastTimer.current) clearTimeout(toastTimer.current);
          setToast({ id, nome });
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        };

        const handleUndo = () => {
          if (!toast) return;
          removeLead(toast.id);
          clearTimeout(toastTimer.current);
          setToast(null);
        };

        const submit = (e) => {
          e.preventDefault();
          if (!eventoId) return;
          const id = "l" + Date.now();
          addLead({ ...f, id, eventoId, vendedorNome: session.vendedorNome });
          if (typeof navigator.vibrate === "function") navigator.vibrate(80);
          showToast(id, f.nome);
          setF(FORM_VAZIO);
        };

        const addObs = (txt) => set("observacao", f.observacao ? f.observacao + ". " + txt : txt);

        return (
          <div>
            <header className="app-header">
              <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"36px"}} />
              <div className="header-right" style={{ marginLeft: "auto" }}>
                <button className="theme-toggle" onClick={toggleDark} title="Alternar tema"><Icon name={darkMode ? "sun" : "moon"} size={17} /></button>
                <span className="user-badge"><span className="vendedor-avatar" style={{ width: 22, height: 22, fontSize: 11 }}>{session.vendedorNome.charAt(0)}</span><span className="ub-name">{session.vendedorNome}</span></span>
              </div>
              <button className="btn-ghost" onClick={onLogout}>Sair</button>
            </header>

            <div className="vend-shell">
              <div className="vend-top">
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Registrar Lead</h1>
                <span className={"count-badge" + (metaBatida ? "" : "")} style={metaBatida ? { background: "var(--green)", color: "#fff" } : {}}>
                  {meusLeadsHoje.length}/{META_DIARIA} hoje
                </span>
              </div>

              {/* Barra de meta diária */}
              <div className="meta-bar-wrap">
                <div className="meta-bar-header">
                  <span className="meta-bar-label">{metaBatida ? "Meta batida!" : "Meta diária"}</span>
                  <span className="meta-bar-count">{meusLeadsHoje.length} de {META_DIARIA} leads</span>
                </div>
                <div className="meta-bar-track">
                  <div className={"meta-bar-fill" + (metaBatida ? " done" : "")} style={{ width: pct + "%" }} />
                </div>
              </div>

              {/* Modo rápido toggle */}
              <label className="modo-rapido-toggle">
                <span className={"toggle-switch" + (modoRapido ? " on" : "")} onClick={() => setModoRapido((v) => !v)} />
                Modo rápido — só essencial
              </label>

              <div className="big-field big-select">
                <label>Evento</label>
                {ativos.length === 0 ? (
                  <div className="empty" style={{ textAlign: "left", padding: "10px 0" }}>Nenhum evento ativo no momento.</div>
                ) : (
                  <select value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
                    {ativos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                )}
              </div>

              {ativos.length > 0 && (
                <form onSubmit={submit}>
                  <div className="big-field">
                    <label>Nome completo *</label>
                    <input required value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome do cliente" autoComplete="off" />
                  </div>
                  <div className="big-field">
                    <label>Telefone *</label>
                    <input
                      required
                      value={f.telefone}
                      onChange={(e) => set("telefone", maskTel(e.target.value))}
                      placeholder="(24) 99999-9999"
                      inputMode="tel"
                      autoComplete="off"
                    />
                  </div>

                  <div className="big-field">
                    <label>CPF do cliente</label>
                    <input
                      value={f.cpf}
                      onChange={(e) => set("cpf", maskCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </div>

                  {!modoRapido && (
                    <div className="big-field">
                      <label>Endereço</label>
                      <input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número, bairro" />
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
                    <input
                      type="checkbox"
                      checked={f.jaClienteRjnet}
                      onChange={(e) => set("jaClienteRjnet", e.target.checked)}
                    />
                    <span>Já é cliente RJNet?</span>
                    {f.jaClienteRjnet && <span className="badge badge-ativo" style={{ marginLeft: 8, fontSize: 11 }}>Sim</span>}
                  </label>

                  <div className="big-field">
                    <label>Temperatura do lead</label>
                    <div className="temp-grid">
                      {Object.entries(TEMPERATURA_CONFIG).map(([k, cfg]) => (
                        <button
                          type="button"
                          key={k}
                          className={"temp-btn " + cfg.cls + (f.temperatura === k ? " active" : "")}
                          style={{ "--tc": cfg.cor }}
                          onClick={() => set("temperatura", k)}
                        >
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
                      <textarea
                        rows="2"
                        value={f.observacao}
                        onChange={(e) => set("observacao", e.target.value)}
                        placeholder="Informações adicionais..."
                      />
                    </div>
                  )}

                  <button type="submit" className="btn-primary btn-full lead-submit">Registrar Lead</button>
                </form>
              )}

              {meusLeadsHoje.length > 0 && (
                <div className="meus-leads">
                  <h3>Meus Leads Hoje</h3>
                  {meusLeadsHoje.map((l) => {
                    const tc = TEMPERATURA_CONFIG[l.temperatura] || TEMPERATURA_CONFIG.morno;
                    return (
                      <div key={l.id} className="lead-mini">
                        <div className="lm-row">
                          <div className="lm-name">{l.nome}</div>
                          <button
                            type="button"
                            className="temp-btn"
                            style={{
                              "--tc": tc.cor, fontSize: 11, padding: "3px 10px", borderRadius: 999,
                              color: tc.cor, background: "color-mix(in srgb," + tc.cor + " 12%, transparent)",
                              boxShadow: "0 0 0 1px " + tc.cor,
                            }}
                            onClick={() => {
                              const ordem = Object.keys(TEMPERATURA_CONFIG);
                              const idx = ordem.indexOf(l.temperatura || "morno");
                              updateLead(l.id, { temperatura: ordem[(idx + 1) % ordem.length] });
                            }}
                            title="Toque para alterar temperatura"
                          >
                            {tc.label}
                          </button>
                        </div>
                        <div className="lm-row" style={{ marginTop: 4 }}>
                          <div className="lm-sub">
                            {l.cpf && <span className="mono" style={{ marginRight: 6 }}>{l.cpf}</span>}
                            {servicoLabel(l.servicoInteresse)}
                            {l.jaClienteRjnet && <span className="badge badge-ativo" style={{ marginLeft: 6, fontSize: 10 }}>Já cliente</span>}
                          </div>
                          <a href={"tel:" + l.telefone.replace(/\D/g, "")} className="lm-tel-btn">
                            <Icon name="person" size={12} stroke="var(--rj-blue)" />
                            {l.telefone}
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Toast desfazer */}
            {toast && (
              <div className="toast">
                <span>Lead <b>{toast.nome}</b> registrado</span>
                <button className="toast-undo" onClick={handleUndo}>Desfazer</button>
              </div>
            )}
          </div>
        );
      }

      /* ============================================================
         ROOT
         ============================================================ */
      function Root() {
        const [session, setSession] = useState(null);
        const [darkMode, setDarkMode] = useState(() => {
          const saved = localStorage.getItem("rjnet-theme");
          return saved ? saved === "dark" : true;
        });

        useEffect(() => {
          document.documentElement.classList.toggle("light", !darkMode);
          localStorage.setItem("rjnet-theme", darkMode ? "dark" : "light");
        }, [darkMode]);

        const toggleDark = () => setDarkMode((d) => !d);
        const logout = () => setSession(null);

        if (!session) return <Login onLogin={setSession} darkMode={darkMode} toggleDark={toggleDark} />;
        if (session.role === "marketing") return <MarketingApp session={session} onLogout={logout} darkMode={darkMode} toggleDark={toggleDark} />;
        return <VendedorApp session={session} onLogout={logout} darkMode={darkMode} toggleDark={toggleDark} />;
      }

      ReactDOM.createRoot(document.getElementById("root")).render(
        <AppProvider><Root /></AppProvider>
      );
