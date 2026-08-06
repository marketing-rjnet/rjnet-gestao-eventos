import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { sanitizeText } from '../../lib/security';

// Desafio RJNet — Acerte 00:03:33 (D-091): área de prêmio do dia —
// descrição livre + imagem opcional (ex: assinatura de streaming — Disney+,
// HBO Max, RJNet Play), exibida ao lado do ranking na Tela de TV pública
// (/tv/:slug). Mesmo padrão de upload de OfertaModal.jsx (D-057): preview
// local imediato via blob URL, upload real só ao salvar.
export function DesafioPremio({ desafio }) {
  const { saveDesafioPremio } = useApp();
  const [descricao, setDescricao] = useState(desafio.premioDescricao || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(desafio.premioImagemUrl || null);
  const [removerImagem, setRemoverImagem] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { alert('Selecione um arquivo de imagem.'); return; }
    if (f.size > 3 * 1024 * 1024) { alert('Imagem muito grande (máx. 3MB).'); return; }
    setFile(f);
    setRemoverImagem(false);
    setPreview(URL.createObjectURL(f));
  };

  const onRemoverImagem = () => {
    setFile(null);
    setRemoverImagem(true);
    setPreview(null);
  };

  const submit = (e) => {
    e.preventDefault();
    const texto = sanitizeText(descricao, 500);
    setSalvando(true);
    setMsg(null);
    saveDesafioPremio(
      desafio.id,
      { descricao: texto, file, removerImagem },
      (erro) => { setSalvando(false); setMsg({ tipo: 'erro', texto: `Falha ao salvar${erro ? `: ${erro}` : '.'} Tente novamente.` }); },
    );
    // Otimista: a mutação local já reflete de imediato (ver desafioApi.saveDesafioPremio).
    setSalvando(false);
    setFile(null);
    setRemoverImagem(false);
    setMsg({ tipo: 'ok', texto: 'Prêmio salvo — aparece na Tela de TV em instantes.' });
  };

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <span className="section-title">🎁 Prêmio do dia</span>
      <p className="campo-hint" style={{ marginTop: 4, marginBottom: 14 }}>
        Descreva o que está em jogo (ex: assinatura Disney+ de 1 mês, HBO Max, RJNet Play) e, se quiser, adicione
        uma imagem — ambos aparecem ao lado do ranking na Tela de TV pública deste dia.
      </p>
      <form onSubmit={submit}>
        <div className="field-group">
          <label>Imagem do prêmio (opcional)</label>
          {preview && (
            <img src={preview} alt="" style={{ width: 140, height: 140, objectFit: 'contain', background: 'var(--bg)', borderRadius: 8, marginBottom: 8, display: 'block' }} />
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept="image/*" onChange={onFile} />
            {preview && (
              <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={onRemoverImagem}>
                <Icon name="trash" size={13} /> Remover imagem
              </button>
            )}
          </div>
        </div>
        <div className="field-group">
          <label>Descrição do prêmio</label>
          <textarea
            rows="4" maxLength={500} value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: 1 mês de Disney+ Padrão para quem acertar exatamente 00:03:33!"
          />
        </div>
        {msg && (
          <div style={{ fontSize: 13, marginBottom: 10, color: msg.tipo === 'erro' ? 'var(--red)' : 'var(--green)' }}>{msg.texto}</div>
        )}
        <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar prêmio'}</button>
      </form>
    </div>
  );
}
