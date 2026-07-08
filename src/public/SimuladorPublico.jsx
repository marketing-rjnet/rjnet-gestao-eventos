import React, { useEffect, useMemo, useState } from 'react';
import { supabaseConfig } from '../lib/supabase';
import { fetchSimuladorPublico } from '../lib/dataService';
import {
  PERGUNTAS_SIMULADOR_VERSAO, perguntasVisiveis, calcularPerfil, RECOMENDACAO_POR_NIVEL,
} from '../lib/simulador';
import { maskTel, validarTelefone } from '../utils/masks';
import { salvarLeadPublicoLocal } from '../lib/localPublicSubmit';
import { containsLink } from '../lib/security';

// Página pública do Simulador de Perfil de Consumo — sem sessão, sem
// AppContext (mesmo desenho do FormularioPublico). Wizard gamificado:
// uma pergunta por tela → "analisando" → recomendação personalizada →
// SÓ ENTÃO pede contato (valor antes do dado, decisão de produto).
//
// O score exibido aqui é só UX: a Edge Function submeter-simulador
// recalcula tudo no servidor a partir das respostas brutas.
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

export default function SimuladorPublico({ slug }) {
  const [simulador, setSimulador] = useState(undefined); // undefined = carregando
  // fase: perguntas → calculando → resultado → contato → enviado
  const [fase, setFase] = useState('perguntas');
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [contato, setContato] = useState({ nome: '', telefone: '', bairro: '', cidade: '' });
  const [consentimentoColetado, setConsentimentoColetado] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot — humano nunca preenche
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const utm = useMemo(capturarUtm, []);

  useEffect(() => {
    if (!supabaseConfig.url) {
      setSimulador(buscarSimuladorLocal(slug));
      return;
    }
    fetchSimuladorPublico(slug).then(setSimulador);
  }, [slug]);

  const visiveis = perguntasVisiveis(respostas);
  const pergunta = visiveis[etapa];
  const perfil = useMemo(
    () => (fase === 'resultado' || fase === 'contato' ? calcularPerfil(respostas) : null),
    [fase, respostas],
  );

  const avancar = (novasRespostas) => {
    // As perguntas visíveis podem mudar com a resposta (condicional
    // tem_internet → dificuldade), então recalcula a lista antes de decidir
    // se acabou.
    const lista = perguntasVisiveis(novasRespostas);
    if (etapa + 1 < lista.length) {
      setEtapa(etapa + 1);
    } else {
      setFase('calculando');
      setTimeout(() => setFase('resultado'), 1400);
    }
  };

  const responderSingle = (opcaoKey) => {
    const novas = { ...respostas, [pergunta.key]: opcaoKey };
    setRespostas(novas);
    avancar(novas);
  };

  const toggleMulti = (opcaoKey) => {
    const atual = respostas[pergunta.key] || [];
    const novo = atual.includes(opcaoKey) ? atual.filter((k) => k !== opcaoKey) : [...atual, opcaoKey];
    setRespostas({ ...respostas, [pergunta.key]: novo });
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
      const p = calcularPerfil(respostas);
      salvarLeadPublicoLocal({
        origem: 'simulador', simuladorId: simulador.id,
        nome: contato.nome, telefone: contato.telefone,
        bairro: contato.bairro, cidade: contato.cidade,
        perfilConsumo: { versao: PERGUNTAS_SIMULADOR_VERSAO, respostas: p.respostas },
        pontuacao: p.pontuacao, ofertaRecomendada: p.ofertaRecomendada,
        temperatura: p.temperatura, servicoInteresse: p.servicosInteresse,
        utm, versaoTermo: 'simulador-v1',
      });
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

  // ─── Enviado ──────────────────────────────────────────────────
  if (fase === 'enviado') {
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 40, marginBottom: 20 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Recebemos seus dados!</div>
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Em breve um consultor da RJNet entra em contato pelo WhatsApp com a oferta ideal pro seu perfil.
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
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>Analisando seu perfil...</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>Encontrando a conexão ideal pra sua casa</div>
        </div>
      </div>
    );
  }

  // ─── Resultado (valor antes do contato) ───────────────────────
  if (fase === 'resultado') {
    const rec = RECOMENDACAO_POR_NIVEL[perfil.nivel];
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, marginBottom: 18 }} />
          <div className="sim-resultado-badge">Resultado do seu perfil</div>
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, margin: '10px 0 10px' }}>{rec.titulo}</div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 18px' }}>{rec.texto}</p>
          <button type="button" className="btn-primary btn-full" onClick={() => setFase('contato')}>
            Quero receber essa oferta →
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            Sem compromisso — um consultor te chama no WhatsApp.
          </div>
        </div>
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
            Deixe seu contato pra receber a oferta ideal pro seu perfil no WhatsApp.
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

  // ─── Perguntas (uma por tela) ─────────────────────────────────
  const progresso = Math.round(((etapa + 1) / visiveis.length) * 100);
  const selecionadas = pergunta.tipo === 'multi' ? (respostas[pergunta.key] || []) : [];

  return (
    <div className="qr-public-shell">
      <div className="card" style={{ padding: '24px 22px' }}>
        <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 32, marginBottom: 14 }} />
        <div className="sim-progress" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
          <div className="sim-progress-fill" style={{ width: `${progresso}%` }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 14px' }}>
          Pergunta {etapa + 1} de {visiveis.length}
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>{pergunta.label}</div>
        {pergunta.hint && <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>{pergunta.hint}</div>}

        <div className="sim-opcoes" style={{ marginTop: 10 }}>
          {pergunta.opcoes.map((op) => {
            const ativa = pergunta.tipo === 'multi' ? selecionadas.includes(op.key) : respostas[pergunta.key] === op.key;
            return (
              <button
                type="button" key={op.key}
                className={'sim-opcao' + (ativa ? ' active' : '')}
                onClick={() => (pergunta.tipo === 'single' ? responderSingle(op.key) : toggleMulti(op.key))}
              >
                {op.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {etapa > 0 && (
            <button type="button" className="btn-ghost" style={{ flex: '0 0 auto' }} onClick={voltar}>← Voltar</button>
          )}
          {pergunta.tipo === 'multi' && (
            <button
              type="button" className="btn-primary" style={{ flex: 1 }}
              disabled={selecionadas.length === 0}
              onClick={() => avancar(respostas)}
            >
              Continuar →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
