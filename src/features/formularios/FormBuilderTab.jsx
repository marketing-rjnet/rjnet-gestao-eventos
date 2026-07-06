import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../hooks/useApp';
import { CAMPOS_FORMULARIO } from '../../lib/constants';
import { slugify } from '../../utils/ids';
import { sanitizeText } from '../../lib/security';

// Form Builder (Versão B — catálogo fixo, não motor de campo genérico):
// o marketing escolhe QUAIS campos de CAMPOS_FORMULARIO aparecem e quais
// são obrigatórios. Toda resposta vira um Lead pelo mesmo pipeline único
// (Edge Function submeter-formulario / fallback local), nunca uma
// entidade paralela com schema próprio.

function QrDoFormulario({ formulario }) {
  const canvasRef = useRef(null);
  const url = `${window.location.origin}/f/${formulario.slug}`;

  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 2 });
  }, [url]);

  const baixarPng = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `formulario-${formulario.slug}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="qr-gerador-result" style={{ paddingTop: 12 }}>
      <canvas ref={canvasRef} />
      <div className="qr-gerador-url">{url}</div>
      <button type="button" className="btn-primary" onClick={baixarPng}>⬇️ Baixar PNG</button>
    </div>
  );
}

export function FormBuilderTab() {
  const { formularios, addFormulario, updateFormulario, removeFormulario } = useApp();
  const [nome, setNome] = useState('');
  const [campos, setCampos] = useState(['nome', 'telefone', 'servicoInteresse']);
  const [obrigatorios, setObrigatorios] = useState(['nome', 'telefone']);
  const [abertoId, setAbertoId] = useState(null);

  const toggleCampo = (key) => {
    setCampos((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
    if (campos.includes(key)) setObrigatorios((p) => p.filter((k) => k !== key));
  };
  const toggleObrigatorio = (key) =>
    setObrigatorios((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const criar = (e) => {
    e.preventDefault();
    const nomeLimpo = sanitizeText(nome, 120);
    if (!nomeLimpo || campos.length === 0) return;
    const slug = `${slugify(nomeLimpo)}-${Math.random().toString(36).slice(2, 6)}`;
    const novo = addFormulario({ nome: nomeLimpo, slug, campos, camposObrigatorios: obrigatorios });
    setNome('');
    setCampos(['nome', 'telefone', 'servicoInteresse']);
    setObrigatorios(['nome', 'telefone']);
    setAbertoId(novo.id);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Formulários</div>
          <p className="tab-desc">Crie um formulário escolhendo os campos que ele deve pedir. As respostas chegam como leads, prontos para distribuir aos vendedores.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, maxWidth: 480 }}>
        <span className="section-title">Novo formulário</span>
        <form onSubmit={criar}>
          <div className="big-field" style={{ marginTop: 10, marginBottom: 12 }}>
            <label>Nome do formulário *</label>
            <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Cadastro Feirão de Carros" autoFocus />
          </div>
          <div className="big-field" style={{ marginBottom: 14 }}>
            <label>Campos</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CAMPOS_FORMULARIO.map((c) => (
                <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input type="checkbox" checked={campos.includes(c.key)} onChange={() => toggleCampo(c.key)} />
                    {c.label}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                    <input
                      type="checkbox"
                      disabled={!campos.includes(c.key)}
                      checked={obrigatorios.includes(c.key)}
                      onChange={() => toggleObrigatorio(c.key)}
                    />
                    obrigatório
                  </label>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={!nome.trim() || campos.length === 0}>Criar formulário</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <span className="section-title">Formulários criados</span>
        {formularios.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>Nenhum formulário criado ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {formularios.map((f) => (
              <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="strong">{f.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {f.campos.length} campo{f.campos.length > 1 ? 's' : ''} · {f.ativo ? 'ativo' : 'inativo'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setAbertoId(abertoId === f.id ? null : f.id)}>
                      {abertoId === f.id ? 'Fechar' : 'QR / Link'}
                    </button>
                    <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => updateFormulario(f.id, { ativo: !f.ativo })}>
                      {f.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => removeFormulario(f.id)}>Excluir</button>
                  </div>
                </div>
                {abertoId === f.id && <QrDoFormulario formulario={f} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
