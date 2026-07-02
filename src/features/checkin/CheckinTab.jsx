import { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { servicoLabel } from '../../utils/format';

const TEMPERATURA_CONFIG = {
  frio:       { label: "Frio",       cor: "#60a5fa" },
  morno:      { label: "Morno",      cor: "#fb923c" },
  quente:     { label: "Quente",     cor: "#ef4444" },
  convertido: { label: "Convertido", cor: "#22c55e" },
};

export function CheckinTab() {
  const { leads, eventos, carregarLeadsEvento } = useApp();
  const [eventoId, setEventoId] = useState("");
  const [nomeInput, setNomeInput] = useState("");
  const [resultado, setResultado] = useState(null);
  const [buscado, setBuscado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleNome = (v) => {
    setNomeInput(v);
    setResultado(null);
    setBuscado(false);
  };

  const handleEvento = async (id) => {
    setEventoId(id);
    setResultado(null);
    setBuscado(false);
    if (id) {
      setCarregando(true);
      await carregarLeadsEvento(id);
      setCarregando(false);
    }
  };

  const buscar = (e) => {
    e.preventDefault();
    const termo = nomeInput.trim().toLowerCase();
    if (!eventoId || termo.length < 2) return;
    const leadsDoEvento = leads.filter((l) => l.eventoId === eventoId);
    const matches = leadsDoEvento.filter((l) => l.nome.toLowerCase().includes(termo));
    if (matches.length === 1) {
      setResultado({ found: true, parcial: false, lead: matches[0] });
    } else if (matches.length > 1) {
      setResultado({ found: true, parcial: true, matches });
    } else {
      setResultado({ found: false });
    }
    setBuscado(true);
  };

  const limpar = () => {
    setNomeInput("");
    setResultado(null);
    setBuscado(false);
  };

  const eventoSelecionado = eventos.find((e) => e.id === eventoId);
  const [verTodos, setVerTodos] = useState(false);
  const eventosVisiveis = verTodos ? eventos : eventos.filter((e) => e.status === "ativo");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Check-in por Nome</div>
          <p className="tab-desc">Verifique se um lead já foi cadastrado no evento selecionado.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
        <form onSubmit={buscar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Evento</label>
            <select
              value={eventoId}
              onChange={(e) => handleEvento(e.target.value)}
              required
              disabled={carregando}
            >
              <option value="">Selecione o evento…</option>
              {eventosVisiveis.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.nome}</option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "var(--text-3)", cursor: "pointer" }}>
              <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} style={{ cursor: "pointer" }} />
              Ver todos os eventos (incluindo encerrados)
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Nome do Lead</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                type="text"
                placeholder="Digite o nome…"
                value={nomeInput}
                onChange={(e) => handleNome(e.target.value)}
                style={{ flex: 1 }}
                autoComplete="off"
              />
              {nomeInput && (
                <button type="button" className="btn-ghost" onClick={limpar} title="Limpar" aria-label="Limpar busca">
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={!eventoId || nomeInput.trim().length < 2 || carregando}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Icon name="search" size={16} stroke="#000" /> {carregando ? "Carregando leads…" : "Consultar"}
          </button>
        </form>
      </div>

      {buscado && resultado && (
        <div style={{ maxWidth: 520, margin: "20px auto 0" }}>
          {resultado.found && resultado.parcial ? (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Icon name="search" size={22} stroke="var(--rj-blue)" />
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--rj-blue)" }}>
                  {resultado.matches.length} lead{resultado.matches.length > 1 ? "s" : ""} encontrado{resultado.matches.length > 1 ? "s" : ""}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {resultado.matches.map((lead) => (
                  <div key={lead.id} style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{lead.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{lead.telefone}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{lead.vendedorNome}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : resultado.found && !resultado.parcial ? (
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
                    <span style={{ color: TEMPERATURA_CONFIG[resultado.lead.temperatura]?.cor, fontWeight: 600 }}>
                      {TEMPERATURA_CONFIG[resultado.lead.temperatura]?.label || resultado.lead.temperatura}
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <Icon name="x_circle" size={26} stroke="#ef4444" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#ef4444" }}>Nenhum lead encontrado</div>
                  <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                    Nenhum lead com este nome foi cadastrado em <b>{eventoSelecionado?.nome}</b>.
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8 }}>Deseja cadastrar este visitante como lead?</div>
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: 13, width: "100%" }}
                onClick={() => {
                  if (eventoSelecionado) {
                    alert(`Acesse a aba "Eventos" → "${eventoSelecionado.nome}" para registrar o lead neste evento.`);
                  }
                }}
              >
                + Cadastrar como lead
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
