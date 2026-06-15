import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { auth } from '../../lib/dataService';
import { sanitizeText } from '../../lib/security';
import { initials } from '../../utils/format';

export default function EquipeAuthTab() {
  const { vendedores: perfis, leads, recarregar } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ nome: "", email: "", senha: "", papel: "vendedor" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const PAPEL_LABEL = { marketing: "Marketing", vendedor: "Vendedor" };

  const toSlug = (nome) =>
    nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");

  const submit = async (e) => {
    e.preventDefault();
    setErro("");
    if (f.senha.length < 8) { setErro("A senha precisa ter pelo menos 8 caracteres."); return; }
    const emailFinal = f.email.trim() || `${toSlug(f.nome)}@vendedor.rjnet.com.br`;
    setSalvando(true);
    try {
      await auth.criarUsuario({ nome: sanitizeText(f.nome, 80), email: emailFinal, senha: f.senha, papel: f.papel });
      await recarregar();
      setF({ nome: "", email: "", senha: "", papel: "vendedor" });
      setShowForm(false);
    } catch (ex) {
      setErro(ex.message || "Não foi possível criar o usuário.");
    } finally {
      setSalvando(false);
    }
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    try {
      await auth.atualizarPerfil(editando.id, { nome: sanitizeText(editando.nome, 80), email: editando.email.trim() });
      await recarregar();
      setEditando(null);
    } catch (ex) {
      alert("Falha ao salvar: " + ex.message);
    }
  };

  const toggleAtivo = async (p) => {
    if (p.ativo && !confirm(`Desativar o acesso de ${p.nome}?`)) return;
    try { await auth.atualizarPerfil(p.id, { ativo: !p.ativo }); await recarregar(); }
    catch (ex) { alert("Falha ao atualizar: " + ex.message); }
  };

  const mudarPapel = async (p, papel) => {
    try { await auth.atualizarPerfil(p.id, { papel }); await recarregar(); }
    catch (ex) { alert("Falha ao atualizar: " + ex.message); }
  };

  const excluir = async (p) => {
    if (!confirm(`Excluir ${p.nome} permanentemente? Esta ação não pode ser desfeita.`)) return;
    try { await auth.excluirUsuario(p.id); await recarregar(); }
    catch (ex) { alert("Falha ao excluir: " + ex.message); }
  };

  const leadsDoUsuario = (nome) => leads.filter((l) => l.vendedorNome === nome).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Equipe</div>
          <p className="tab-desc">Crie e gerencie os acessos. Cada pessoa entra com o próprio e-mail e senha; o papel define o que ela pode ver e fazer.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>+ Novo Usuário</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="inline-form-card">
          <div className="field-row">
            <div className="field-group">
              <label>Nome completo *</label>
              <input required maxLength={80} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Pedro Souza" autoFocus />
            </div>
            <div className="field-group">
              <label>Senha inicial *</label>
              <input type="password" required minLength={8} value={f.senha} onChange={(e) => set("senha", e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="field-group">
              <label>Papel *</label>
              <select value={f.papel} onChange={(e) => set("papel", e.target.value)}>
                <option value="vendedor">Vendedor — registra e acompanha leads</option>
                <option value="marketing">Marketing — administra tudo</option>
              </select>
            </div>
          </div>
          {erro && <p className="error-msg">{erro}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Criando…" : "Criar usuário"}</button>
          </div>
        </form>
      )}

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Editar usuário</div>
            <form onSubmit={salvarEdicao}>
              <div className="field-group" style={{ marginBottom: 12 }}>
                <label>Nome completo</label>
                <input required maxLength={80} value={editando.nome} onChange={(e) => setEditando((ed) => ({ ...ed, nome: e.target.value }))} />
              </div>
              <div className="field-group" style={{ marginBottom: 16 }}>
                <label>E-mail de login</label>
                <input type="email" required value={editando.email} onChange={(e) => setEditando((ed) => ({ ...ed, email: e.target.value }))} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="vendor-grid">
        {perfis.map((p) => (
          <div key={p.id} className="vendor-card">
            <div className="v-av">{initials(p.nome)}</div>
            <div className="v-name">{p.nome}</div>
            {p.email && <div className="tab-desc" style={{ margin: "2px 0 6px", wordBreak: "break-all" }}>{p.email}</div>}
            <div className="v-badge" style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              <span className="badge badge-tipo">{PAPEL_LABEL[p.papel] || p.papel}</span>
              <span className={"badge " + (p.ativo ? "badge-ativo" : "badge-encerrado")}>{p.ativo ? "Ativo" : "Inativo"}</span>
            </div>
            {p.papel === "vendedor" && (
              <>
                <div className="v-cap">leads captados</div>
                <div className="v-big">{leadsDoUsuario(p.nome)}</div>
              </>
            )}
            <div className="v-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <select value={p.papel} onChange={(e) => mudarPapel(p, e.target.value)} title="Alterar papel">
                <option value="vendedor">Vendedor</option>
                <option value="marketing">Marketing</option>
              </select>
              <button className="btn-ghost vendor-toggle" onClick={() => setEditando({ id: p.id, nome: p.nome, email: p.email || "" })}>
                Editar
              </button>
              <button className="btn-ghost vendor-toggle" onClick={() => toggleAtivo(p)}>
                {p.ativo ? "Desativar" : "Ativar"}
              </button>
              <button className="btn-ghost vendor-toggle" style={{ color: "#ef4444" }} onClick={() => excluir(p)} title="Excluir usuário">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
