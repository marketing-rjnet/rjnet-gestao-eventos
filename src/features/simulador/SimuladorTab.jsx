import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../hooks/useApp';
import { PERGUNTAS_SIMULADOR } from '../../lib/simulador';
import { slugify } from '../../utils/ids';
import { sanitizeText } from '../../lib/security';

// Simulador de Perfil de Consumo — gestão de campanhas. Cada campanha é só
// identidade (nome + agrupador): o questionário é catálogo fixo em código
// (src/lib/simulador.js), mesmo princípio do Form Builder (D-062).
//
// Cada campanha gera DOIS artefatos do mesmo link /s/:slug:
// - Link "limpo" pra colar no gerenciador de anúncios (os UTMs de cada
//   anúncio/conjunto vêm da própria plataforma de tráfego);
// - QR Code com utm_source=qrcode&utm_medium=impresso já embutidos — assim
//   a MESMA campanha distingue scan de material físico de clique em anúncio
//   sem precisar duplicar campanha.

function QrDoSimulador({ simulador }) {
  const canvasRef = useRef(null);
  const [copiado, setCopiado] = useState(false);
  const url = `${window.location.origin}/s/${simulador.slug}`;
  const urlQr = `${url}?utm_source=qrcode&utm_medium=impresso`;

  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, urlQr, { width: 220, margin: 2 });
  }, [urlQr]);

  const baixarPng = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `simulador-${simulador.slug}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard indisponível (http/permissão) — o link fica visível pra copiar na mão */ }
  };

  return (
    <div className="qr-gerador-result" style={{ paddingTop: 12 }}>
      <canvas ref={canvasRef} />
      <div className="qr-gerador-url">{url}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="btn-primary" onClick={baixarPng}>⬇️ Baixar QR (impresso)</button>
        <button type="button" className="btn-ghost" onClick={copiarLink}>{copiado ? '✓ Copiado!' : '🔗 Copiar link (tráfego)'}</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', maxWidth: 320 }}>
        O QR já embute a origem "impresso". Pra anúncios, cole o link no gerenciador e adicione os UTMs
        da campanha (utm_source, utm_campaign...) — cada lead chega marcado com eles.
      </div>
    </div>
  );
}

const TIPO_LABEL_SIM = {
  perfil_consumo: 'Perfil de consumo',
  territorial: 'Territorial (demanda)',
};

export function SimuladorTab() {
  const { simuladores, addSimulador, updateSimulador, removeSimulador } = useApp();
  const [nome, setNome] = useState('');
  const [campanha, setCampanha] = useState('');
  const [tipo, setTipo] = useState('perfil_consumo');
  const [abertoId, setAbertoId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const criar = (e) => {
    e.preventDefault();
    const nomeLimpo = sanitizeText(nome, 120);
    if (!nomeLimpo) return;
    const slug = `${slugify(nomeLimpo)}-${Math.random().toString(36).slice(2, 6)}`;
    const novo = addSimulador({
      nome: nomeLimpo, slug, tipo,
      campanha: sanitizeText(campanha, 120),
    });
    setNome('');
    setCampanha('');
    setTipo('perfil_consumo');
    setAbertoId(novo.id);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Simulador</div>
          <p className="tab-desc">
            Quiz de perfil de consumo pra captação qualificada: a pessoa responde {PERGUNTAS_SIMULADOR.length} perguntas
            rápidas, recebe uma recomendação e só então deixa o contato. Cada campanha gera link (tráfego pago)
            e QR Code (material impresso) próprios — os leads chegam com perfil, pontuação de intenção e
            temperatura calculados, prontos pra distribuir em Relatórios.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, maxWidth: 480 }}>
        <span className="section-title">Nova campanha</span>
        <form onSubmit={criar}>
          <div className="big-field" style={{ marginTop: 10, marginBottom: 12 }}>
            <label>Nome da campanha *</label>
            <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Panfleto Itaguaí Centro" autoFocus />
          </div>
          <div className="big-field" style={{ marginBottom: 12 }}>
            <label>Agrupador (opcional)</label>
            <input maxLength={120} value={campanha} onChange={(e) => setCampanha(e.target.value)} placeholder="Ex: Ação Julho/2026" />
          </div>
          <div className="big-field" style={{ marginBottom: 14 }}>
            <label>Tipo</label>
            <div className="seg-control">
              <button type="button" className={'seg-btn' + (tipo === 'perfil_consumo' ? ' active' : '')} onClick={() => setTipo('perfil_consumo')}>
                Perfil de consumo
              </button>
              <button type="button" className={'seg-btn' + (tipo === 'territorial' ? ' active' : '')} onClick={() => setTipo('territorial')}>
                Territorial
              </button>
            </div>
            <p className="campo-hint" style={{ marginTop: 6 }}>
              {tipo === 'perfil_consumo'
                ? 'Quiz completo com recomendação de oferta — pro lead sair qualificado com perfil e pontuação.'
                : 'Só cidade, bairro e interesse — pra anúncios geolocalizados alimentarem o relatório de demanda por região (Relatórios).'}
            </p>
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={!nome.trim()}>Criar campanha</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <span className="section-title">Campanhas criadas</span>
        {simuladores.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>Nenhuma campanha criada ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {simuladores.map((s) => (
              <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="strong">{s.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {TIPO_LABEL_SIM[s.tipo] || s.tipo} · {s.campanha ? `${s.campanha} · ` : ''}{s.ativo ? 'ativa' : 'encerrada'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setAbertoId(abertoId === s.id ? null : s.id)}>
                      {abertoId === s.id ? 'Fechar' : 'QR / Link'}
                    </button>
                    <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => updateSimulador(s.id, { ativo: !s.ativo })}>
                      {s.ativo ? 'Encerrar' : 'Reativar'}
                    </button>
                    {confirmDelete === s.id ? (
                      <>
                        <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => { removeSimulador(s.id); setConfirmDelete(null); }}>Confirmar</button>
                        <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
                      </>
                    ) : (
                      <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => setConfirmDelete(s.id)}>Excluir</button>
                    )}
                  </div>
                </div>
                {abertoId === s.id && <QrDoSimulador simulador={s} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
