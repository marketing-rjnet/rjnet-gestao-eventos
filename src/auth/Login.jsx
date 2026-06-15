import React, { useState } from 'react';
import { Icon } from '../components/ui';
import { useApp } from '../hooks/useApp';

const _mktUser = import.meta.env.VITE_MARKETING_USER;
const _mktPass = import.meta.env.VITE_MARKETING_PASS;
const AUTH = {
  marketing: { user: _mktUser || "", pass: _mktPass || "" },
};

export function Login({ onLogin, darkMode, toggleDark }) {
  const { vendedores } = useApp();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setErr("");
    if (u === AUTH.marketing.user && p === AUTH.marketing.pass) onLogin({ role: "marketing" });
    else setErr("Usuário ou senha incorretos.");
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"90px",display:"block",margin:"0 auto 8px"}} />
        <p className="login-tag">Gestão de Eventos</p>
        <p className="login-sub">Sistema de Gestão de Eventos</p>
        <form onSubmit={submit} className="login-form">
          <div className="field-group">
            <label>Usuário</label>
            <input value={u} onChange={(e) => setU(e.target.value)} placeholder="marketing" autoComplete="username" />
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
