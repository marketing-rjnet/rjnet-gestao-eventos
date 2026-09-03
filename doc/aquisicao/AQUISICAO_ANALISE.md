# Módulo de Landing Pages e Aquisição — Análise Arquitetural (Fase 1)

> Entregável da Fase 1 (análise antes de codar). Produzido em 2026-09-03 a partir da inspeção do código real — não da descrição do briefing. Decisão correspondente: **D-104** em `doc/architecture/DECISIONS.md`.
>
> Regra que guiou tudo: **arquitetura existente → reutilização → segurança → extensibilidade → simplicidade → velocidade.** A LP de Fibra é só a primeira instância; nada aqui é específico dela.

---

## 1. Arquitetura atual relevante

| Camada | Como é de verdade (verificado no código) | Consequência para o módulo |
|---|---|---|
| Roteamento | **Não há biblioteca de rotas.** Navegação interna por `useState` de tab (`MarketingApp.jsx` — 3 diretas + "Mais" agrupado em `MORE_GROUPS`). Páginas públicas são desvios mínimos em `main.jsx` por `pathname` (`/f/`, `/s/`, `/tv/`). | Não criar rotas `/marketing/aquisicao/...`. A área entra como **uma tab nova no "Mais"** (grupo próprio "Aquisição") com sub-navegação interna (`seg-control`, mesmo padrão de `DesafioDetail.jsx`). |
| Estado | `AppProvider` único orquestra estado + factories de API (`src/api/*Api.js`). Tabelas pequenas carregam no boot via `fetchAll`; dados volumosos são on-demand (`fetchLeadsEvento`, `fetchDesafioEntries`). Leituras agregadas via RPC (`ranking_evento`, `demanda_por_regiao`). | `landing_pages` entra no `fetchAll` (tabela pequena, como `simuladores`). Sessões/eventos **nunca** entram no contexto — só agregados por RPC, on-demand, no próprio módulo. |
| Camada de dados | `src/lib/dataService.js` é a única ponte com o Supabase: mapeadores `*FromDb/*ToDb`, `exec()` fire-and-forget com retry, `withRetry`, `trackPerf`. | Novos mapeadores + `db.saveLandingPage/removeLandingPage` + `fetchAquisicaoMetricas`/`fetchLpEventos`/`fetchLeadsPorLandingPage`. |
| Escrita pública | Edge Functions Deno (`submeter-formulario`, `submeter-simulador`) com miolo compartilhado `_shared/captacao.ts` (CORS por `CORS_ALLOWED_ORIGINS`, sanitização, `containsLink`, IP confiável, rate limit 5/10min por IP contado em `leads`). Escrevem com `service_role`; frontend chama com `apikey`/`Authorization: Bearer <anon>`. | Duas Edge Functions novas no mesmo molde: `rastrear-lp` (sessões/eventos, alto volume, tolerante a falha) e `submeter-lp` (lead, validação estrita, rate limit, consentimento). |
| Leitura pública | Desde D-103, leitura anônima **só via RPC `SECURITY DEFINER` com `grant execute to anon`** (`simulador_publico`, `timer_challenge_painel_publico`) — nunca policy `to anon` em tabela. | RPC `landing_page_publica(slug)` devolve só o que a LP precisa (WhatsApp + IDs públicos de tracking). Tabela sem policy `anon`. |
| RBAC | `perfis.papel` ∈ {marketing, comercial, vendedor}; `papel_atual()` em RLS; shells separados por papel. Módulos "marketing-only" usam proteção dupla UI + RLS (Estoque/Equipe/Desafio). | Escrita `marketing`; leitura interna `papel_atual() is not null` só para **metadado** de LP (nome — necessário para rotular a origem do lead na fila de distribuição, também vista pelo comercial); sessões/eventos/métricas: `marketing` apenas. |
| Leads | Modelo único em `leads`. Proveniência é um eixo **ortogonal** ao contexto operacional: `origem` ∈ {qrcode, formulario, simulador} + `formulario_id`/`simulador_id`/`qr_code_*`, `utm` jsonb (5 chaves whitelisted), `origem_ip`, consentimento (`consentimento_coletado/em`, `versao_termo`). `vendedor_id` nasce nulo e cai na fila "Leads sem vendedor" (`LeadsTab.jsx`). | Lead de LP = **mais um valor de `origem`** (`landing_page`) + 2 colunas de vínculo (`landing_page_id`, `lp_session_id`). `utm` já existe — reutilizado sem duplicar. |
| Consentimento LGPD | Checkbox `.consentimento-check` (texto padrão) nas páginas públicas; servidor exige `consentimentoColetado === true` e grava `versao_termo`. | Mesmo contrato: `submeter-lp` recusa sem consentimento; `versao_termo = 'landing-page-v1'`. |
| Retenção | `limpar_leads_expirados()` (pg_cron 05:00 UTC) com chaves em `configuracoes_retencao`; leads sem evento/mês expiram por `criado_em` (D-064). | Leads de LP já são cobertos (sem evento/mês). Sessões/eventos ganham rotina própria `limpar_lp_tracking_expirado()` (chave nova). |
| Offline/resiliência | Fila offline criptografada só para `saveLead` do vendedor autenticado (PA-05). Nada disso se aplica a página pública. | Tracking usa buffer em memória + `fetch keepalive` no SDK; falha de tracking **nunca** bloqueia formulário/WhatsApp. Fila offline do CRM não é reutilizada (é do usuário logado, com chave derivada do `userId`). |
| Observabilidade | `activityLog.js` (Monitor) instrumenta o app **autenticado**; Edge Functions usam `console.error('[rjnet:edge] ...')` (logs do painel Supabase). | Edge Functions novas logam `[rjnet:edge:lp]` com motivo de cada rejeição; a tabela `lp_events` é em si a trilha ("evento recebido/associado ao lead"); a tela "Eventos" da LP mostra o feed. Sem sistema de log paralelo. |
| UI | Sem UI framework. Átomos em `components/ui.jsx` (`Icon`, `Kpi`, `ChartView`), `EmptyState`, `SearchInput`; classes `.page/.card/.grid-kpi/.seg-control/.tbl-wrap/.badge`. | Reutilizados. Único componente novo de apresentação: o funil (`AquisicaoFunil.jsx`, CSS puro). |
| Testes | Playwright em 2 modos (local `:3000` / Supabase mockado `:3001` via `page.route`), unitários Node importando módulo real sem imports (`simulador.unit.test.js`). | `src/lib/aquisicao.js` sem imports (testável em Node); E2E local do módulo + E2E do SDK interceptando as Edge Functions. |

## 2. Entidades existentes reutilizadas (e o que NÃO foi criado)

| Necessidade do briefing | Já existe? | Decisão |
|---|---|---|
| Lead | `leads` | **Reutilizado integralmente.** Nada de `fibra_leads`/`lp_leads`. |
| Origem do lead | `leads.origem` + colunas de vínculo por canal | Novo valor `origem='landing_page'` + `landing_page_id`/`lp_session_id`. |
| UTM/atribuição | `leads.utm` (jsonb, whitelist de 5 chaves, sanitizado no servidor) | Reutilizado. A **fonte de verdade** da UTM do lead passa a ser a sessão (`lp_sessions.utm_*`, capturada no primeiro page_view); o body só é fallback. |
| Campanha | **Não existe tabela de campanhas.** `simuladores.campanha` é um agrupador texto; a campanha real é `utm_campaign`. | **Não criar tabela `campanhas`.** Campanha = dimensão derivada (`utm_source/medium/campaign/content`) das sessões. `landing_pages.campanha_padrao` só preenche `utm_campaign` de visitas sem UTM. `campaign_id` do briefing ⇒ `utm_campaign` (texto). |
| Sessão de visita | Não existe | Nova `lp_sessions` (id gerado no cliente, UUID). |
| Eventos | Não existe | Nova `lp_events` — **uma** tabela para todos os tipos, `nome` texto validado por whitelist em código. |
| Consentimento | `consentimento_coletado/em`, `versao_termo`, checkbox `.consentimento-check` | Reutilizado. |
| Rate limit / IP / anti-link / honeypot | `_shared/captacao.ts` | Reutilizado em `submeter-lp`. |
| Usuários/permissões | `perfis` + `papel_atual()` | Reutilizado. |
| WhatsApp | Só `wa.me` manual do vendedor (D-057) | Nada de API. LP guarda `whatsapp_number` (nulo hoje) + `whatsapp_enabled`; SDK abre `wa.me` quando houver número. |
| Slug/identidade pública | `formularios.slug`, `simuladores.slug`, `slugify()` | Mesmo padrão: `landing_pages.slug` único. |

## 3. Pontos de integração

1. **`main.jsx`** — sem mudança. A LP não é uma página deste app (vive em `fibra.rjnet.com.br`); este app só serve o SDK estático `/rjnet-lp.js`.
2. **`MarketingApp.jsx`** — grupo "Aquisição" no `MORE_GROUPS` com a tab `aquisicao`.
3. **`AppProvider.jsx` / `dataService.fetchAll`** — `landingPages` no contexto.
4. **`LeadsTab.jsx` (fila de distribuição)** — `ORIGEM_LABEL.landing_page` + nome da LP em `origemDetalhe`; `fetchLeadsQrCode` passa a incluir `landing_page` (contexto "Captação" do vendedor).
5. **`leadFromDb/leadToDb/LEADS_COLS`** — 2 colunas novas.
6. **`limpar_leads_expirados()`** — não muda: leads de LP já caem no 4º bloco (sem evento/mês).
7. **Edge secrets** — `CORS_ALLOWED_ORIGINS` precisa incluir o domínio da LP (checklist em `doc/SEGURANCA_HARDENING.md`).

## 4. Estrutura de banco recomendada (`supabase/migracao-landing-pages.sql`)

```
landing_pages   id text pk · nome · slug unique · descricao · dominio · servico (enum de servicoInteresse)
                status ('ativa'|'preparacao'|'inativa') · campanha_padrao
                whatsapp_enabled bool · whatsapp_number text null · whatsapp_label · whatsapp_mensagem
                tracking jsonb {gtm_container_id, ga4_measurement_id, google_ads_conversion_id,
                                google_ads_conversion_label, meta_pixel_id}   ← IDs públicos, nunca secrets
                criado_em · atualizado_em
lp_sessions     id text pk (uuid do cliente) · landing_page_id fk · landing_page_url · referrer
                utm_source/medium/campaign/term/content · device ('mobile'|'desktop'|'tablet')
                criado_em · atualizado_em                                     ← sem IP, sem user-agent cru
lp_events       id bigint identity · landing_page_id fk · session_id fk (cascade, nullable)
                lead_id fk leads (set null) · nome text (whitelist em código) · propriedades jsonb · criado_em
leads           + landing_page_id fk (set null) · + lp_session_id fk (set null)   (origem='landing_page')
```
- **Índices:** `lp_events (landing_page_id, criado_em)`, `(session_id)`, `(lead_id) where not null`, `(nome, criado_em)`; `lp_sessions (landing_page_id, criado_em)`, `(utm_campaign)`; `leads (landing_page_id)`.
- **RLS:** `landing_pages` — write `marketing`, select `papel_atual() is not null`; `lp_sessions`/`lp_events` — select `marketing`, **sem** policy de escrita (só `service_role` via Edge Function escreve). Nada `to anon`.
- **RPCs (SECURITY DEFINER, padrão `revoke ... from public, anon` + grant explícito):**
  - `landing_page_publica(p_slug)` → `anon` (config pública da LP ativa).
  - `aquisicao_metricas(p_de, p_ate, p_landing_page_id, p_utm_source, p_utm_medium, p_utm_campaign, p_vendedor_id, p_temperatura)` → `authenticated`, exige `papel_atual() = 'marketing'`; devolve totais (visitas/interações/leads/whatsapp), por LP, por campanha, por dia.
- **Retenção:** `limpar_lp_tracking_expirado()` + chave `retencao_lp_sessoes_dias` (395) + job pg_cron; FK `set null` preserva o lead.
- **Seed:** LP Fibra (`slug='fibra'`, `servico='internet_residencial'`, `status='ativa'`, `whatsapp_enabled=true`, `whatsapp_number=null`) via `on conflict do nothing`.

## 5. Estrutura de frontend recomendada

```
public/rjnet-lp.js                     SDK embutível (Tracking Layer) — vanilla, sem build, servido pelo CRM
src/lib/aquisicao.js                   taxonomia EVENTOS_LP, STATUS_LP, INTEGRACOES_TRACKING, MAPA_EVENTOS_EXTERNOS,
                                       calcularFunil()/agruparPorCampanha() (sem imports — modo local + testes)
src/api/landingPageApi.js              createLandingPageApi — add/update/remove (factory padrão)
src/hooks/useAquisicaoMetricas.js      hook: filtros → RPC (Supabase) ou cálculo local
src/features/aquisicao/
  AquisicaoTab.jsx                     sub-navegação: Visão geral · Landing Pages · Campanhas · Conversões
  AquisicaoDashboard.jsx               KPIs + funil + cards por LP (dados reais, filtros)
  AquisicaoFiltros.jsx                 período/LP/campanha/source/medium/vendedor/temperatura
  AquisicaoFunil.jsx                   funil Visitas → Interações → Leads → WhatsApp
  LandingPagesTab.jsx + LandingPageForm.jsx + LandingPageDetail.jsx (Visão geral/Eventos/Leads/Campanhas/Integração)
  CampanhasTab.jsx · ConversoesTab.jsx · index.js
```

## 6. Fluxo de dados

```
LP (fibra.rjnet.com.br)                         CRM (Vercel)                Supabase
 <script src=CRM/rjnet-lp.js data-lp=fibra>
   ├─ RPC landing_page_publica(slug) ───────────────────────────────────▶ config pública (WhatsApp, IDs)
   ├─ sessão (sessionStorage) + UTM/referrer/device
   ├─ page_view / cta_click / form_start ──▶ Edge rastrear-lp ──────────▶ lp_sessions (upsert) + lp_events
   ├─ form submit ─────────────────────────▶ Edge submeter-lp ──────────▶ leads (origem=landing_page, utm da sessão)
   │                                          └─ lead_created ──────────▶ lp_events (lead_id)
   └─ clique WhatsApp ─────────────────────▶ Edge rastrear-lp ──────────▶ lp_events whatsapp_click (lead_id)
                                                                          └─ abre wa.me (se número configurado)
Marketing → Mais → Aquisição ── RPC aquisicao_metricas ───────────────▶ funil/KPIs/por LP/por campanha
Marketing → Relatórios → Leads sem vendedor (fila existente) ─────────▶ lead com origem "Landing Page — LP Fibra"
```
O CRM é **consumidor**: a LP nunca carrega o bundle React, só o SDK (~8 KB).

## 7. Estratégia de segurança
- Só `anon key` no SDK (já pública no bundle); `service_role` só nas Edge Functions.
- `rastrear-lp`: slug → LP ativa; `session.id` UUID obrigatório; whitelist de eventos; máx. 20 eventos/req; `propriedades` achatadas (≤10 chaves, strings ≤120); `lead_id` só é aceito se o lead existir **e** pertencer à mesma LP; teto de eventos por sessão; sem IP/UA gravados.
- `submeter-lp`: mesmas camadas do Form Builder (sanitização, `containsLink`, telefone válido, honeypot, consentimento obrigatório, rate limit 5/10min por IP, `origem_ip` só no lead) + dedupe de 24h por telefone na mesma LP (devolve o lead existente em vez de duplicar).
- RLS sem `anon`; RPCs com `revoke`; métricas exigem `marketing`.
- CORS restrito por `CORS_ALLOWED_ORIGINS` (adicionar domínio da LP).

## 8. Estratégia de tracking (Tracking Layer)
- **Taxonomia própria** (`EVENTOS_LP`): `page_view`, `cta_click`, `form_start`, `form_submit`, `lead_created` (servidor), `whatsapp_click`. Extensível por lista.
- SDK = **camada de despacho**: cada evento vai para `integrations` registradas — built-in `interno` (Edge Function) e `gtm` (injeta o container quando `tracking.gtm_container_id` existe e faz `dataLayer.push({event:'rjnet_<evento>', rjnet:{...}})`). GA4/Google Ads/Meta Pixel: **pontos de extensão prontos** (`MAPA_EVENTOS_EXTERNOS`, campos de config) sem implementação nesta fase.
- Nenhum `if googleAds/if metaPixel` no núcleo; adapters em lista.
- Tracking assíncrono, `fetch keepalive`, erros engolidos — conversão nunca depende dele.

## 9. Impactos no sistema atual
- Aditivo: 2 colunas nullable em `leads`; 1 valor novo de `origem`; 1 tab a mais no "Mais"; `fetchAll` com 1 query a mais (tabela pequena).
- `fetchLeadsQrCode`/contexto "Captação" do vendedor passa a listar também leads de LP já distribuídos (comportamento desejado, mesmo tratamento do Simulador).
- Nenhuma tabela existente renomeada/removida; nenhum fluxo de lead alterado.

## 10. Riscos
| Risco | Mitigação |
|---|---|
| Migração colada manualmente fora de ordem (dívida D-078) | Migração idempotente, autocontida, depende só de `migracao-auth.sql` (+ `migracao-retencao.sql` para a chave de retenção, guardada por `if exists`). |
| `lp_events` cresce sem limite | Retenção automática (395 dias) + teto por sessão + limite por request; tabela só de agregados, nunca no contexto. |
| Sem IP no tracking ⇒ rate limit fraco em `rastrear-lp` | Aceito conscientemente (minimização LGPD). Superfície de abuso é "poluir métricas", não "criar leads" — leads continuam protegidos pelo rate limit por IP de `submeter-lp`. |
| Ad-blockers bloqueiam o SDK/Edge | Formulário e WhatsApp funcionam sem SDK (formulário HTML normal com fallback), métricas ficam subcontadas — documentado. |
| Edge Functions no painel divergem do repo (drift, D-078) | Guia de deploy em `doc/aquisicao/INTEGRACAO_LP.md`; lembrar de inlinear `_shared` no painel. |
| CORS | Domínio da LP em `CORS_ALLOWED_ORIGINS` (checklist). |

## 11. Arquivos alterados
`src/lib/dataService.js` · `src/context/AppProvider.jsx` · `src/apps/MarketingApp.jsx` · `src/components/ui.jsx` (ícone) · `src/features/leads/LeadsTab.jsx` (rótulo de origem) · `src/index.css` (funil/snippet) · `vercel.json` (cache do SDK) · `package.json` (test:unit) · `CLAUDE.md` · `doc/architecture/SYSTEM_MAP.md` · `doc/architecture/DECISIONS.md` · `doc/architecture/SUPABASE.md` · `doc/CHANGELOG.md` · `doc/lgpd/ROPA.md` · `doc/SEGURANCA_HARDENING.md`

## 12. Arquivos criados
`supabase/migracao-landing-pages.sql` · `supabase/functions/rastrear-lp/index.ts` · `supabase/functions/submeter-lp/index.ts` · `public/rjnet-lp.js` · `src/lib/aquisicao.js` · `src/api/landingPageApi.js` · `src/hooks/useAquisicaoMetricas.js` · `src/features/aquisicao/*` · `tests/aquisicao.unit.test.js` · `tests/aquisicao.test.js` · `doc/aquisicao/AQUISICAO_ANALISE.md` · `doc/aquisicao/INTEGRACAO_LP.md`

## 13. O que NÃO é alterado
- Modelo de `leads` além das 2 colunas de vínculo; `leads_select` (V-01) intocada.
- `VendedorApp.jsx`, `ComercialApp.jsx`, `Form Builder`, `Simulador`, `Desafio`, `Ofertas`, `Estoque`, `Equipe`, `Monitor`.
- Edge Functions existentes e `_shared/captacao.ts` (só importado).
- `limpar_leads_expirados()`; `main.jsx`; políticas de `perfis`/`materiais`.
- Nenhuma integração de WhatsApp (API/webhook/inbox) — apenas o campo de configuração e o evento de clique.
