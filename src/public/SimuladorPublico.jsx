import React, { useEffect, useMemo, useState } from 'react';
import { supabaseConfig } from '../lib/supabase';
import { fetchSimuladorPublico } from '../lib/dataService';
import {
  PERGUNTAS_SIMULADOR_VERSAO, perguntasPadrao, calcularPerfilDinamico, mensagemResultadoPadrao,
  PERFIS_SIMULADOR, perfilPorKey, pacotePorMega, pacoteUpgrade, montarCombo,
  APPS_ADICIONAIS, fmtMoeda,
} from '../lib/simulador';
import { maskTel, validarTelefone } from '../utils/masks';
import { salvarLeadPublicoLocal } from '../lib/localPublicSubmit';
import { containsLink } from '../lib/security';

// Página pública do Simulador — sem sessão, sem AppContext (mesmo desenho
// do FormularioPublico). Wizard gamificado: "valor antes do dado" — só
// pede contato depois de mostrar algo pra pessoa.
//
// D-076: 2 fluxos públicos INDEPENDENTES por campanha, nunca mais
// encadeados na mesma sessão (a antiga combinação confundia o marketing:
// "Pergunta 1" no construtor aparecia como a 2ª tela do quiz, atrás da
// etapa fixa de perfil):
// - tipo 'oferta': perfil de uso (D-074, fixo) → pacote + combo → contato.
//   Sem perguntas configuráveis nesse fluxo.
// - tipo 'demanda': perguntas configuráveis da PRÓPRIA campanha (D-075) →
//   mensagem de resultado personalizada pela campanha → contato. Sem
//   pergunta de perfil/pacote nesse fluxo. Substitui o antigo tipo
//   'territorial' (removido) como captação qualificada sem pacote fixo.
// O score exibido aqui é só UX: a Edge Function submeter-simulador busca
// sua PRÓPRIA cópia da config da campanha no banco e recalcula tudo no
// servidor — nunca confia no que o cliente manda.
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

// Serviço de interesse do Lead deriva do PERFIL escolhido (D-074, sempre
// presente no tipo 'oferta'), não das perguntas de intenção (agora livres
// — não dá pra depender de uma chave fixa tipo "usos"/"streaming").
function servicosInteressePorPerfil(perfilKey) {
  return perfilKey === 'streaming' ? ['internet_residencial', 'streamings'] : ['internet_residencial'];
}

export default function SimuladorPublico({ slug }) {
  const [simulador, setSimulador] = useState(undefined); // undefined = carregando
  // Oferta: perfil → calculando → resultado → contato → enviado
  // Demanda: perguntas → calculando → resultado-demanda → contato → enviado
  const [fase, setFase] = useState('carregando');
  const [perfilEscolhido, setPerfilEscolhido] = useState(null); // D-074: categoria fixa → pacote (só 'oferta')
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [combo, setCombo] = useState({ yellow: false, black: false, upgrade: false });
  const [appInfo, setAppInfo] = useState(null); // 'yellow' | 'black' | null — popup de conteúdo do app
  const [contato, setContato] = useState({ nome: '', telefone: '', bairro: '', cidade: '' });
  const [consentimentoColetado, setConsentimentoColetado] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot — humano nunca preenche
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const utm = useMemo(capturarUtm, []);

  useEffect(() => {
    const aoCarregar = (s) => {
      setSimulador(s);
      if (!s) return;
      if (s.tipo === 'demanda') { setEtapa(0); setFase('perguntas'); }
      else setFase('perfil');
    };
    if (!supabaseConfig.url) {
      aoCarregar(buscarSimuladorLocal(slug));
      return;
    }
    fetchSimuladorPublico(slug).then(aoCarregar);
  }, [slug]);

  const tipo = simulador?.tipo;

  // D-075: questionário DESTA campanha (tipo 'demanda') — cai pro molde
  // padrão só quando a campanha nunca teve `perguntas` configurada
  // (null/undefined, criada antes do D-075). Um array VAZIO é um estado
  // diferente — o marketing removeu tudo — e não deve mascarar isso com o
  // molde padrão (ver guarda de "campanha ainda sendo preparada" abaixo).
  const perguntas = useMemo(
    () => (simulador?.perguntas == null ? perguntasPadrao() : simulador.perguntas),
    [simulador],
  );
  const pergunta = perguntas[etapa];
  const perfilDef = perfilPorKey(perfilEscolhido);
  const comboCalc = useMemo(
    () => (perfilEscolhido ? montarCombo(perfilEscolhido, combo) : null),
    [perfilEscolhido, combo],
  );
  // Ligado ao perfil escolhido (D-074) — não às perguntas de intenção, que
  // agora são livres e não têm mais uma chave garantida.
  const streamingDeclarado = perfilEscolhido === 'streaming';

  const avancar = () => {
    if (etapa + 1 < perguntas.length) {
      setEtapa(etapa + 1);
    } else {
      setFase('calculando');
      setTimeout(() => setFase('resultado-demanda'), 1400);
    }
  };

  const escolherPerfil = (key) => {
    setPerfilEscolhido(key);
    setFase('calculando');
    setTimeout(() => setFase('resultado'), 1400);
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
      } else {
        salvarLeadPublicoLocal({
          origem: 'simulador', simuladorId: simulador.id,
          nome: contato.nome, telefone: contato.telefone,
          bairro: contato.bairro, cidade: contato.cidade,
          perfilConsumo: { versao: PERGUNTAS_SIMULADOR_VERSAO, perfil: perfilEscolhido, combo: comboCalc },
          ofertaRecomendada: 'internet_residencial',
          temperatura: 'quente', servicoInteresse: servicosInteressePorPerfil(perfilEscolhido),
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
          respostas: tipo === 'demanda' ? respostas : undefined,
          perfil: tipo === 'oferta' ? perfilEscolhido : undefined,
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
  if (tipo === 'demanda' && perguntas.length === 0) {
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
            {tipo === 'demanda'
              ? 'Em breve um consultor da RJNet entra em contato pelo WhatsApp.'
              : 'Em breve um consultor da RJNet entra em contato pelo WhatsApp com a oferta ideal pro seu perfil.'}
          </div>
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

  // ─── Resultado — Oferta: pacote fixo do perfil + combo de upsell (D-074) ───
  if (fase === 'resultado') {
    const pacote = pacotePorMega(perfilDef.pacoteMega);
    const upgradePacote = pacoteUpgrade(perfilDef.pacoteMega);
    const appYellow = APPS_ADICIONAIS.find((a) => a.key === 'yellow');
    const appBlack = APPS_ADICIONAIS.find((a) => a.key === 'black');
    const toggleCombo = (chave) => setCombo((p) => ({ ...p, [chave]: !p[chave] }));

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
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, marginBottom: 14 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Quase lá!</div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
            {tipo === 'demanda'
              ? 'Deixe seu contato pra gente te chamar com a melhor solução.'
              : 'Deixe seu contato pra receber a oferta ideal pro seu perfil no WhatsApp.'}
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

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 14px' }}>
            <input type="checkbox" checked={consentimentoColetado} onChange={(e) => setConsentimentoColetado(e.target.checked)} style={{ marginTop: 2 }} />
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

  // ─── Perfil de uso (D-074, tipo 'oferta'): única etapa, decide o pacote ──
  if (fase === 'perfil') {
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ padding: '24px 22px' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 32, marginBottom: 14 }} />
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, marginBottom: 10 }}>
            Qual desses combina mais com você?
          </div>
          <div className="sim-opcoes">
            {PERFIS_SIMULADOR.map((p) => (
              <button type="button" key={p.key} className="sim-opcao sim-opcao-perfil" onClick={() => escolherPerfil(p.key)}>
                <span className="sim-opcao-perfil-label">{p.label}</span>
                <span className="sim-opcao-perfil-desc">{p.descricao}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Perguntas de intenção (tipo 'demanda', uma por tela, D-075) ──
  const totalPassos = perguntas.length;
  const progresso = Math.round(((etapa + 1) / totalPassos) * 100);
  const selecionadas = pergunta.tipo === 'multi' ? (respostas[pergunta.id] || []) : [];

  return (
    <div className="qr-public-shell">
      <div className="card" style={{ padding: '24px 22px' }}>
        <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 32, marginBottom: 14 }} />
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
