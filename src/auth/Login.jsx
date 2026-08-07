import React, { useState } from 'react';
import { Icon } from '../components/ui';
import { useApp } from '../hooks/useApp';

// PA-01/LGPD: Guard de runtime — detecta credenciais legadas expostas em produção.
// VITE_MARKETING_PASS é substituída literalmente no bundle pelo Vite em tempo de build.
// Se chegar até aqui em produção, o dano já ocorreu — emite erro crítico visível.
if (import.meta.env.PROD && import.meta.env.VITE_MARKETING_PASS) {
  console.error(
    '[rjnet/PA-01] CRÍTICO: VITE_MARKETING_PASS está definida em produção. ' +
    'A senha está exposta no bundle JavaScript público. ' +
    'Remova esta variável da configuração de produção e use Supabase Auth.'
  );
}

export function Login({ onLogin, darkMode, toggleDark }) {
  const { vendedores } = useApp();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setErr("");
    const expectedUser = import.meta.env.VITE_MARKETING_USER || "";
    const expectedPass = import.meta.env.VITE_MARKETING_PASS || "";
    if (!expectedUser || !expectedPass) {
      setErr("Modo legado não configurado. Defina VITE_MARKETING_USER e VITE_MARKETING_PASS no .env.local (apenas para desenvolvimento).");
      return;
    }
    if (u === expectedUser && p === expectedPass) onLogin({ role: "marketing" });
    else setErr("Usuário ou senha incorretos.");
  };

  return (
    <div className="login-bg" style={{ position: "relative" }}>
      <button className="theme-toggle" onClick={toggleDark} title="Alternar tema" aria-label="Alternar tema"
        style={{ position: "absolute", top: 16, right: 16 }}>
        <Icon name={darkMode ? "sun" : "moon"} size={17} />
      </button>
      <div className="login-card">
        <img src="/logo-rjnet.svg" alt="RJNET" style={{height:"90px",display:"block",margin:"0 auto 8px"}} />
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
      </div>
    </div>
  );
}
