import React, { useState } from 'react';
import { Icon } from '../components/ui';
import { auth } from '../lib/dataService';
import { SENHA_MIN_LENGTH } from '../lib/constants';

export function NovaSenha({ darkMode, toggleDark, onConcluido }) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [err, setErr] = useState("");
  const [salvando, setSalvando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (senha.length < SENHA_MIN_LENGTH) { setErr(`A senha precisa ter pelo menos ${SENHA_MIN_LENGTH} caracteres.`); return; }
    if (senha !== confirma) { setErr("As senhas não conferem."); return; }
    setSalvando(true);
    try {
      await auth.atualizarSenha(senha);
      alert("Senha alterada com sucesso!");
      onConcluido();
    } catch (ex) {
      setErr(ex.message || "Não foi possível alterar a senha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"90px",display:"block",margin:"0 auto 8px"}} />
        <p className="login-tag">Gestão de Eventos</p>
        <p className="login-sub">Defina a sua nova senha</p>
        <form onSubmit={submit} className="login-form">
          <div className="field-group">
            <label>Nova senha</label>
            <input type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" autoFocus />
          </div>
          <div className="field-group">
            <label>Confirmar nova senha</label>
            <input type="password" required value={confirma} onChange={(e) => setConfirma(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
          </div>
          {err && <p className="error-msg">{err}</p>}
          <button type="submit" className="login-btn" disabled={salvando}>{salvando ? "Salvando…" : "Salvar nova senha"}</button>
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
