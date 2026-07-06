import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../hooks/useApp';
import { CAMPOS_FORMULARIO } from '../../lib/constants';
import { slugify } from '../../utils/ids';
import { sanitizeText } from '../../lib/security';

// Form Builder (catálogo fixo + campos personalizados, não motor de campo
// genérico): o marketing/comercial escolhe QUAIS campos aparecem em cada
// formulário — do catálogo fixo (CAMPOS_FORMULARIO) e/ou dos campos
// personalizados que a própria equipe cadastra (sempre texto livre, só a
// legenda é livre). Toda resposta vira um Lead pelo mesmo pipeline único.

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

// Gestão dos campos personalizados — reutilizáveis em qualquer formulário,
// definidos pela própria equipe sem precisar de deploy de código. Sempre
// texto livre (mesma validação simples de sanitizeText); só a legenda muda.
function CamposPersonalizadosManager() {
  const { camposPersonalizados, addCampoPersonalizado, updateCampoPersonalizado, removeCampoPersonalizado } = useApp();
  const [novoLabel, setNovoLabel] = useState('');

  const adicionar = (e) => {
    e.preventDefault();
    const label = sanitizeText(novoLabel, 80);
    if (!label) return;
    addCampoPersonalizado(label);
    setNovoLabel('');
  };

  return (
    <div className="card" style={{ marginTop: 18, maxWidth: 480 }}>
      <span className="section-title">Campos personalizados</span>
      <p className="tab-desc" style={{ marginTop: 4 }}>
        Sempre texto livre — só a legenda é sua. Uma vez criado, fica disponível pra qualquer formulário, não só o que você está montando agora.
      </p>
      <form onSubmit={adicionar} style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 12 }}>
        <input
          maxLength={80}
          value={novoLabel}
          onChange={(e) => setNovoLabel(e.target.value)}
          placeholder="Ex: Quantidade de moradores"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn-primary" disabled={!novoLabel.trim()}>+ Adicionar</button>
      </form>
      {camposPersonalizados.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhum campo personalizado ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {camposPersonalizados.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
              <span style={{ color: c.ativo ? 'var(--text)' : 'var(--text-3)' }}>{c.label}{!c.ativo && ' (inativo)'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => updateCampoPersonalizado(c.id, { ativo: !c.ativo })}>
                  {c.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red)' }} onClick={() => removeCampoPersonalizado(c.id)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FormBuilderTab() {
  const { formularios, camposPersonalizados, addFormulario, updateFormulario, removeFormulario } = useApp();
  const [nome, setNome] = useState('');
  const [campos, setCampos] = useState(['nome', 'telefone', 'servicoInteresse']);
  const [obrigatorios, setObrigatorios] = useState(['nome', 'telefone']);
  const [camposPersonalizadosIds, setCamposPersonalizadosIds] = useState([]);
  const [camposPersonalizadosObrigatorios, setCamposPersonalizadosObrigatorios] = useState([]);
  const [abertoId, setAbertoId] = useState(null);

  const camposPersonalizadosAtivos = camposPersonalizados.filter((c) => c.ativo);

  const toggleCampo = (key) => {
    setCampos((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
    if (campos.includes(key)) setObrigatorios((p) => p.filter((k) => k !== key));
  };
  const toggleObrigatorio = (key) =>
    setObrigatorios((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const togglePersonalizado = (id) => {
    setCamposPersonalizadosIds((p) => (p.includes(id) ? p.filter((k) => k !== id) : [...p, id]));
    if (camposPersonalizadosIds.includes(id)) setCamposPersonalizadosObrigatorios((p) => p.filter((k) => k !== id));
  };
  const togglePersonalizadoObrigatorio = (id) =>
    setCamposPersonalizadosObrigatorios((p) => (p.includes(id) ? p.filter((k) => k !== id) : [...p, id]));

  const criar = (e) => {
    e.preventDefault();
    const nomeLimpo = sanitizeText(nome, 120);
    if (!nomeLimpo || (campos.length === 0 && camposPersonalizadosIds.length === 0)) return;
    const slug = `${slugify(nomeLimpo)}-${Math.random().toString(36).slice(2, 6)}`;
    const novo = addFormulario({
      nome: nomeLimpo, slug, campos, camposObrigatorios: obrigatorios,
      camposPersonalizadosIds, camposPersonalizadosObrigatorios,
    });
    setNome('');
    setCampos(['nome', 'telefone', 'servicoInteresse']);
    setObrigatorios(['nome', 'telefone']);
    setCamposPersonalizadosIds([]);
    setCamposPersonalizadosObrigatorios([]);
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

          {camposPersonalizadosAtivos.length > 0 && (
            <div className="big-field" style={{ marginBottom: 14 }}>
              <label>Campos personalizados</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {camposPersonalizadosAtivos.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <input type="checkbox" checked={camposPersonalizadosIds.includes(c.id)} onChange={() => togglePersonalizado(c.id)} />
                      {c.label}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                      <input
                        type="checkbox"
                        disabled={!camposPersonalizadosIds.includes(c.id)}
                        checked={camposPersonalizadosObrigatorios.includes(c.id)}
                        onChange={() => togglePersonalizadoObrigatorio(c.id)}
                      />
                      obrigatório
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary btn-full" disabled={!nome.trim() || (campos.length === 0 && camposPersonalizadosIds.length === 0)}>Criar formulário</button>
        </form>
      </div>

      <CamposPersonalizadosManager />

      <div className="card" style={{ marginTop: 18 }}>
        <span className="section-title">Formulários criados</span>
        {formularios.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>Nenhum formulário criado ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {formularios.map((f) => {
              const totalCampos = f.campos.length + (f.camposPersonalizadosIds?.length || 0);
              return (
                <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div className="strong">{f.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {totalCampos} campo{totalCampos > 1 ? 's' : ''} · {f.ativo ? 'ativo' : 'inativo'}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
