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

  // PA-12/LGPD: estado de desafio MFA
  const [mfaState, setMfaState] = useState(null); // { factorId, challengeId }
  const [codigoMfa, setCodigoMfa] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setCarregando(true);
    try {
      if (recuperar) {
        await auth.resetSenha(email.trim());
        setRecuperado(true);
      } else {
        const resultado = await auth.signIn(email.trim(), senha);
        if (resultado.mfaRequired) {
          setMfaState({ factorId: resultado.factorId, challengeId: resultado.challengeId });
        } else {
          onLogin(resultado);
        }
      }
    } catch (ex) {
      setErr(ex.message || "Não foi possível entrar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setErr("");
    setCarregando(true);
    try {
      const sessao = await auth.verifyMfa(mfaState.factorId, mfaState.challengeId, codigoMfa.replace(/\s/g, ""));
      onLogin(sessao);
    } catch (ex) {
      setErr(ex.message || "Código inválido. Tente novamente.");
      setCodigoMfa("");
    } finally {
      setCarregando(false);
    }
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

        {mfaState ? (
          <>
            <p className="login-sub">Verificação em duas etapas</p>
            <form onSubmit={submitMfa} className="login-form">
              <div className="field-group">
                <label>Código do autenticador</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={codigoMfa}
                  onChange={(e) => setCodigoMfa(e.target.value)}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                  style={{ fontFamily: "monospace", letterSpacing: 4, fontSize: 20, textAlign: "center" }}
                />
              </div>
              {err && <p className="error-msg">{err}</p>}
              <button type="submit" className="login-btn" disabled={carregando || codigoMfa.length < 6}>
                {carregando ? "Verificando…" : "Confirmar"}
              </button>
              <button type="button" className="back-btn" style={{ margin: "8px auto 0" }}
                onClick={() => { setMfaState(null); setCodigoMfa(""); setErr(""); }}>
                Voltar ao login
              </button>
            </form>
          </>
        ) : (
          <>
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
          </>
        )}

        <p className="login-hint">Angra dos Reis · RJ</p>
      </div>
    </div>
  );
}
