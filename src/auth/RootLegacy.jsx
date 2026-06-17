import React from 'react';
import { usePersisted } from '../hooks/usePersisted';
import { Login } from './Login';

const ROLES_VALIDOS = ["marketing", "vendedor"];

export function RootLegacy({ darkMode, toggleDark, MarketingApp, VendedorApp }) {
  const [session, setSession] = usePersisted("rjnet_session", null, { session: true });
  const logout = () => setSession(null);

  const roleValido = session && ROLES_VALIDOS.includes(session.role);
  if (session && !roleValido) {
    setSession(null);
    return null;
  }

  if (!session) return <Login onLogin={setSession} darkMode={darkMode} toggleDark={toggleDark} />;
  if (session.role === "marketing") return <MarketingApp session={session} onLogout={logout} darkMode={darkMode} toggleDark={toggleDark} />;
  return <VendedorApp session={session} onLogout={logout} darkMode={darkMode} toggleDark={toggleDark} />;
}
