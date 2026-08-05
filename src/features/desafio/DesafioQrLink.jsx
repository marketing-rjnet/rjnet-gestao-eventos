import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

// Desafio RJNet — Acerte 00:03:33 (D-089): QR Code + link da tela de TV
// pública (/tv/:slug) — mesma técnica 100% client-side já usada pelo
// Simulador/Form Builder (biblioteca `qrcode`, sem servidor de imagem).
export function DesafioQrLink({ desafio }) {
  const canvasRef = useRef(null);
  const [copiado, setCopiado] = useState(false);
  const url = `${window.location.origin}/tv/${desafio.slug}`;

  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 2 });
  }, [url]);

  const baixarPng = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `desafio-${desafio.slug}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard indisponível — o link fica visível pra copiar na mão */ }
  };

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <span className="section-title">Tela de TV — ranking em tempo real</span>
      <p className="campo-hint" style={{ marginTop: 4, marginBottom: 12 }}>
        Abra esse link em qualquer TV/monitor conectado — tela cheia, sem menus, atualiza sozinha conforme os
        participantes são cadastrados. Um link por dia do desafio.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <canvas ref={canvasRef} />
        <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-2)', wordBreak: 'break-all', textAlign: 'center' }}>{url}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href={url} target="_blank" rel="noreferrer" className="btn-primary">▶️ Abrir tela de TV</a>
          <button type="button" className="btn-ghost" onClick={baixarPng}>⬇️ Baixar QR</button>
          <button type="button" className="btn-ghost" onClick={copiarLink}>{copiado ? '✓ Copiado!' : '🔗 Copiar link'}</button>
        </div>
      </div>
    </div>
  );
}
