import React, { useState } from 'react';
import { supabaseConfig } from '../lib/supabase';
import { SERVICO_LABEL } from '../utils/format';
import { maskCpf, maskTel, validarTelefone } from '../utils/masks';

// Página pública — sem sessão, sem AppContext. O próprio titular preenche
// ao escanear o QR Code. Converge para o mesmo Lead de sempre, só que via
// Edge Function (captar-lead-qrcode) em vez do addLead() autenticado do
// app, porque aqui não existe usuário logado nenhum.
const FORM_VAZIO = { nome: '', telefone: '', cpf: '', endereco: '', servicoInteresse: [], consentimentoColetado: false };

export default function QrCapturaPublica({ qrCodeId, qrCodeLabel }) {
  const [f, setF] = useState(FORM_VAZIO);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const toggleServico = (key) => {
    const arr = f.servicoInteresse.includes(key)
      ? f.servicoInteresse.filter((x) => x !== key)
      : [...f.servicoInteresse, key];
    set('servicoInteresse', arr);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!f.nome.trim()) { setErro('Informe seu nome.'); return; }
    if (!validarTelefone(f.telefone)) { setErro('Telefone inválido. Informe DDD + número.'); return; }
    if (!f.servicoInteresse.length) { setErro('Selecione ao menos um serviço de interesse.'); return; }
    if (!f.consentimentoColetado) { setErro('É necessário confirmar o uso dos seus dados para continuar.'); return; }
    if (!supabaseConfig.url || !supabaseConfig.anonKey) { setErro('Formulário indisponível no momento. Tente novamente mais tarde.'); return; }

    setEnviando(true);
    try {
      const res = await fetch(`${supabaseConfig.url}/functions/v1/captar-lead-qrcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        },
        body: JSON.stringify({ ...f, qrCodeId, qrCodeLabel }),
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

  if (enviado) {
    return (
      <div className="qr-public-shell">
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 40, marginBottom: 20 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Recebemos seus dados!</div>
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Em breve um consultor da RJNet entra em contato com você.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-public-shell">
      <form className="card" onSubmit={submit} style={{ padding: '24px 22px' }}>
        <img src="/logo-rjnet.svg" alt="RJNet" style={{ height: 36, marginBottom: 18 }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Quero saber mais</div>
        {qrCodeLabel && <div style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 16 }}>{qrCodeLabel}</div>}

        <div className="big-field" style={{ marginBottom: 10 }}>
          <label>Nome completo *</label>
          <input required maxLength={120} value={f.nome} onChange={(e) => set('nome', e.target.value)} autoComplete="name" autoFocus />
        </div>
        <div className="big-field" style={{ marginBottom: 10 }}>
          <label>Telefone (WhatsApp) *</label>
          <input required maxLength={15} value={f.telefone} onChange={(e) => set('telefone', maskTel(e.target.value))} placeholder="(24) 99999-9999" inputMode="tel" autoComplete="tel" />
        </div>
        <div className="big-field" style={{ marginBottom: 10 }}>
          <label>Endereço <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-3)' }}>(opcional)</span></label>
          <input maxLength={200} value={f.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder="Rua, número, bairro" />
        </div>
        <div className="big-field" style={{ marginBottom: 10 }}>
          <label>CPF <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-3)' }}>(opcional — para visita técnica e contrato)</span></label>
          <input maxLength={14} value={f.cpf} onChange={(e) => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
        </div>
        <div className="big-field" style={{ marginBottom: 14 }}>
          <label>Serviço de interesse * (selecione um ou mais)</label>
          <div className="seg-control" style={{ flexWrap: 'wrap' }}>
            {Object.keys(SERVICO_LABEL).map((s) => (
              <button type="button" key={s}
                className={'seg-btn' + (f.servicoInteresse.includes(s) ? ' active' : '')}
                onClick={() => toggleServico(s)}>
                {SERVICO_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.5 }}>
          <input type="checkbox" checked={f.consentimentoColetado} onChange={(e) => set('consentimentoColetado', e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            Confirmo que forneci meus dados voluntariamente e autorizo a RJNet Telecomunicações a
            utilizá-los para contato comercial e apresentação de serviços, conforme a Lei Geral de
            Proteção de Dados (LGPD).
          </span>
        </label>

        {erro && <div className="form-erro">{erro}</div>}

        <button type="submit" className="btn-primary btn-full" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Quero receber contato'}
        </button>
      </form>
    </div>
  );
}
