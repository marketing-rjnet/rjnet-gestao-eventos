import React, { useState } from 'react';
import { Icon } from '../components/ui';
import { auth } from '../lib/dataService';

export function LoginAuth({ onLogin, darkMode, toggleDark }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [recuperar, setRecuperar] = useState(false);
  const [recuperado, setRecuperado] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setCarregando(true);
    try {
      if (recuperar) {
        await auth.resetSenha(email.trim());
        setRecuperado(true);
      } else {
        const sessao = await auth.signIn(email.trim(), senha);
        onLogin(sessao);
      }
    } catch (ex) {
      setErr(ex.message || "Não foi possível entrar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <img src="/logo-rjnet.svg" alt="RJNet" style={{height:"90px",display:"block",margin:"0 auto 8px"}} />
        <p className="login-tag">Gestão de Eventos</p>
        <p className="login-sub">{recuperar ? "Recuperar senha" : "Entre com a sua conta"}</p>
        {recuperado ? (
          <>
            <p style={{ textAlign: "center", fontSize: 14, padding: "12px 0" }}>
              Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.
            </p>
            <button className="back-btn" style={{ margin: "0 auto" }} onClick={() => { setRecuperar(false); setRecuperado(false); }}>
              Voltar ao login
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="login-form">
            <div className="field-group">
              <label>E-mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@rjnet.com.br" autoComplete="username" />
            </div>
            {!recuperar && (
              <div className="field-group">
                <label>Senha</label>
                <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </div>
            )}
            {err && <p className="error-msg">{err}</p>}
            <button type="submit" className="login-btn" disabled={carregando}>
              {carregando ? "Aguarde…" : recuperar ? "Enviar link" : "Entrar"}
            </button>
            <button type="button" className="back-btn" style={{ margin: "8px auto 0" }} onClick={() => { setRecuperar((r) => !r); setErr(""); }}>
              {recuperar ? "Voltar ao login" : "Esqueci minha senha"}
            </button>
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
