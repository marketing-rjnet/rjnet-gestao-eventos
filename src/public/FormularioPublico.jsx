import React, { useEffect, useState } from 'react';
import { supabaseConfig } from '../lib/supabase';
import { fetchFormularioPublico } from '../lib/dataService';
import { CAMPOS_FORMULARIO } from '../lib/constants';
import { SERVICO_LABEL } from '../utils/format';
import { maskCpf, maskTel, validarTelefone } from '../utils/masks';
import { salvarLeadPublicoLocal } from '../lib/localPublicSubmit';

// Página pública dinâmica do Form Builder — sem sessão, sem AppContext.
// Renderiza só os campos que o formulário escolheu, do catálogo fixo
// CAMPOS_FORMULARIO (nunca um tipo de campo desconhecido). Mesma lógica de
// destino dupla da página do QR Code: Edge Function quando o Supabase está
// configurado, fallback local em preview/dev sem backend.
function buscarFormularioLocal(slug) {
  try {
    const todos = JSON.parse(localStorage.getItem('rjnet_formularios')) || [];
    return todos.find((f) => f.slug === slug && f.ativo) || null;
  } catch {
    return null;
  }
}

export default function FormularioPublico({ slug }) {
  const [formulario, setFormulario] = useState(undefined); // undefined = carregando
  const [valores, setValores] = useState({});
  const [consentimentoColetado, setConsentimentoColetado] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot — humano nunca preenche
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!supabaseConfig.url) {
      setFormulario(buscarFormularioLocal(slug));
      return;
    }
    fetchFormularioPublico(slug).then(setFormulario);
  }, [slug]);

  const set = (k, v) => setValores((p) => ({ ...p, [k]: v }));

  const toggleServico = (key) => {
    const atual = valores.servicoInteresse || [];
    set('servicoInteresse', atual.includes(key) ? atual.filter((x) => x !== key) : [...atual, key]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErro('');

    if (website.trim() !== '') { setEnviado(true); return; } // honeypot: aceita silenciosamente sem gravar

    for (const key of formulario.camposObrigatorios) {
      const campo = CAMPOS_FORMULARIO.find((c) => c.key === key);
      if (!campo) continue;
      if (campo.tipo === 'servico' && !(valores.servicoInteresse || []).length) {
        setErro('Selecione ao menos um serviço de interesse.'); return;
      }
      if (campo.tipo === 'telefone' && !validarTelefone(valores.telefone || '')) {
        setErro('Telefone inválido. Informe DDD + número.'); return;
      }
      if (campo.tipo !== 'servico' && campo.tipo !== 'telefone' && !String(valores[key] || '').trim()) {
        setErro(`Preencha o campo "${campo.label}".`); return;
      }
    }
    if (!consentimentoColetado) { setErro('É necessário confirmar o uso dos seus dados para continuar.'); return; }

    if (!supabaseConfig.url) {
      salvarLeadPublicoLocal({ ...valores, origem: 'formulario', formularioId: formulario.id, nome: valores.nome || '(sem nome)' });
      setEnviado(true);
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(`${supabaseConfig.url}/functions/v1/submeter-formulario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        },
        body: JSON.stringify({ formularioId: formulario.id, valores, consentimentoColetado, website }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Não foi possível enviar seus dados.');
      setEnviado(true);
    } catch (err) {
      setErro(err.message || 'Não foi possível enviar seus dados. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (formulario === undefined) {
    return <div className="qr-public-shell"><div className="card" style={{ textAlign: 'center', padding: 40 }}>Carregando...</div></div>;
  }
  if (!formulario) {
    return <div className="qr-public-shell"><div className="card" style={{ textAlign: 'center', padding: 40 }}>Formulário não encontrado ou indisponível.</div></div>;
  }

  if (enviado) {
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 40, marginBottom: 20 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Recebemos seus dados!</div>
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Em breve um consultor da RJNet entra em contato com você.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-public-shell">
      <form className="card" onSubmit={submit} style={{ padding: '24px 22px' }}>
        <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, marginBottom: 18 }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{formulario.nome}</div>

        {/* Honeypot — invisível para gente, visível para robô */}
        <input
          type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
          autoComplete="off" tabIndex={-1}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          aria-hidden="true"
        />

        {formulario.campos.map((key) => {
          const campo = CAMPOS_FORMULARIO.find((c) => c.key === key);
          if (!campo) return null;
          const obrigatorio = formulario.camposObrigatorios.includes(key);

          if (campo.tipo === 'servico') {
            return (
              <div className="big-field" key={key} style={{ marginBottom: 14 }}>
                <label>{campo.label} {obrigatorio && '*'}</label>
                <div className="seg-control" style={{ flexWrap: 'wrap' }}>
                  {Object.keys(SERVICO_LABEL).map((s) => (
                    <button type="button" key={s}
                      className={'seg-btn' + ((valores.servicoInteresse || []).includes(s) ? ' active' : '')}
                      onClick={() => toggleServico(s)}>
                      {SERVICO_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          if (campo.tipo === 'telefone') {
            return (
              <div className="big-field" key={key} style={{ marginBottom: 10 }}>
                <label>{campo.label} {obrigatorio && '*'}</label>
                <input maxLength={15} value={valores.telefone || ''} onChange={(e) => set('telefone', maskTel(e.target.value))} placeholder="(24) 99999-9999" inputMode="tel" />
              </div>
            );
          }

          if (campo.tipo === 'cpf') {
            return (
              <div className="big-field" key={key} style={{ marginBottom: 10 }}>
                <label>{campo.label} {obrigatorio && '*'}</label>
                <input maxLength={14} value={valores.cpf || ''} onChange={(e) => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
              </div>
            );
          }

          return (
            <div className="big-field" key={key} style={{ marginBottom: 10 }}>
              <label>{campo.label} {obrigatorio && '*'}</label>
              <input maxLength={200} value={valores[key] || ''} onChange={(e) => set(key, e.target.value)} />
            </div>
          );
        })}

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 14px' }}>
          <input type="checkbox" checked={consentimentoColetado} onChange={(e) => setConsentimentoColetado(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            Confirmo que forneci meus dados voluntariamente e autorizo a RJNet Telecomunicações a
            utilizá-los para contato comercial, conforme a LGPD.
          </span>
        </label>

        {erro && <div className="form-erro">{erro}</div>}

        <button type="submit" className="btn-primary btn-full" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
