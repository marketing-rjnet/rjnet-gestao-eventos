import React, { useEffect, useState } from 'react';
import { formatarDigitosCronometro } from '../lib/desafioCronometro';

// D-098: campo de cronômetro do Desafio RJNet com máscara automática
// MM:SS:CC — o operador digita só números ("0333") e o campo já formata
// sozinho ("00:03:33"), sem precisar digitar os dois-pontos manualmente.
// Mesma ideia de um campo de valor monetário: mantém um buffer interno
// de até 6 dígitos "crus" e preenche da direita pra esquerda (o último
// dígito digitado é sempre o de centésimos) — ver formatarDigitosCronometro
// em src/lib/desafioCronometro.js pra a conta pura.
//
// `value`/`onChange` seguem o mesmo contrato de string formatada
// ("00:03:33") já usado pelos campos de cronômetro do módulo — este
// componente só troca COMO o operador preenche esse valor, nunca o
// formato armazenado/validado a jusante (validarFormatoTempo/
// parseTempoParaCentesimos em desafioCronometro.js não mudam).
//
// Captura via onKeyDown (só dígitos/Backspace são aceitos, qualquer
// outra tecla é bloqueada — "não permitir caracteres inválidos" da
// especificação) em vez do onChange tradicional dos demais campos
// mascarados do projeto (maskCpf/maskTel, src/utils/masks.js): esses
// preenchem da ESQUERDA pra direita (progressivo), então dá pra derivar
// o novo valor só a partir do texto final. Aqui o preenchimento é da
// DIREITA pra esquerda (padStart) — o texto exibido já nasce com 6
// dígitos assim que o primeiro é digitado, então não dá pra inferir
// inserção/remoção só comparando o comprimento do valor final; por isso
// o buffer de dígitos crus fica no estado do componente, atualizado
// tecla a tecla. onChange nativo continua tratado como fallback (ver
// onChangeNativo) para preenchimento automático do navegador e para
// testes automatizados (`.fill()` do Playwright define o valor do DOM
// direto, sem passar por onKeyDown).
const TECLAS_NAVEGACAO = new Set([
  'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End', 'Enter', 'Escape',
]);

export function CronometroInput({ value, onChange, autoFocus, placeholder = '00:03:33', className, style, disabled, id }) {
  const [digitos, setDigitos] = useState(() => (value ? value.replace(/\D/g, '') : '').slice(-6));

  // Ressincroniza com o `value` externo só quando ele diverge do que
  // este componente já renderizaria sozinho (reset do campo após
  // submit, prefill) — evita loop com o próprio onChange emitido abaixo.
  useEffect(() => {
    const proprio = digitos ? formatarDigitosCronometro(digitos) : '';
    if ((value || '') !== proprio) {
      setDigitos(value ? value.replace(/\D/g, '').slice(-6) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emitir = (novosDigitos) => {
    setDigitos(novosDigitos);
    onChange(novosDigitos ? formatarDigitosCronometro(novosDigitos) : '');
  };

  const onKeyDown = (e) => {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      emitir((digitos + e.key).slice(-6));
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      emitir(digitos.slice(0, -1));
      return;
    }
    if (TECLAS_NAVEGACAO.has(e.key) || e.ctrlKey || e.metaKey) return; // navegação, atalhos (copiar/selecionar), submit
    e.preventDefault(); // qualquer outro caractere é bloqueado — só números
  };

  const onPaste = (e) => {
    e.preventDefault();
    const colado = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
    if (colado) emitir((digitos + colado).slice(-6));
  };

  // Fallback pro valor mudar sem passar por onKeyDown/onPaste (autofill
  // do navegador, `.fill()` do Playwright) — trata o valor inteiro como
  // novo buffer, mesmo princípio do onPaste. Na digitação normal isso
  // nunca dispara sozinho: onKeyDown já bloqueia/trata tudo antes do
  // valor nativo do input mudar.
  const onChangeNativo = (e) => {
    const bruto = e.target.value.replace(/\D/g, '');
    if (bruto !== digitos) emitir(bruto.slice(-6));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={digitos ? formatarDigitosCronometro(digitos) : ''}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onChange={onChangeNativo}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      className={className}
      style={style}
    />
  );
}
