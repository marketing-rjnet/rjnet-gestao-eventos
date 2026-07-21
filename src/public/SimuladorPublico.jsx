import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseConfig } from '../lib/supabase';
import { fetchSimuladorPublico } from '../lib/dataService';
import {
  PERGUNTAS_SIMULADOR_VERSAO, perguntasPadrao, calcularPerfilDinamico, mensagemResultadoPadrao,
  PERGUNTAS_OFERTA, perfilPorRespostasOferta, normalizarRespostasDinamico,
  perfilPorKey, pacotePorMega, pacoteUpgrade, montarCombo,
  APPS_ADICIONAIS, PLANOS_MOVEL, fmtMoeda,
  quizPerguntasPadrao, quizFaixasPadrao, corrigirQuiz, faixaPorAcertos,
} from '../lib/simulador';
import { maskTel, validarTelefone } from '../utils/masks';
import { salvarLeadPublicoLocal } from '../lib/localPublicSubmit';
import { containsLink } from '../lib/security';

// Página pública do Simulador — sem sessão, sem AppContext (mesmo desenho
// do FormularioPublico). Wizard gamificado: "valor antes do dado" — só
// pede contato depois de mostrar algo pra pessoa.
//
// D-077/D-080: os 3 fluxos (D-076) agora têm a MESMA estrutura de tela — um
// quiz sequencial (uma pergunta por tela) seguido de "calculando" →
// resultado → contato. O que muda por tipo é só QUAL questionário e o que
// a etapa de resultado calcula/mostra:
// - tipo 'oferta': quiz FIXO de qualificação (PERGUNTAS_OFERTA) — o perfil
//   de uso (e portanto o pacote) é DEDUZIDO das respostas via
//   perfilPorRespostasOferta(), nunca escolhido por clique direto (isso
//   substitui a antiga tela única de 4 botões, D-074/D-076) → pacote +
//   combo de upsell (apps, upgrade de pacote, plano Móvel).
// - tipo 'demanda': perguntas configuráveis da PRÓPRIA campanha (D-075) →
//   mensagem de resultado personalizada pela campanha → contato. Sem
//   pergunta de perfil/pacote nesse fluxo.
// - tipo 'quiz' (D-080): perguntas de conhecimento (certo/errado) da
//   PRÓPRIA campanha → contagem de acertos → faixa de classificação
//   (emoji + título definidos pelo marketing) → contato. Sem pergunta de
//   perfil/pacote/pontuação ponderada — é um teste, não uma qualificação.
// O score/perfil exibido aqui é só UX: a Edge Function submeter-simulador
// busca sua PRÓPRIA cópia da config (e do quiz fixo de oferta) e recalcula
// tudo no servidor — nunca confia no que o cliente manda.
//
// Atribuição de tráfego: captura utm_* da URL no load — o mesmo link
// atende anúncio pago (UTMs do gerenciador) e QR impresso (UTMs embutidos
// pelo SimuladorTab ao gerar o QR).
//
// D-082: tipo 'quiz' ganha um resumo compartilhável na tela final (depois
// do contato enviado) — imagem gerada 100% no cliente via <canvas> (mesma
// técnica do QR Code, sem lib nova) com faixa/acertos/tempo/campanha, e um
// botão que usa a Web Share API (com arquivo de imagem) quando o navegador
// suporta, com fallback de download simples. Puramente cosmético/viral —
// não persiste nada novo, não afeta o lead já gravado.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// D-082: contagem de tempo de resposta do quiz — só usada pra exibição no
// resumo compartilhável, nunca enviada ao servidor (a Edge Function não
// grava/valida tempo, é puramente decorativo no card).
function formatarDuracao(ms) {
  if (!ms || ms < 0) return null;
  const segundosTotais = Math.round(ms / 1000);
  const min = Math.floor(segundosTotais / 60);
  const seg = segundosTotais % 60;
  return min === 0 ? `${seg}s` : `${min}min ${seg}s`;
}

// Quebra texto em várias linhas dentro de maxWidth — usado pro card do
// resumo aceitar títulos/nomes de campanha de qualquer tamanho sem
// estourar a imagem. Retorna o y logo abaixo do bloco desenhado.
function desenharTextoComQuebra(ctx, texto, cx, y, maxWidth, lineHeight) {
  const palavras = String(texto).split(' ');
  const linhas = [];
  let linha = '';
  for (const palavra of palavras) {
    const teste = linha ? `${linha} ${palavra}` : palavra;
    if (linha && ctx.measureText(teste).width > maxWidth) {
      linhas.push(linha);
      linha = palavra;
    } else {
      linha = teste;
    }
  }
  if (linha) linhas.push(linha);
  linhas.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
  return y + linhas.length * lineHeight;
}

// Desenha o card 1080x1080 (mesmo formato das imagens de Oferta, D-057) do
// resumo do quiz — logo, nome da campanha, faixa (emoji + título), acertos
// e tempo. `logoImg` pode ser null (ex: SVG ainda não carregou) — o resto
// do card é desenhado igual, só sem a logo no topo.
function desenharResumoQuiz(canvas, { emoji, titulo, acertos, total, tempoTexto, nomeCampanha, primeiroNome, logoImg, link }) {
  const W = 1080;
  const H = 1080;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 900);
  grad.addColorStop(0, 'rgba(255,203,0,0.12)');
  grad.addColorStop(1, '#090909');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  let y = 130;
  if (logoImg) {
    const logoH = 90;
    const logoW = logoImg.width * (logoH / logoImg.height);
    ctx.drawImage(logoImg, (W - logoW) / 2, y - logoH, logoW, logoH);
  }
  y += 90;

  ctx.fillStyle = '#ffcb00';
  ctx.font = '700 34px "DM Sans", sans-serif';
  y = desenharTextoComQuebra(ctx, String(nomeCampanha || 'Simulador RJNet').toUpperCase(), W / 2, y, 880, 44) + 150;

  ctx.font = '200px sans-serif';
  ctx.fillText(emoji || '🎯', W / 2, y);
  y += 70;

  ctx.fillStyle = '#f4f4f4';
  ctx.font = '800 62px "DM Sans", sans-serif';
  y = desenharTextoComQuebra(ctx, titulo || 'Participante', W / 2, y, 920, 72) + 50;

  ctx.fillStyle = '#cccccc';
  ctx.font = '500 38px "DM Sans", sans-serif';
  y = desenharTextoComQuebra(ctx, `${primeiroNome} acertou ${acertos} de ${total} perguntas!`, W / 2, y, 920, 48) + 34;

  if (tempoTexto) {
    ctx.fillStyle = '#888888';
    ctx.font = '500 32px "DM Sans", sans-serif';
    ctx.fillText(`⏱ ${tempoTexto}`, W / 2, y);
  }

  ctx.fillStyle = '#555555';
  ctx.font = '400 26px "DM Sans", sans-serif';
  ctx.fillText(link, W / 2, H - 70);
}

// D-082: gera o card + botão de compartilhar/baixar. Usa Web Share API com
// arquivo quando o navegador suporta (WhatsApp/Instagram/etc. no celular);
// cai pro download simples do PNG quando não (mesmo padrão de baixarPng em
// SimuladorTab.jsx). Não depende de sessão nem grava nada — é só o próprio
// canvas já renderizado virando arquivo compartilhável.
function ResumoCompartilhavel({ faixa, acertos, total, tempoMs, nomeCampanha, primeiroNome, slug }) {
  const canvasRef = useRef(null);
  const [suportaArquivo, setSuportaArquivo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const link = `${window.location.origin}/s/${slug}`;
    const desenhar = (logoImg) => {
      if (cancelado || !canvasRef.current) return;
      desenharResumoQuiz(canvasRef.current, {
        emoji: faixa?.emoji, titulo: faixa?.titulo, acertos, total,
        tempoTexto: formatarDuracao(tempoMs), nomeCampanha, primeiroNome, logoImg, link,
      });
    };
    const logo = new Image();
    logo.onload = () => desenhar(logo);
    logo.onerror = () => desenhar(null);
    logo.src = '/logo-rjnet.svg';
    return () => { cancelado = true; };
  }, [faixa, acertos, total, tempoMs, nomeCampanha, primeiroNome, slug]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return;
    try {
      setSuportaArquivo(navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] }));
    } catch {
      setSuportaArquivo(false);
    }
  }, []);

  const gerarBlob = () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'));

  const compartilhar = async () => {
    setOcupado(true);
    try {
      const blob = await gerarBlob();
      const arquivo = new File([blob], `resultado-quiz-${slug}.png`, { type: 'image/png' });
      await navigator.share({
        files: [arquivo],
        title: 'Meu resultado no Quiz RJNet',
        text: `${primeiroNome} acertou ${acertos} de ${total} e é ${faixa?.titulo}! ${faixa?.emoji || ''}`.trim(),
      });
    } catch {
      /* usuário cancelou o compartilhamento ou o navegador recusou — sem erro visível pro usuário */
    } finally {
      setOcupado(false);
    }
  };

  const baixar = async () => {
    setOcupado(true);
    try {
      const blob = await gerarBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resultado-quiz-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div style={{ marginTop: 22 }}>
      <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 300, borderRadius: 14, boxShadow: '0 0 0 1px var(--border)' }} />
      <button
        type="button" className="btn-primary btn-full" style={{ marginTop: 14 }}
        onClick={suportaArquivo ? compartilhar : baixar}
        disabled={ocupado}
      >
        {ocupado ? 'Um instante...' : suportaArquivo ? '📤 Compartilhar resultado' : '⬇️ Baixar imagem do resultado'}
      </button>
    </div>
  );
}

function buscarSimuladorLocal(slug) {
  try {
    const todos = JSON.parse(localStorage.getItem('rjnet_simuladores')) || [];
    return todos.find((s) => s.slug === slug && s.ativo) || null;
  } catch {
    return null;
  }
}

function capturarUtm() {
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  for (const key of UTM_KEYS) {
    const valor = (params.get(key) || '').trim().slice(0, 120);
    if (valor) utm[key] = valor;
  }
  return Object.keys(utm).length > 0 ? utm : null;
}

// Serviço de interesse do Lead deriva do PERFIL deduzido (D-074/D-077,
// sempre presente no tipo 'oferta'), não das perguntas de qualificação
// diretamente — não têm uma chave garantida tipo "usos"/"streaming" fora
// desse mapeamento.
function servicosInteressePorPerfil(perfilKey) {
  return perfilKey === 'streaming' ? ['internet_residencial', 'streamings'] : ['internet_residencial'];
}

export default function SimuladorPublico({ slug }) {
  const [simulador, setSimulador] = useState(undefined); // undefined = carregando
  // Ambos os tipos: perguntas → calculando → resultado(-demanda) → contato → enviado
  const [fase, setFase] = useState('carregando');
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [combo, setCombo] = useState({ yellow: false, black: false, upgrade: false, movel: null });
  const [appInfo, setAppInfo] = useState(null); // 'yellow' | 'black' | null — popup de conteúdo do app
  const [contato, setContato] = useState({ nome: '', telefone: '', bairro: '', cidade: '' });
  const [consentimentoColetado, setConsentimentoColetado] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot — humano nunca preenche
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  // D-082: cronômetro do quiz (início → última pergunta respondida), só pra
  // exibição no resumo compartilhável — nunca enviado ao servidor.
  const inicioQuizRef = useRef(null);
  const [tempoQuizMs, setTempoQuizMs] = useState(null);

  const utm = useMemo(capturarUtm, []);

  useEffect(() => {
    const aoCarregar = (s) => {
      setSimulador(s);
      if (!s) return;
      setEtapa(0);
      setFase('perguntas');
      inicioQuizRef.current = Date.now();
    };
    if (!supabaseConfig.url) {
      aoCarregar(buscarSimuladorLocal(slug));
      return;
    }
    fetchSimuladorPublico(slug).then(aoCarregar);
  }, [slug]);

  const tipo = simulador?.tipo;

  // Questionário desta sessão: 'oferta' usa o quiz FIXO de qualificação
  // (PERGUNTAS_OFERTA); 'demanda' usa o questionário DESTA campanha (D-075,
  // cai pro molde padrão só quando a campanha nunca teve `perguntas`
  // configurada — null/undefined, criada antes do D-075). Um array VAZIO
  // em 'demanda' é um estado diferente — o marketing removeu tudo — e não
  // deve mascarar isso com o molde padrão (ver guarda abaixo).
  const perguntas = useMemo(() => {
    if (tipo === 'oferta') return PERGUNTAS_OFERTA;
    if (tipo === 'quiz') return simulador?.quizPerguntas == null ? quizPerguntasPadrao() : simulador.quizPerguntas;
    return simulador?.perguntas == null ? perguntasPadrao() : simulador.perguntas;
  }, [tipo, simulador]);
  const pergunta = perguntas[etapa];

  // Perfil deduzido (só 'oferta') a partir das respostas do quiz de
  // qualificação — nunca escolhido por clique direto (D-077).
  const perfilKey = useMemo(
    () => (tipo === 'oferta' ? perfilPorRespostasOferta(normalizarRespostasDinamico(perguntas, respostas)) : null),
    [tipo, perguntas, respostas],
  );
  const perfilDef = perfilPorKey(perfilKey);
  const comboCalc = useMemo(
    () => (perfilKey ? montarCombo(perfilKey, combo) : null),
    [perfilKey, combo],
  );
  // Ligado ao perfil deduzido — não a uma pergunta de intenção específica.
  const streamingDeclarado = perfilKey === 'streaming';

  // D-080: correção do quiz de acertos — só UX (a Edge Function recalcula
  // no servidor a partir da própria config gravada).
  const resultadoQuiz = useMemo(
    () => (tipo === 'quiz' ? corrigirQuiz(perguntas, respostas) : null),
    [tipo, perguntas, respostas],
  );
  const faixaQuiz = useMemo(() => {
    if (!resultadoQuiz) return null;
    const faixas = simulador?.quizFaixas == null ? quizFaixasPadrao() : simulador.quizFaixas;
    return faixaPorAcertos(faixas, resultadoQuiz.acertos) || { emoji: '🎯', titulo: 'Participante' };
  }, [resultadoQuiz, simulador]);

  const avancar = () => {
    if (etapa + 1 < perguntas.length) {
      setEtapa(etapa + 1);
    } else {
      if (tipo === 'quiz' && inicioQuizRef.current) {
        setTempoQuizMs(Date.now() - inicioQuizRef.current);
      }
      setFase('calculando');
      const proximaFase = tipo === 'oferta' ? 'resultado' : tipo === 'quiz' ? 'resultado-quiz' : 'resultado-demanda';
      setTimeout(() => setFase(proximaFase), 1400);
    }
  };

  const responderSingle = (opcaoId) => {
    const novas = { ...respostas, [pergunta.id]: opcaoId };
    setRespostas(novas);
    avancar();
  };

  const toggleMulti = (opcaoId) => {
    const atual = respostas[pergunta.id] || [];
    const novo = atual.includes(opcaoId) ? atual.filter((k) => k !== opcaoId) : [...atual, opcaoId];
    setRespostas({ ...respostas, [pergunta.id]: novo });
  };

  const voltar = () => {
    if (etapa > 0) setEtapa(etapa - 1);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErro('');

    if (website.trim() !== '') { setFase('enviado'); return; } // honeypot: aceita silenciosamente

    if (!contato.nome.trim()) { setErro('Informe seu nome.'); return; }
    if (containsLink(contato.nome)) { setErro('O nome não pode conter link.'); return; }
    if (!validarTelefone(contato.telefone)) { setErro('Telefone inválido. Informe DDD + número.'); return; }
    if (containsLink(contato.bairro) || containsLink(contato.cidade)) { setErro('Bairro/cidade não podem conter link.'); return; }
    if (!consentimentoColetado) { setErro('É necessário confirmar o uso dos seus dados para continuar.'); return; }

    if (!supabaseConfig.url) {
      if (tipo === 'demanda') {
        const p = calcularPerfilDinamico(perguntas, respostas);
        salvarLeadPublicoLocal({
          origem: 'simulador', simuladorId: simulador.id,
          nome: contato.nome, telefone: contato.telefone,
          bairro: contato.bairro, cidade: contato.cidade,
          perfilConsumo: { versao: PERGUNTAS_SIMULADOR_VERSAO, perguntas, respostas: p.respostas },
          pontuacao: p.pontuacao, servicoInteresse: ['internet_residencial'],
          temperatura: p.temperatura,
          utm, versaoTermo: 'simulador-v1',
        });
      } else if (tipo === 'quiz') {
        salvarLeadPublicoLocal({
          origem: 'simulador', simuladorId: simulador.id,
          nome: contato.nome, telefone: contato.telefone,
          bairro: contato.bairro, cidade: contato.cidade,
          perfilConsumo: {
            versao: PERGUNTAS_SIMULADOR_VERSAO, tipo: 'quiz', perguntas,
            respostas: resultadoQuiz.respostas, acertos: resultadoQuiz.acertos, total: resultadoQuiz.total, faixa: faixaQuiz,
          },
          pontuacao: resultadoQuiz.acertos, servicoInteresse: ['outro'],
          temperatura: resultadoQuiz.temperatura,
          utm, versaoTermo: 'simulador-v1',
        });
      } else {
        const p = normalizarRespostasDinamico(perguntas, respostas);
        salvarLeadPublicoLocal({
          origem: 'simulador', simuladorId: simulador.id,
          nome: contato.nome, telefone: contato.telefone,
          bairro: contato.bairro, cidade: contato.cidade,
          perfilConsumo: { versao: PERGUNTAS_SIMULADOR_VERSAO, perguntas, respostas: p, perfil: perfilKey, combo: comboCalc },
          ofertaRecomendada: 'internet_residencial',
          temperatura: 'quente', servicoInteresse: servicosInteressePorPerfil(perfilKey),
          utm, versaoTermo: 'simulador-v1',
        });
      }
      setFase('enviado');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(`${supabaseConfig.url}/functions/v1/submeter-simulador`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        },
        body: JSON.stringify({
          simuladorId: simulador.id,
          respostas,
          combo: tipo === 'oferta' ? combo : undefined,
          nome: contato.nome, telefone: contato.telefone,
          bairro: contato.bairro, cidade: contato.cidade,
          utm, consentimentoColetado, website,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Não foi possível enviar seus dados.');
      setFase('enviado');
    } catch (err) {
      setErro(err.message || 'Não foi possível enviar seus dados. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (simulador === undefined) {
    return <div className="qr-public-shell"><div className="card" style={{ textAlign: 'center', padding: 40 }}>Carregando...</div></div>;
  }
  if (!simulador) {
    return <div className="qr-public-shell"><div className="card" style={{ textAlign: 'center', padding: 40 }}>Simulação não encontrada ou encerrada.</div></div>;
  }
  if ((tipo === 'demanda' || tipo === 'quiz') && perguntas.length === 0) {
    return <div className="qr-public-shell"><div className="card" style={{ textAlign: 'center', padding: 40 }}>Essa campanha ainda está sendo preparada. Volte em instantes.</div></div>;
  }

  // ─── Enviado ──────────────────────────────────────────────────
  if (fase === 'enviado') {
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 40, marginBottom: 20 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Recebemos seus dados!</div>
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>
            {tipo === 'demanda' && 'Em breve um consultor da RJNet entra em contato pelo WhatsApp.'}
            {tipo === 'quiz' && 'Valeu por participar! Você já está concorrendo ao brinde RJNET — fique de olho no WhatsApp.'}
            {tipo === 'oferta' && 'Em breve um consultor da RJNet entra em contato pelo WhatsApp com a oferta ideal pro seu perfil.'}
          </div>
          {/* D-082: resumo compartilhável — só no tipo quiz, que tem faixa/acertos pra mostrar */}
          {tipo === 'quiz' && faixaQuiz && resultadoQuiz && (
            <ResumoCompartilhavel
              faixa={faixaQuiz}
              acertos={resultadoQuiz.acertos}
              total={resultadoQuiz.total}
              tempoMs={tempoQuizMs}
              nomeCampanha={simulador?.nome}
              primeiroNome={contato.nome.trim().split(/\s+/)[0] || 'Você'}
              slug={slug}
            />
          )}
        </div>
      </div>
    );
  }

  // ─── Calculando (micro-transição de personalização) ───────────
  if (fase === 'calculando') {
    return (
      <div className="qr-public-shell">
        <div className="card sim-calculando">
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, marginBottom: 24 }} />
          <div className="sim-spinner" aria-hidden="true" />
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>Analisando suas respostas...</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>Encontrando a conexão ideal pra sua casa</div>
        </div>
      </div>
    );
  }

  // ─── Resultado — Demanda (D-076): mensagem personalizada da campanha ──
  if (fase === 'resultado-demanda') {
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ padding: '26px 22px', textAlign: 'center' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, marginBottom: 16 }} />
          <div className="sim-resultado-badge">Obrigado por responder!</div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, margin: '14px 0 4px' }}>
            {simulador.mensagemResultado || mensagemResultadoPadrao()}
          </p>
          <button type="button" className="btn-primary btn-full" style={{ marginTop: 16 }} onClick={() => setFase('contato')}>
            Quero ser contatado →
          </button>
        </div>
      </div>
    );
  }

  // ─── Resultado — Quiz de Acertos (D-080): contagem de acertos → faixa ──
  if (fase === 'resultado-quiz') {
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ padding: '26px 22px', textAlign: 'center' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, marginBottom: 16 }} />
          <div className="sim-resultado-badge">Resultado do quiz</div>
          <div style={{ fontSize: 40, margin: '14px 0 4px' }}>{faixaQuiz.emoji}</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{faixaQuiz.titulo}</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>
            Você acertou {resultadoQuiz.acertos} de {resultadoQuiz.total} perguntas!
          </div>
          <div className="sim-combo-destaque" style={{ borderRadius: 10, padding: '12px 14px', marginTop: 18, fontSize: 13.5, fontWeight: 700 }}>
            🎁 Deixe seu contato e concorra a um brinde RJNET!
          </div>
          <button type="button" className="btn-primary btn-full" style={{ marginTop: 12 }} onClick={() => setFase('contato')}>
            Quero concorrer ao brinde →
          </button>
        </div>
      </div>
    );
  }

  // ─── Resultado — Oferta: perfil DEDUZIDO do quiz → pacote + combo (D-077) ───
  if (fase === 'resultado') {
    const pacote = pacotePorMega(perfilDef.pacoteMega);
    const upgradePacote = pacoteUpgrade(perfilDef.pacoteMega);
    const appYellow = APPS_ADICIONAIS.find((a) => a.key === 'yellow');
    const appBlack = APPS_ADICIONAIS.find((a) => a.key === 'black');
    const toggleCombo = (chave) => setCombo((p) => ({ ...p, [chave]: !p[chave] }));
    const toggleMovel = (planoKey) => setCombo((p) => ({ ...p, movel: p.movel === planoKey ? null : planoKey }));

    return (
      <div className="qr-public-shell">
        <div className="card" style={{ padding: '26px 22px', textAlign: 'center' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, marginBottom: 16 }} />
          <div className="sim-resultado-badge">Pacote recomendado pro seu perfil</div>
          <div style={{ fontSize: 22, fontWeight: 800, margin: '10px 0 2px' }}>
            {pacote.mega} Mega{pacote.destaque ? ' ⭐' : ''}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 12 }}>{fmtMoeda(pacote.preco)}/mês</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 18px', textAlign: 'left' }}>
            <strong>{perfilDef.label}:</strong> {perfilDef.descricao}
          </p>

          <div className="sim-combo">
            <div className="sim-combo-titulo">Monte seu combo</div>
            <label className="sim-combo-check">
              <input type="checkbox" checked={combo.yellow} onChange={() => toggleCombo('yellow')} />
              <span>+{fmtMoeda(appYellow.preco)} — Adicione Apps {appYellow.nome}</span>
              <button type="button" className="sim-app-info-btn" onClick={(e) => { e.preventDefault(); setAppInfo('yellow'); }} aria-label={`Ver apps inclusos no ${appYellow.nome}`}>ⓘ</button>
            </label>
            <label className={'sim-combo-check' + (streamingDeclarado ? ' sim-combo-destaque' : '')}>
              <input type="checkbox" checked={combo.black} onChange={() => toggleCombo('black')} />
              <span>
                +{fmtMoeda(appBlack.preco)} — Adicione Apps {appBlack.nome}
                {streamingDeclarado && <span className="sim-combo-selo">combina com seu perfil</span>}
              </span>
              <button type="button" className="sim-app-info-btn" onClick={(e) => { e.preventDefault(); setAppInfo('black'); }} aria-label={`Ver apps inclusos no ${appBlack.nome}`}>ⓘ</button>
            </label>
            {upgradePacote && (
              <label className="sim-combo-check">
                <input type="checkbox" checked={combo.upgrade} onChange={() => toggleCombo('upgrade')} />
                <span>+{fmtMoeda(upgradePacote.preco - pacote.preco)} — Upgrade para {upgradePacote.mega} Mega</span>
              </label>
            )}

            <div className="sim-combo-movel">
              <div className="sim-combo-movel-titulo">📱 Adicione um plano Móvel</div>
              <div className="sim-movel-opcoes">
                {PLANOS_MOVEL.map((p) => (
                  <button
                    type="button" key={p.key}
                    className={'sim-movel-chip' + (combo.movel === p.key ? ' active' : '')}
                    onClick={() => toggleMovel(p.key)}
                  >
                    <span className="sim-movel-chip-nome">{p.plano} {p.franquia}</span>
                    <span className="sim-movel-chip-preco">+{fmtMoeda(p.preco)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-combo-total"><span>Total</span><span>{fmtMoeda(comboCalc.valorTotal)}/mês</span></div>
          </div>

          <button type="button" className="btn-primary btn-full" style={{ marginTop: 16 }} onClick={() => setFase('contato')}>
            Quero receber essa oferta →
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            Sem compromisso — um consultor te chama no WhatsApp.
          </div>
        </div>

        {/* Popup: quais apps entram em cada bundle (Yellow/Black) */}
        {appInfo && (
          <div className="sim-app-popup-overlay" onClick={() => setAppInfo(null)}>
            <div className="sim-app-popup" onClick={(e) => e.stopPropagation()}>
              <div className="sim-app-popup-head">
                <strong>Apps {APPS_ADICIONAIS.find((a) => a.key === appInfo).nome}</strong>
                <button type="button" className="sim-app-popup-close" onClick={() => setAppInfo(null)} aria-label="Fechar">×</button>
              </div>
              <div className="sim-app-popup-grid">
                {APPS_ADICIONAIS.find((a) => a.key === appInfo).itens.map((item) => (
                  <div key={item} className="sim-app-chip">{item}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Contato (só depois de entregar valor) ────────────────────
  if (fase === 'contato') {
    return (
      <div className="qr-public-shell">
        <form className="card" onSubmit={submit} style={{ padding: '24px 22px' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, display: 'block', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Quase lá!</div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
            {tipo === 'demanda' && 'Deixe seu contato pra gente te chamar com a melhor solução.'}
            {tipo === 'quiz' && 'Deixe seu contato pra confirmar sua participação e concorrer a um brinde RJNET.'}
            {tipo === 'oferta' && 'Deixe seu contato pra receber a oferta ideal pro seu perfil no WhatsApp.'}
          </p>

          {/* Honeypot — invisível para gente, visível para robô */}
          <input
            type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
            autoComplete="off" tabIndex={-1}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />

          <div className="big-field" style={{ marginBottom: 10 }}>
            <label>Nome *</label>
            <input maxLength={120} value={contato.nome} onChange={(e) => setContato((p) => ({ ...p, nome: e.target.value }))} autoFocus />
          </div>
          <div className="big-field" style={{ marginBottom: 10 }}>
            <label>WhatsApp *</label>
            <input maxLength={15} value={contato.telefone} onChange={(e) => setContato((p) => ({ ...p, telefone: maskTel(e.target.value) }))} placeholder="(24) 99999-9999" inputMode="tel" />
          </div>
          <div className="big-field" style={{ marginBottom: 10 }}>
            <label>Cidade</label>
            <input maxLength={80} value={contato.cidade} onChange={(e) => setContato((p) => ({ ...p, cidade: e.target.value }))} />
          </div>
          <div className="big-field" style={{ marginBottom: 10 }}>
            <label>Bairro</label>
            <input maxLength={80} value={contato.bairro} onChange={(e) => setContato((p) => ({ ...p, bairro: e.target.value }))} />
          </div>

          <label className="consentimento-check">
            <input type="checkbox" checked={consentimentoColetado} onChange={(e) => setConsentimentoColetado(e.target.checked)} />
            <span>
              Confirmo que forneci meus dados voluntariamente e autorizo a RJNet Telecomunicações a
              utilizá-los para recomendação de plano e contato comercial, conforme a LGPD.
            </span>
          </label>

          {erro && <div className="form-erro">{erro}</div>}

          <button type="submit" className="btn-primary btn-full" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Receber minha oferta'}
          </button>
        </form>
      </div>
    );
  }

  // ─── Perguntas (uma por tela) — 'oferta': quiz fixo de qualificação;
  // 'demanda'/'quiz': questionário configurável da campanha ──
  const totalPassos = perguntas.length;
  const progresso = Math.round(((etapa + 1) / totalPassos) * 100);
  const selecionadas = pergunta.tipo === 'multi' ? (respostas[pergunta.id] || []) : [];

  return (
    <div className="qr-public-shell">
      <div className="card" style={{ padding: '24px 22px' }}>
        <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 32, display: 'block', margin: '0 auto 14px' }} />
        <div className="sim-progress" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
          <div className="sim-progress-fill" style={{ width: `${progresso}%` }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 14px' }}>
          Pergunta {etapa + 1} de {totalPassos}
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>{pergunta.texto}</div>
        {pergunta.tipo === 'multi' && <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>Pode marcar mais de uma opção</div>}

        <div className="sim-opcoes" style={{ marginTop: 10 }}>
          {pergunta.opcoes.map((op) => {
            const ativa = pergunta.tipo === 'multi' ? selecionadas.includes(op.id) : respostas[pergunta.id] === op.id;
            return (
              <button
                type="button" key={op.id}
                className={'sim-opcao' + (ativa ? ' active' : '')}
                onClick={() => (pergunta.tipo === 'single' ? responderSingle(op.id) : toggleMulti(op.id))}
              >
                {op.texto}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {etapa > 0 && <button type="button" className="btn-ghost" style={{ flex: '0 0 auto' }} onClick={voltar}>← Voltar</button>}
          {pergunta.tipo === 'multi' && (
            <button
              type="button" className="btn-primary" style={{ flex: 1 }}
              disabled={selecionadas.length === 0}
              onClick={avancar}
            >
              Continuar →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
