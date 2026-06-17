import React, { useState } from 'react';
import { Icon } from '../components/ui';
import { useApp } from '../hooks/useApp';

// PA-01/LGPD: Guard de runtime — detecta credenciais legadas expostas em produção.
// VITE_MARKETING_PASS é substituída literalmente no bundle pelo Vite em tempo de build.
// Se chegar até aqui em produção, o dano já ocorreu — emite erro crítico visível.
if (import.meta.env.PROD && (import.meta.env.VITE_MARKETING_PASS || import.meta.env.VITE_VENDEDOR_PASS)) {
  console.error(
    '[rjnet/PA-01] CRÍTICO: VITE_MARKETING_PASS ou VITE_VENDEDOR_PASS está definida em produção. ' +
    'A senha está exposta no bundle JavaScript público. ' +
    'Remova estas variáveis da configuração de produção e use Supabase Auth.'
  );
}

export function Login({ onLogin, darkMode, toggleDark }) {
  const { vendedores } = useApp();
  const [modo, setModo] = useState("marketing"); // "marketing" | "vendedor"
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [senhaVendedor, setSenhaVendedor] = useState("");
  const [err, setErr] = useState("");

  const vendedoresAtivos = vendedores.filter((v) => v.ativo);

  const submitMarketing = (e) => {
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

  const submitVendedor = (e) => {
    e.preventDefault();
    setErr("");
    const expectedPass = import.meta.env.VITE_VENDEDOR_PASS || "";
    if (!expectedPass) {
      setErr("Modo legado não configurado. Defina VITE_VENDEDOR_PASS no .env.local.");
      return;
    }
    const v = vendedoresAtivos.find((x) => x.id === vendedorId);
    if (!v) { setErr("Selecione um vendedor."); return; }
    if (senhaVendedor !== expectedPass) { setErr("Senha incorreta."); return; }
    onLogin({ role: "vendedor", vendedorNome: v.nome, userId: v.id });
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"90px",display:"block",margin:"0 auto 8px"}} />
        <p className="login-tag">Gestão de Eventos</p>

        <div className="seg-control" style={{ marginBottom: 20 }}>
          <button type="button" className={"seg-btn" + (modo === "marketing" ? " active" : "")} onClick={() => { setModo("marketing"); setErr(""); }}>Marketing</button>
          <button type="button" className={"seg-btn" + (modo === "vendedor" ? " active" : "")} onClick={() => { setModo("vendedor"); setErr(""); }}>Vendedor</button>
        </div>

        {modo === "marketing" ? (
          <form onSubmit={submitMarketing} className="login-form">
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
        ) : (
          <form onSubmit={submitVendedor} className="login-form">
            <div className="field-group">
              <label>Quem é você?</label>
              <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} required>
                <option value="">Selecione seu nome…</option>
                {vendedoresAtivos.map((v) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Senha</label>
              <input type="password" value={senhaVendedor} onChange={(e) => setSenhaVendedor(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {err && <p className="error-msg">{err}</p>}
            <button type="submit" className="login-btn" disabled={!vendedorId || !senhaVendedor}>Entrar</button>
          </form>
        )}

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
