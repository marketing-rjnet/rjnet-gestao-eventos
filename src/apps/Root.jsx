import React, { useState, useEffect } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { RootAuth, RootLegacy } from '../auth';
import MarketingApp from './MarketingApp';
import VendedorApp from './VendedorApp';

export default function Root() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("rjnet-theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", !darkMode);
    localStorage.setItem("rjnet-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const toggleDark = () => setDarkMode((d) => !d);

  return isSupabaseMode()
    ? <RootAuth darkMode={darkMode} toggleDark={toggleDark} MarketingApp={MarketingApp} VendedorApp={VendedorApp} />
    : <RootLegacy darkMode={darkMode} toggleDark={toggleDark} MarketingApp={MarketingApp} VendedorApp={VendedorApp} />;
}
