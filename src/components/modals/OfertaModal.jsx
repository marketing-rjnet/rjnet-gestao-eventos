import { useState } from 'react';
import { Icon } from '../ui';
import { useApp } from '../../hooks/useApp';
import { sanitizeText } from '../../lib/security';
import { SERVICO_LABEL } from '../../utils/format';

// D-057: servico é fixo (vem da linha clicada em OfertasTab) — não há modo "criar".
export function OfertaModal({ servico, oferta, onClose }) {
  const { saveOferta } = useApp();
  const [copy, setCopy] = useState(oferta?.copy || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(oferta?.imagemUrl || null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { alert('Selecione um arquivo de imagem.'); return; }
    if (f.size > 3 * 1024 * 1024) { alert('Imagem muito grande (máx. 3MB).'); return; }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth !== 1080 || img.naturalHeight !== 1080) {
        console.warn(`[rjnet] Imagem ${img.naturalWidth}x${img.naturalHeight} — recomendado 1080x1080.`);
      }
    };
    img.src = url;
  };

  const submit = (e) => {
    e.preventDefault();
    const texto = sanitizeText(copy, 800);
    if (!texto) { alert('Escreva a mensagem da oferta.'); return; }
    saveOferta(servico, { copy: texto, file }, (msg) => alert('Falha ao salvar a oferta' + (msg ? `: ${msg}` : '.') + ' Tente novamente.'));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Oferta — {SERVICO_LABEL[servico]}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div className="field-group">
            <label>Imagem (1080x1080 recomendado)</label>
            {preview && <img src={preview} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }} />}
            <input type="file" accept="image/*" onChange={onFile} />
          </div>
          <div className="field-group">
            <label>Mensagem (copy) *</label>
            <textarea required rows="5" maxLength={800} value={copy} onChange={(e) => setCopy(e.target.value)} placeholder="Mensagem pronta para o WhatsApp..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar oferta</button>
          </div>
        </form>
      </div>
    </div>
  );
}
