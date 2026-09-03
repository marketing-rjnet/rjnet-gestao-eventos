# Integração de uma Landing Page ao RJNET Gestão (D-104)

> Guia operacional. Vale para a LP Fibra e para qualquer LP futura (TV, Móvel, sazonal, promocional) — o procedimento é o mesmo, só muda o `slug`.
> Análise/arquitetura: `AQUISICAO_ANALISE.md`. Decisão: `doc/architecture/DECISIONS.md` → D-104.

---

## 1. Checklist de deploy (uma vez por ambiente)

1. **Banco** — rodar `supabase/migracao-landing-pages.sql` no SQL Editor (idempotente). Ele cria `landing_pages`/`lp_sessions`/`lp_events`, as 2 colunas em `leads`, as RPCs `landing_page_publica`/`aquisicao_metricas`, a retenção e **já cadastra a LP Fibra** (`slug=fibra`, WhatsApp sem número). Depois: `NOTIFY pgrst, 'reload schema';` (o arquivo já termina com isso).
2. **Edge Functions** — publicar `rastrear-lp` e `submeter-lp` (`supabase/functions/`). Pelo painel, lembrar do gotcha do D-078/D-083: o editor não resolve `../_shared/captacao.ts` — inlinear o conteúdo do `_shared` no `index.ts` só na cópia do painel. Via CLI: `supabase functions deploy rastrear-lp && supabase functions deploy submeter-lp`.
3. **Secret `CORS_ALLOWED_ORIGINS`** (Edge Functions → Secrets) — adicionar o domínio da LP, ex.: `https://fibra.rjnet.com.br,https://SEU-CRM.vercel.app,http://localhost:3000`. Sem isso o navegador bloqueia as chamadas da LP (o SDK engole o erro: a LP funciona, mas nada é rastreado).
4. **Frontend do CRM** — deploy normal (Vercel). O SDK fica servido em `https://SEU-CRM.vercel.app/rjnet-lp.js` (cache de 5 min, `vercel.json`).
5. **Conferir** no CRM: Mais → Aquisição → Landing Pages → LP Fibra → aba "Integração" — o snippet já vem com URL/anon key do ambiente.

## 2. O que a LP precisa ter (contrato com o SDK)

Cole no `<head>` (snippet copiável na aba "Integração" de cada LP):

```html
<script src="https://SEU-CRM.vercel.app/rjnet-lp.js"
  data-lp="fibra"
  data-supabase-url="https://SEU-PROJETO.supabase.co"
  data-anon-key="SUA_ANON_KEY"
  defer></script>
```

Marque os elementos (atributos `data-rjnet-*`):

| Elemento | Atributo | Efeito |
|---|---|---|
| Qualquer CTA | `data-rjnet-cta="hero_assinar"` | evento `cta_click { cta }` |
| Formulário | `<form data-rjnet-form="principal" data-rjnet-redirect="/obrigado">` | `form_start` no 1º foco; no submit envia o lead via `submeter-lp`; sucesso → classe `rjnet-enviado` + evento DOM `rjnet:lead` (+ redirect opcional); erro → texto em `[data-rjnet-erro]` + evento `rjnet:lead-erro` |
| Campos do form (`name=`) | `nome`*, `telefone`*, `bairro`, `cidade`, `endereco`, `mensagem`, `servico` (múltiplo ok), `consentimento` (checkbox — **obrigatório**), `ja_cliente` (checkbox), `website` (honeypot, escondido) | contrato do lead — mesmos campos/validações do Form Builder |
| Botão de WhatsApp | `<a href="..." data-rjnet-whatsapp="cta_final" data-rjnet-mensagem="opcional">` | `whatsapp_click` (com `lead_id` se a pessoa já enviou o form) e abre `wa.me/<número configurado na LP>`; **sem número configurado, o `href` da própria LP segue normalmente** |

Texto do consentimento: reutilize o mesmo do sistema (`FormularioPublico.jsx`): *"Confirmo que forneci meus dados voluntariamente e autorizo a RJNET Telecomunicações a utilizá-los para contato comercial, conforme a LGPD."*

API programática (para LPs em React/Vue/etc.): `RJNetLP.track(nome, props)`, `RJNetLP.submitLead({...})` (Promise), `RJNetLP.whatsapp({ mensagem })`, `RJNetLP.ready(cfg => ...)`, `RJNetLP.integrations.add({ nome, onEvent })`.

## 3. UTMs / atribuição

Divulgue sempre o link com UTMs — a campanha é o que o link traz:

```
https://fibra.rjnet.com.br/?utm_source=meta&utm_medium=paid&utm_campaign=fibra_setembro&utm_content=criativo_01
```

- Capturadas no **primeiro acesso** da sessão (first touch) e mantidas na navegação interna (sessionStorage).
- Gravadas na sessão (`lp_sessions`) e copiadas para o lead (`leads.utm`) no envio — a sessão é a fonte de verdade; o body do form é só fallback.
- Visita sem UTM recebe a **campanha padrão** da LP (se configurada) em `utm_campaign`; sem isso aparece como `(sem campanha)`.

## 4. WhatsApp — Fase 1

- `whatsapp_number` fica **nulo** até o número oficial existir. Nesse cenário o clique já é contado (`whatsapp_click`) e a LP usa o link que ela mesma tiver.
- Quando o número for definido: Aquisição → LP → Configurar → "Número". Sem deploy. O SDK passa a abrir `wa.me/<número>?text=<mensagem>`.
- Não há API/webhook/inbox de WhatsApp nesta fase — a partir do clique o atendimento é manual. A integração futura entra como camada independente lendo `lp_events (whatsapp_click)` + `leads`.

## 5. Tracking externo (GTM/GA4/Ads/Meta)

- Configurável por LP em "Configurar → Tracking & integrações" (IDs públicos, nunca secrets).
- **Nesta fase só o GTM é injetado** pelo SDK quando `gtm_container_id` está preenchido; todo evento interno vira `dataLayer.push({ event: 'rjnet_<evento>', rjnet: {...} })` — as tags de GA4/Ads/Meta são configuradas dentro do container.
- GA4/Ads/Meta direto no SDK: pontos de extensão prontos (`MAPA_EVENTOS_EXTERNOS`, `RJNetLP.integrations.add`). Não implementados de propósito (briefing §38/§40).

## 6. Diagnóstico

- **CRM → LP → Eventos**: feed dos últimos eventos recebidos (sessão, UTM, dispositivo, lead vinculado). Se está vazio com a LP no ar: CORS (item 1.3), LP com status ≠ `ativa`, ou ad-blocker no dispositivo de teste.
- **Logs das Edge Functions** (painel Supabase): prefixo `[rjnet:edge:lp]` — evento rejeitado (nome fora da whitelist, LP inativa, teto por sessão), lead rejeitado (rate limit, consentimento, telefone), falha ao gravar.
- `data-debug="true"` no `<script>` faz o SDK logar no console da LP (`[RJNetLP]`).

## 7. Limitações conhecidas (Fase 1)

- Ad-blockers podem bloquear o SDK/Edge → métricas subcontadas; a conversão (form/WhatsApp) não depende do SDK se a LP tiver fallback próprio.
- `rastrear-lp` não guarda IP (minimização LGPD) → proteção contra poluição de métricas é por teto de eventos/sessão + whitelist, não por IP. Leads continuam protegidos pelo rate limit por IP de `submeter-lp`.
- Dedupe de lead: mesmo telefone na mesma LP em 24h devolve o lead existente (sem duplicar).
