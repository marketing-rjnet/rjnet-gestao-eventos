import React, { useEffect, useMemo, useState } from 'react';
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
import { salvarLeadPublicoLocal, criarLeadSimuladorQuizLocal, concluirLeadSimuladorQuizLocal, leadSimuladorQuizDuplicado } from '../lib/localPublicSubmit';
import { containsLink } from '../lib/security';

// Página pública do Simulador — sem sessão, sem AppContext (mesmo desenho
// do FormularioPublico). Wizard gamificado: "valor antes do dado" — só
// pede contato depois de mostrar algo pra pessoa.
//
// D-077/D-080: os fluxos 'oferta'/'demanda' (D-076) têm a MESMA estrutura
// de tela — um quiz sequencial (uma pergunta por tela) seguido de
// "calculando" → resultado → contato. O que muda por tipo é só QUAL
// questionário e o que a etapa de resultado calcula/mostra:
// - tipo 'oferta': quiz FIXO de qualificação (PERGUNTAS_OFERTA) — o perfil
//   de uso (e portanto o pacote) é DEDUZIDO das respostas via
//   perfilPorRespostasOferta(), nunca escolhido por clique direto (isso
//   substitui a antiga tela única de 4 botões, D-074/D-076) → pacote +
//   combo de upsell (apps, upgrade de pacote, plano Móvel).
// - tipo 'demanda': perguntas configuráveis da PRÓPRIA campanha (D-075) →
//   mensagem de resultado personalizada pela campanha → contato. Sem
//   pergunta de perfil/pacote nesse fluxo.
// O score/perfil exibido aqui é só UX: a Edge Function submeter-simulador
// busca sua PRÓPRIA cópia da config (e do quiz fixo de oferta) e recalcula
// tudo no servidor — nunca confia no que o cliente manda.
//
// D-083: tipo 'quiz' passou a ter um fluxo PRÓPRIO, diferente de
// 'oferta'/'demanda' — cadastro ANTES do quiz, não depois:
//   cadastro (nome/WhatsApp/LGPD) → quiz (com feedback verde/vermelho por
//   resposta) → resultado (faixa) → CTA "Participar do sorteio" → mensagem
//   final.
// Isso garante o contato da pessoa mesmo que ela abandone o quiz no meio —
// o cadastro já foi gravado no servidor (INSERT) antes da 1ª pergunta; o
// quiz só faz um UPDATE nesse mesmo lead ao concluir. Só quem CONCLUI o
// quiz e clica no CTA concorre ao sorteio (quem só se cadastra vira lead
// de CRM normal, sem entrar na lista de sorteáveis — ver Sorteador em
// SimuladorTab.jsx/fetchLeadsPorSimulador). Progresso (cadastro feito,
// pergunta atual, respostas) fica em localStorage por slug — se a pessoa
// sair e voltar no MESMO navegador, retoma de onde parou sem se cadastrar
// de novo. O resumo compartilhável (D-082) foi removido por completo — não
// existe mais compartilhamento do resultado.
//
// D-084: o bloqueio de "1 chance só" NÃO é mais por navegador/aparelho —
// é por NÚMERO de WhatsApp dentro da campanha (checado no servidor, fase
// 'cadastro'). O MESMO aparelho pode cadastrar várias pessoas da mesma
// família (números diferentes) sem restrição nenhuma; só o MESMO número
// não pode se cadastrar 2 vezes. Por isso o localStorage só guarda
// progresso ENQUANTO o cadastro atual ainda não concluiu o quiz — ao
// concluir, o progresso é limpo (o aparelho fica livre pra cadastrar
// outra pessoa na sequência, sem nenhuma tela de "já participou" bloqueando
// por navegador).
//
// Atribuição de tráfego: captura utm_* da URL no load — o mesmo link
// atende anúncio pago (UTMs do gerenciador) e QR impresso (UTMs embutidos
// pelo SimuladorTab ao gerar o QR).

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

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

// D-083/D-084: progresso do Quiz de Acertos em localStorage, por slug — só
// usado pro tipo 'quiz'. Guarda o `leadId` devolvido pelo cadastro (fase
// 'cadastro' na Edge Function) + pergunta atual/respostas, só ENQUANTO o
// quiz está em andamento — permite retomar no mesmo navegador sem se
// cadastrar de novo. Ao concluir o quiz, a chave é apagada (o bloqueio de
// "1 chance só" passou a ser por número de WhatsApp no servidor, não mais
// por aparelho — ver D-084) — nunca guarda resultado do quiz, isso vive só
// no servidor.
function chaveQuizLocal(slug) {
  return `rjnet_simulador_quiz_${slug}`;
}

function lerProgressoQuizLocal(slug) {
  try {
    return JSON.parse(localStorage.getItem(chaveQuizLocal(slug)));
  } catch {
    return null;
  }
}

function salvarProgressoQuizLocal(slug, progresso) {
  try {
    localStorage.setItem(chaveQuizLocal(slug), JSON.stringify(progresso));
  } catch {
    /* localStorage indisponível — sem retomada, mas o cadastro/conclusão já foram gravados no servidor */
  }
}

function limparProgressoQuizLocal(slug) {
  try {
    localStorage.removeItem(chaveQuizLocal(slug));
  } catch {
    /* localStorage indisponível — nada a limpar */
  }
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
  // 'oferta'/'demanda': perguntas → calculando → resultado(-demanda) → contato → enviado
  // 'quiz' (D-083/D-084): quiz-cadastro → perguntas → calculando → resultado-quiz → quiz-sorteio-confirmado
  //                       (duplicidade de número é bloqueada no cadastro, nunca por navegador)
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
  // D-083: id do lead gravado no cadastro (fase 'cadastro' na Edge
  // Function) — só existe pro tipo 'quiz', usado depois pra concluir o
  // quiz (fase 'conclusao') no mesmo lead.
  const [leadId, setLeadId] = useState(null);
  // D-083: opcaoId revelado (correta em verde, demais em vermelho) — só
  // tipo 'quiz'; enquanto truthy, a pergunta atual fica travada.
  const [revelada, setRevelada] = useState(null);

  const utm = useMemo(capturarUtm, []);

  useEffect(() => {
    const aoCarregar = (s) => {
      setSimulador(s);
      if (!s) return;

      if (s.tipo === 'quiz') {
        // D-084: presença de progresso salvo == cadastro em andamento (a
        // chave é apagada ao concluir, ver confirmarSorteio) — retoma sem
        // recadastro; senão, tela de cadastro sempre disponível (o mesmo
        // aparelho pode cadastrar outra pessoa da família a qualquer hora).
        const salvo = lerProgressoQuizLocal(slug);
        if (salvo?.leadId) {
          setLeadId(salvo.leadId);
          setContato(salvo.contato || contato);
          setRespostas(salvo.respostas || {});
          setEtapa(salvo.etapa || 0);
          setFase('perguntas');
        } else {
          setFase('quiz-cadastro');
        }
        return;
      }

      setEtapa(0);
      setFase('perguntas');
    };
    if (!supabaseConfig.url) {
      aoCarregar(buscarSimuladorLocal(slug));
      return;
    }
    fetchSimuladorPublico(slug).then(aoCarregar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // D-083: persiste o progresso do quiz (pergunta atual + respostas) no
  // localStorage a cada mudança — permite retomar no mesmo navegador sem
  // se cadastrar de novo. Só grava depois do cadastro feito (leadId
  // presente) e enquanto ainda está em andamento (fase 'perguntas').
  useEffect(() => {
    if (simulador?.tipo === 'quiz' && leadId && fase === 'perguntas') {
      salvarProgressoQuizLocal(slug, { leadId, status: 'cadastrado', etapa, respostas, contato });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulador, leadId, fase, etapa, respostas]);

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

  // D-083: só tipo 'quiz' — revela a alternativa certa (verde) e as demais
  // erradas (vermelho) por 1,2s antes de avançar sozinho. Sem "Voltar":
  // uma vez revelada, a resposta daquela pergunta está travada (1 chance
  // só, sem refazer).
  const responderQuiz = (opcaoId) => {
    if (revelada) return;
    setRespostas((r) => ({ ...r, [pergunta.id]: opcaoId }));
    setRevelada(opcaoId);
    setTimeout(() => {
      setRevelada(null);
      avancar();
    }, 1200);
  };

  const toggleMulti = (opcaoId) => {
    const atual = respostas[pergunta.id] || [];
    const novo = atual.includes(opcaoId) ? atual.filter((k) => k !== opcaoId) : [...atual, opcaoId];
    setRespostas({ ...respostas, [pergunta.id]: novo });
  };

  const voltar = () => {
    if (etapa > 0) setEtapa(etapa - 1);
  };

  // D-083/D-084: cadastro (nome/WhatsApp/LGPD) ANTES do quiz — só tipo
  // 'quiz'. Grava o lead de verdade no servidor imediatamente (garante o
  // contato mesmo que a pessoa abandone o quiz depois); o quiz em si só faz
  // um UPDATE nesse mesmo lead ao concluir (confirmarSorteio abaixo). O
  // bloqueio de duplicidade é por NÚMERO de WhatsApp na mesma campanha
  // (verificado no servidor) — nunca por aparelho, então o mesmo celular
  // pode cadastrar várias pessoas da família sem problema.
  const submitCadastroQuiz = async (e) => {
    e.preventDefault();
    setErro('');

    if (website.trim() !== '') { setFase('perguntas'); return; } // honeypot: aceita silenciosamente, sem gravar nada

    if (!contato.nome.trim()) { setErro('Informe seu nome.'); return; }
    if (containsLink(contato.nome)) { setErro('O nome não pode conter link.'); return; }
    if (!validarTelefone(contato.telefone)) { setErro('Telefone inválido. Informe DDD + número.'); return; }
    if (containsLink(contato.bairro) || containsLink(contato.cidade)) { setErro('Bairro/cidade não podem conter link.'); return; }
    if (!consentimentoColetado) { setErro('É necessário confirmar o uso dos seus dados para continuar.'); return; }

    setEnviando(true);
    try {
      let novoLeadId;
      if (!supabaseConfig.url) {
        if (leadSimuladorQuizDuplicado(simulador.id, contato.telefone)) {
          setErro('Esse número de WhatsApp já está cadastrado nessa campanha.');
          setEnviando(false);
          return;
        }
        const novo = criarLeadSimuladorQuizLocal({
          simuladorId: simulador.id,
          nome: contato.nome, telefone: contato.telefone,
          bairro: contato.bairro, cidade: contato.cidade,
          utm, versaoTermo: 'simulador-v1',
        });
        novoLeadId = novo.id;
      } else {
        const res = await fetch(`${supabaseConfig.url}/functions/v1/submeter-simulador`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          },
          body: JSON.stringify({
            fase: 'cadastro', simuladorId: simulador.id,
            nome: contato.nome, telefone: contato.telefone,
            bairro: contato.bairro, cidade: contato.cidade,
            utm, consentimentoColetado, website,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Não foi possível enviar seus dados.');
        novoLeadId = body.leadId;
      }
      setLeadId(novoLeadId);
      setEtapa(0);
      setRespostas({});
      salvarProgressoQuizLocal(slug, { leadId: novoLeadId, status: 'cadastrado', etapa: 0, respostas: {}, contato });
      setFase('perguntas');
    } catch (err) {
      setErro(err.message || 'Não foi possível enviar seus dados. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // D-083/D-084: clique em "Participar do sorteio" — só tipo 'quiz'. Só
  // agora o resultado do quiz é gravado (UPDATE no lead do cadastro);
  // guardado no servidor por `pontuacao is null` (1 chance só pra ESSE
  // cadastro, sem corrida de concorrência). Depois disso o progresso local
  // é apagado — o bloqueio de reentrada não é mais por aparelho, é por
  // número de WhatsApp (checado no cadastro da próxima pessoa que tentar
  // usar o mesmo número); o mesmo navegador fica livre pra cadastrar outra
  // pessoa da família na sequência.
  const confirmarSorteio = async () => {
    setErro('');
    setEnviando(true);
    try {
      if (!supabaseConfig.url) {
        concluirLeadSimuladorQuizLocal(leadId, {
          perfilConsumo: {
            versao: PERGUNTAS_SIMULADOR_VERSAO, tipo: 'quiz', perguntas,
            respostas: resultadoQuiz.respostas, acertos: resultadoQuiz.acertos, total: resultadoQuiz.total, faixa: faixaQuiz,
          },
          pontuacao: resultadoQuiz.acertos,
          temperatura: resultadoQuiz.temperatura,
        });
      } else {
        const res = await fetch(`${supabaseConfig.url}/functions/v1/submeter-simulador`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          },
          body: JSON.stringify({ fase: 'conclusao', simuladorId: simulador.id, leadId, respostas }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Não foi possível registrar sua participação.');
      }
      limparProgressoQuizLocal(slug);
      setFase('quiz-sorteio-confirmado');
    } catch (err) {
      setErro(err.message || 'Não foi possível registrar sua participação. Tente novamente.');
    } finally {
      setEnviando(false);
    }
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
            {tipo === 'oferta' && 'Em breve um consultor da RJNet entra em contato pelo WhatsApp com a oferta ideal pro seu perfil.'}
          </div>
        </div>
      </div>
    );
  }

  // ─── Quiz: sorteio confirmado (D-083) — tela final depois do CTA ───────
  if (fase === 'quiz-sorteio-confirmado') {
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 40, marginBottom: 20 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Você está concorrendo! 🎉</div>
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Fique atenta às nossas redes sociais e ao seu WhatsApp para mais informações sobre o sorteio.
          </div>
        </div>
      </div>
    );
  }

  // ─── Quiz: cadastro ANTES do quiz (D-083) ──────────────────────
  if (fase === 'quiz-cadastro') {
    return (
      <div className="qr-public-shell">
        <form className="card" onSubmit={submitCadastroQuiz} style={{ padding: '24px 22px' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, display: 'block', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
            Cadastre-se para participar do quiz e concorrer a brindes RJNET!
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '0 0 16px', textAlign: 'center' }}>
            Responda todas as perguntas — você tem só 1 chance, sem pesquisar na internet.
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
              utilizá-los para contato comercial, conforme a LGPD.
            </span>
          </label>

          {erro && <div className="form-erro">{erro}</div>}

          <button type="submit" className="btn-primary btn-full" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Cadastrar e começar o quiz →'}
          </button>
        </form>
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

  // ─── Resultado — Quiz de Acertos (D-080/D-083): contagem de acertos →
  // faixa → CTA "Participar do sorteio" (só agora grava o resultado — o
  // cadastro/contato já foi feito antes do quiz) ──
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
            🎁 Confirme sua participação e concorra a um brinde RJNET!
          </div>
          {erro && <div className="form-erro" style={{ marginTop: 12 }}>{erro}</div>}
          <button type="button" className="btn-primary btn-full" style={{ marginTop: 12 }} onClick={confirmarSorteio} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Participar do sorteio →'}
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
  // 'demanda': questionário configurável da campanha; 'quiz': idem, mas com
  // feedback verde/vermelho por resposta (D-083) e sem "Voltar" (1 chance
  // só, resposta já revelada fica travada) ──
  const isQuizTipo = tipo === 'quiz';
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
            let classe = 'sim-opcao' + (ativa ? ' active' : '');
            if (isQuizTipo && revelada) {
              classe += op.id === pergunta.respostaCorretaId ? ' sim-opcao-correta' : ' sim-opcao-errada';
            }
            return (
              <button
                type="button" key={op.id}
                className={classe}
                disabled={isQuizTipo && !!revelada}
                onClick={() => {
                  if (isQuizTipo) responderQuiz(op.id);
                  else if (pergunta.tipo === 'single') responderSingle(op.id);
                  else toggleMulti(op.id);
                }}
              >
                {op.texto}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {!isQuizTipo && etapa > 0 && <button type="button" className="btn-ghost" style={{ flex: '0 0 auto' }} onClick={voltar}>← Voltar</button>}
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
