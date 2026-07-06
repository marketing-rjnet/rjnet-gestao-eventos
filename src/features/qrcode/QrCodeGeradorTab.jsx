import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';
import { SERVICO_LABEL } from '../../utils/format';
import { slugify } from '../../utils/ids';

// Fase 0 do QR Code: gera a URL pública + a imagem do QR — sem persistir
// nada em tabela nova. O marketing gera, baixa o PNG e imprime; a
// identidade do QR (nome/local/campanha) viaja dentro da própria URL como
// atributo de proveniência.
//
// Duas opções de "onde o QR aponta", ambas convergindo para a mesma Edge
// Function (captar-lead-qrcode) — a origem do lead não muda, só quem
// hospeda a tela que o titular preenche:
//   1. Formulário próprio do sistema (/qr/:id) — padrão, sem configuração.
//   2. Google Forms — preencha as duas constantes abaixo após criar o Form
//      (ver google-forms-apps-script.js, no mesmo diretório da Edge
//      Function, para o script que reencaminha as respostas).
const GOOGLE_FORM_BASE_URL = ''; // ex: 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform'
const GOOGLE_FORM_ENTRY_QRCODE = ''; // ex: 'entry.123456789' — campo "Código de referência" do Form

const FORM_VAZIO = { nome: '', local: '', servico: '', campanha: '' };

export function QrCodeGeradorTab() {
  const [f, setF] = useState(FORM_VAZIO);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [resultado, setResultado] = useState(null); // { url, label, qrCodeId }
  const canvasRef = useRef(null);

  const gerar = async (e) => {
    e.preventDefault();
    if (!f.nome.trim()) return;
    const qrCodeId = `${slugify(f.nome)}-${Math.random().toString(36).slice(2, 6)}`;
    const label = [f.nome.trim(), f.local.trim(), f.servico ? SERVICO_LABEL[f.servico] : '', f.campanha.trim()].filter(Boolean).join(' — ');
    const usaGoogleForms = Boolean(GOOGLE_FORM_BASE_URL && GOOGLE_FORM_ENTRY_QRCODE);
    const url = usaGoogleForms
      ? `${GOOGLE_FORM_BASE_URL}?usp=pp_url&${GOOGLE_FORM_ENTRY_QRCODE}=${encodeURIComponent(qrCodeId)}`
      : `${window.location.origin}/qr/${qrCodeId}${label ? `?label=${encodeURIComponent(label)}` : ''}`;
    setResultado({ url, label, qrCodeId, usaGoogleForms });
    // canvas só existe após o próximo render (resultado passa a não-nulo)
    requestAnimationFrame(() => {
      if (canvasRef.current) QRCode.toCanvas(canvasRef.current, url, { width: 260, margin: 2 });
    });
  };

  const baixarPng = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `qrcode-${resultado.qrCodeId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const novoQr = () => { setResultado(null); setF(FORM_VAZIO); };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">QR Codes</div>
          <p className="tab-desc">Gere um QR Code para um ponto de contato físico (banner, placa, balcão). Quem escanear preenche os próprios dados; os leads chegam para você distribuir aos vendedores.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, maxWidth: 420 }}>
        {!resultado ? (
          <form onSubmit={gerar}>
            <div className="big-field" style={{ marginBottom: 10 }}>
              <label>Nome *</label>
              <input required maxLength={120} value={f.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex: Feirão de Carros" autoFocus />
            </div>
            <div className="big-field" style={{ marginBottom: 10 }}>
              <label>Local <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-3)' }}>(opcional)</span></label>
              <input maxLength={120} value={f.local} onChange={(e) => set('local', e.target.value)} placeholder="Ex: Zona Norte" />
            </div>
            <div className="big-field" style={{ marginBottom: 10 }}>
              <label>Serviço em destaque <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-3)' }}>(opcional, só para sua referência)</span></label>
              <select value={f.servico} onChange={(e) => set('servico', e.target.value)}>
                <option value="">—</option>
                {Object.keys(SERVICO_LABEL).map((s) => <option key={s} value={s}>{SERVICO_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="big-field" style={{ marginBottom: 14 }}>
              <label>Campanha <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-3)' }}>(opcional)</span></label>
              <input maxLength={120} value={f.campanha} onChange={(e) => set('campanha', e.target.value)} placeholder="Ex: Julho/2026" />
            </div>
            <button type="submit" className="btn-primary btn-full" disabled={!f.nome.trim()}>Gerar QR Code</button>
          </form>
        ) : (
          <div className="qr-gerador-result">
            <canvas ref={canvasRef} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>{resultado.label || resultado.qrCodeId}</div>
            <div className="qr-gerador-url">{resultado.url}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {resultado.usaGoogleForms ? '📋 Aponta para o Google Forms configurado' : '🔗 Aponta para o formulário próprio do sistema'}
            </div>
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={baixarPng}>⬇️ Baixar PNG</button>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={novoQr}>Gerar outro</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
