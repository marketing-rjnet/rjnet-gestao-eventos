import { useState, useEffect } from 'react';
import { auth, setQueueUserId, clearQueueSession } from '../lib/dataService';
import { LoginAuth } from './LoginAuth';
import { NovaSenha } from './NovaSenha';

export function RootAuth({ darkMode, toggleDark, MarketingApp, VendedorApp }) {
  const [session, setSession] = useState(undefined);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  useEffect(() => {
    let on = true;
    auth.getSessao().then((s) => {
      if (on) {
        setSession(s);
        // PA-05/LGPD: registra userId para criptografia da fila offline
        if (s?.userId) setQueueUserId(s.userId);
      }
    });
    const unsub = auth.onChange((evento) => {
      if (!on) return;
      if (evento === "SIGNED_OUT") {
        setSession((prev) => { if (prev?.userId) clearQueueSession(prev.userId); return null; });
      }
      if (evento === "PASSWORD_RECOVERY") setRecuperandoSenha(true);
      if (evento === "SIGNED_IN") auth.getSessao().then((s) => {
        if (on && s) {
          setSession(s);
          if (s.userId) setQueueUserId(s.userId);
        }
      });
    });
    return () => { on = false; unsub(); };
  }, []);

  const logout = async () => {
    try { await auth.signOut(); } catch { /* sessão já expirada */ }
    setSession((prev) => { if (prev?.userId) clearQueueSession(prev.userId); return null; });
  };

  if (recuperandoSenha) {
    return <NovaSenha darkMode={darkMode} toggleDark={toggleDark} onConcluido={() => setRecuperandoSenha(false)} />;
  }
  if (session === undefined) return <div className="login-bg" />;
  if (!session) return <LoginAuth onLogin={setSession} darkMode={darkMode} toggleDark={toggleDark} />;
  if (session.role === "marketing") return <MarketingApp session={session} onLogout={logout} darkMode={darkMode} toggleDark={toggleDark} />;
  return <VendedorApp session={session} onLogout={logout} darkMode={darkMode} toggleDark={toggleDark} />;
}
