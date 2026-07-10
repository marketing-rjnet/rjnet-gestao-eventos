import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../hooks/useApp';
import { perguntasPadrao, mensagemResultadoPadrao } from '../../lib/simulador';
import { slugify } from '../../utils/ids';
import { sanitizeText } from '../../lib/security';

// Simulador — gestão de campanhas. D-076: 2 fluxos públicos independentes,
// nunca mais encadeados na mesma sessão:
// - 'oferta': só a pergunta fixa de perfil de uso (D-074) → pacote + combo.
//   Sem perguntas configuráveis, sem construtor.
// - 'demanda': só as perguntas de intenção configuráveis (texto + peso por
//   opção, D-075) → mensagem de resultado personalizada pela campanha
//   (novo campo, editado no mesmo construtor). Substitui o antigo tipo
//   'territorial' (removido) como forma de captação qualificada sem pacote
//   fixo associado.
//
// Cada campanha gera DOIS artefatos do mesmo link /s/:slug:
// - Link "limpo" pra colar no gerenciador de anúncios (os UTMs de cada
//   anúncio/conjunto vêm da própria plataforma de tráfego);
// - QR Code com utm_source=qrcode&utm_medium=impresso já embutidos — assim
//   a MESMA campanha distingue scan de material físico de clique em anúncio
//   sem precisar duplicar campanha.
// Numa campanha 'demanda', o botão de QR/Link só fica disponível depois de
// pelo menos 1 pergunta salva — antes disso o link não tem o que perguntar.

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
  oferta: 'Simulador de Oferta',
  demanda: 'Gerador por Demanda',
};

const genLocalId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// D-075/D-076: construtor do questionário de intenção de UMA campanha
// 'demanda' — pergunta por pergunta, opção por opção, com peso (pontos)
// editável, mais a mensagem de resultado mostrada antes do contato. O peso
// soma pontuação de intenção; a temperatura da fila é um percentual da
// pontuação máxima possível daquela campanha (ver calcularPerfilDinamico).
function PerguntasBuilder({ simulador, onSalvar }) {
  const [perguntas, setPerguntas] = useState(() => (simulador.perguntas?.length ? simulador.perguntas : perguntasPadrao()));
  const [mensagemResultado, setMensagemResultado] = useState(() => simulador.mensagemResultado || mensagemResultadoPadrao());
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  const atualizarPergunta = (idx, patch) => setPerguntas((p) => p.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  const atualizarOpcao = (idxP, idxO, patch) => setPerguntas((p) => p.map((q, i) => (
    i !== idxP ? q : { ...q, opcoes: q.opcoes.map((o, j) => (j === idxO ? { ...o, ...patch } : o)) }
  )));

  const moverPergunta = (idx, dir) => setPerguntas((p) => {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= p.length) return p;
    const novo = [...p];
    [novo[idx], novo[alvo]] = [novo[alvo], novo[idx]];
    return novo;
  });
  const moverOpcao = (idxP, idxO, dir) => setPerguntas((p) => p.map((q, i) => {
    if (i !== idxP) return q;
    const alvo = idxO + dir;
    if (alvo < 0 || alvo >= q.opcoes.length) return q;
    const opcoes = [...q.opcoes];
    [opcoes[idxO], opcoes[alvo]] = [opcoes[alvo], opcoes[idxO]];
    return { ...q, opcoes };
  }));

  const adicionarPergunta = () => setPerguntas((p) => [...p, {
    id: genLocalId('perg'), texto: '', tipo: 'single',
    opcoes: [{ id: genLocalId('op'), texto: '', peso: 0 }, { id: genLocalId('op'), texto: '', peso: 0 }],
  }]);
  const removerPergunta = (idx) => setPerguntas((p) => p.filter((_, i) => i !== idx));
  const adicionarOpcao = (idxP) => setPerguntas((p) => p.map((q, i) => (
    i !== idxP ? q : { ...q, opcoes: [...q.opcoes, { id: genLocalId('op'), texto: '', peso: 0 }] }
  )));
  const removerOpcao = (idxP, idxO) => setPerguntas((p) => p.map((q, i) => (
    i !== idxP ? q : { ...q, opcoes: q.opcoes.filter((_, j) => j !== idxO) }
  )));

  const salvar = () => {
    setErro('');
    if (perguntas.length === 0) { setErro('Adicione ao menos 1 pergunta.'); return; }
    for (const p of perguntas) {
      if (!p.texto.trim()) { setErro('Toda pergunta precisa de um texto.'); return; }
      if (p.opcoes.length < 2) { setErro(`A pergunta "${p.texto}" precisa de pelo menos 2 opções.`); return; }
      for (const o of p.opcoes) {
        if (!o.texto.trim()) { setErro(`Uma opção da pergunta "${p.texto}" está sem texto.`); return; }
        if (o.peso === '' || Number.isNaN(Number(o.peso)) || Number(o.peso) < 0) { setErro(`Peso inválido em "${p.texto}" → "${o.texto}".`); return; }
      }
    }
    const limpo = perguntas.map((p) => ({
      id: p.id, texto: sanitizeText(p.texto, 200), tipo: p.tipo,
      opcoes: p.opcoes.map((o) => ({ id: o.id, texto: sanitizeText(o.texto, 150), peso: Math.max(0, Number(o.peso) || 0) })),
    }));
    const msgLimpa = sanitizeText(mensagemResultado, 400) || mensagemResultadoPadrao();
    onSalvar({ perguntas: limpo, mensagemResultado: msgLimpa });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  };

  return (
    <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="tab-desc" style={{ margin: 0 }}>
        Escolha única ou múltipla, e um peso (pontos) por opção — quanto maior a soma escolhida em relação
        ao máximo possível da campanha, mais quente o lead entra na fila de distribuição.
      </p>
      {perguntas.map((pergunta, idxP) => (
        <div key={pergunta.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>PERGUNTA {idxP + 1}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} disabled={idxP === 0} onClick={() => moverPergunta(idxP, -1)}>▲</button>
              <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} disabled={idxP === perguntas.length - 1} onClick={() => moverPergunta(idxP, 1)}>▼</button>
              <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px', color: 'var(--red)' }} onClick={() => removerPergunta(idxP)}>Remover</button>
            </div>
          </div>
          <input
            style={{ width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
            maxLength={200} placeholder="Texto da pergunta"
            value={pergunta.texto} onChange={(e) => atualizarPergunta(idxP, { texto: e.target.value })}
          />
          <div className="seg-control" style={{ marginBottom: 10 }}>
            <button type="button" className={'seg-btn' + (pergunta.tipo === 'single' ? ' active' : '')} onClick={() => atualizarPergunta(idxP, { tipo: 'single' })}>Escolha única</button>
            <button type="button" className={'seg-btn' + (pergunta.tipo === 'multi' ? ' active' : '')} onClick={() => atualizarPergunta(idxP, { tipo: 'multi' })}>Múltipla escolha</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pergunta.opcoes.map((opcao, idxO) => (
              <div key={opcao.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  style={{ flex: 1, minWidth: 0 }} maxLength={150} placeholder={`Opção ${idxO + 1}`}
                  value={opcao.texto} onChange={(e) => atualizarOpcao(idxP, idxO, { texto: e.target.value })}
                />
                <input
                  type="number" min={0} style={{ width: 60 }} placeholder="Peso"
                  value={opcao.peso} onChange={(e) => atualizarOpcao(idxP, idxO, { peso: e.target.value })}
                  title="Pontos de intenção"
                />
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} disabled={idxO === 0} onClick={() => moverOpcao(idxP, idxO, -1)}>▲</button>
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} disabled={idxO === pergunta.opcoes.length - 1} onClick={() => moverOpcao(idxP, idxO, 1)}>▼</button>
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px', color: 'var(--red)' }} disabled={pergunta.opcoes.length <= 2} onClick={() => removerOpcao(idxP, idxO)}>×</button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => adicionarOpcao(idxP)}>+ Adicionar opção</button>
        </div>
      ))}
      <button type="button" className="btn-ghost btn-full" onClick={adicionarPergunta}>+ Adicionar pergunta</button>

      <div className="big-field" style={{ marginTop: 4 }}>
        <label>Mensagem de resultado</label>
        <textarea
          maxLength={400} rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          value={mensagemResultado} onChange={(e) => setMensagemResultado(e.target.value)}
        />
        <p className="campo-hint" style={{ marginTop: 4 }}>
          Aparece pra pessoa depois de responder tudo, antes de pedir o contato — é o "valor" que ela recebe nesse
          fluxo, já que não tem pacote pra recomendar (isso é só no Simulador de Oferta).
        </p>
      </div>

      {erro && <div className="form-erro">{erro}</div>}
      <button type="button" className="btn-primary btn-full" onClick={salvar}>{salvo ? '✓ Perguntas salvas!' : 'Salvar perguntas'}</button>
    </div>
  );
}

export function SimuladorTab() {
  const { simuladores, addSimulador, updateSimulador, removeSimulador } = useApp();
  const [nome, setNome] = useState('');
  const [campanha, setCampanha] = useState('');
  const [tipo, setTipo] = useState('oferta');
  const [abertoId, setAbertoId] = useState(null);
  const [perguntasAbertasId, setPerguntasAbertasId] = useState(null);
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
    setTipo('oferta');
    setAbertoId(novo.id);
    // 'demanda' nasce sem link disponível ainda (precisa configurar as
    // perguntas primeiro) — já abre direto no construtor.
    if (tipo === 'demanda') setPerguntasAbertasId(novo.id);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Simulador</div>
          <p className="tab-desc">
            Duas formas de captação qualificada, sempre com valor entregue antes do contato: o Simulador de
            Oferta recomenda um pacote fixo por perfil de uso; o Gerador por Demanda usa perguntas que você
            mesmo cria, cada uma com peso — o peso decide a pontuação de intenção. Cada campanha gera link
            (tráfego pago) e QR Code (material impresso) próprios.
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
              <button type="button" className={'seg-btn' + (tipo === 'oferta' ? ' active' : '')} onClick={() => setTipo('oferta')}>
                Simulador de Oferta
              </button>
              <button type="button" className={'seg-btn' + (tipo === 'demanda' ? ' active' : '')} onClick={() => setTipo('demanda')}>
                Gerador por Demanda
              </button>
            </div>
            <p className="campo-hint" style={{ marginTop: 6 }}>
              {tipo === 'oferta'
                ? 'Quiz fixo de qualificação — o sistema deduz o perfil de uso (Básico/Streaming/Home Office/Gamer) das respostas e recomenda pacote + combo de upsell na hora.'
                : 'Você cria as perguntas de intenção (com peso por opção) — o lead sai da fila já com pontuação e temperatura calculadas.'}
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {s.tipo === 'demanda' && (
                      <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setPerguntasAbertasId(perguntasAbertasId === s.id ? null : s.id)}>
                        {perguntasAbertasId === s.id ? 'Fechar' : 'Perguntas'}
                      </button>
                    )}
                    {(s.tipo === 'oferta' || s.perguntas?.length > 0) ? (
                      <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setAbertoId(abertoId === s.id ? null : s.id)}>
                        {abertoId === s.id ? 'Fechar' : 'QR / Link'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Configure as perguntas pra liberar o QR/Link</span>
                    )}
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
                {perguntasAbertasId === s.id && (
                  <PerguntasBuilder
                    simulador={s}
                    onSalvar={(patch) => updateSimulador(s.id, patch)}
                  />
                )}
                {abertoId === s.id && <QrDoSimulador simulador={s} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
