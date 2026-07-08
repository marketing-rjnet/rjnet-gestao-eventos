# SIMULADOR_IMPLEMENTATION_PLAN.md — Simulador de Perfil de Consumo

> Plano de implementação da nova camada de captação gamificada ("Simulador"),
> acoplada ao pipeline público existente do sistema (Form Builder, D-062–D-067).
> Status geral: ✅ **F0–F4 implementadas em 2026-07-08 (D-072)** — perfil de consumo completo,
> ponta a ponta (migração → Edge Function → página pública → gestão → fila/vendedor).
> ⏸️ Pendentes: F5 (campanha territorial) e itens LGPD/documentais da F6 (RIPD/ROPA/Política —
> **gate obrigatório antes do primeiro go-live de campanha**, ver §10).
> Criado em: 2026-07-08. Branch de desenvolvimento: `claude/rjnet-lead-simulator-x2p3kk`.
> Decisão registrada em `DECISIONS.md` (D-072); `SYSTEM_MAP.md` + `CLAUDE.md` atualizados.

---

## 1. Conceito e objetivo

Uma terceira porta de entrada pública de captação — ao lado do Form Builder — em
formato de **quiz gamificado de perfil de consumo de internet**:

1. Pessoa chega via **QR Code em material físico** (panfleto, banner, evento) **ou
   via link em campanha de tráfego pago** (Meta/Google Ads, inclusive anúncios
   geolocalizados por cidade/bairro) — o mesmo link atende os dois canais.
2. Responde 4–6 perguntas rápidas sobre o perfil da residência (moradores, usos,
   equipamentos, situação atual da internet).
3. Recebe uma **recomendação personalizada de plano** (reutilizando a área de
   Ofertas, D-057) — valor entregue **antes** de pedir qualquer dado pessoal.
4. Só então informa nome, WhatsApp, bairro e cidade → vira um **Lead qualificado**
   no CRM, com perfil de consumo, pontuação de intenção, temperatura calculada e
   oferta recomendada.
5. O mesmo motor, com um segundo tipo de questionário reduzido, alimenta a
   **inteligência territorial**: mapa interno de demanda por cidade/bairro para a
   diretoria (sem nunca expor cobertura de rede — esse dado nem existe no sistema).

**Princípio inegociável (já consolidado no SYSTEM_MAP):** toda resposta pública
converge para um Lead pelo pipeline único (Edge Function → `leads` →
fila de distribuição). O Simulador nunca é uma entidade paralela com fluxo
de escrita próprio.

---

## 2. Nomenclatura e entidades

| Termo | Significado |
|---|---|
| **Simulador** | O domínio/motor (aba de gestão, página pública, scoring) |
| **Campanha de captação** (linha da tabela `simuladores`) | Uma instância publicada: "Panfleto Itaguaí Centro", "Tráfego Meta — Paraty Julho/26". Cada uma tem slug, link e QR Code próprios |
| `tipo = 'perfil_consumo'` | Questionário completo + recomendação de oferta (estratégia 1) |
| `tipo = 'territorial'` | Questionário reduzido (cidade/bairro/interesse) para mapa de demanda (estratégia 2) |

Decisão espelhada do Form Builder (D-062): **o questionário é um catálogo fixo em
código, versionado** (`PERGUNTAS_SIMULADOR` em `src/lib/constants.js`) — nunca um
motor de quiz genérico configurável em runtime. A tabela `simuladores` guarda a
**identidade da campanha**, não a estrutura das perguntas. Mudar pergunta = commit
com bump de versão, igual `CAMPOS_FORMULARIO`.

---

## 3. Modelo de dados

### 3.1 Nova tabela `simuladores` (espelho estrutural de `formularios`)

```sql
create table if not exists public.simuladores (
  id                text primary key,
  nome              text not null,            -- "Panfleto Itaguaí Centro"
  slug              text not null unique,     -- /s/panfleto-itaguai-centro
  tipo              text not null default 'perfil_consumo'
                    check (tipo in ('perfil_consumo', 'territorial')),
  campanha          text,                     -- agrupador livre: "Ação Julho/2026"
  cidade            text,                     -- pré-preenche etapa territorial (opcional)
  versao_perguntas  int  not null default 1,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now()
);
```

RLS idêntica à de `formularios` (`migracao-form-builder.sql`):
- `simuladores_write`: `for all to authenticated` com `papel_atual() in ('marketing','comercial')`
- `simuladores_select_interno`: `for select to authenticated using (true)`
- `simuladores_select_publico`: `for select to anon using (ativo = true)` — mesmo
  precedente de leitura anônima do D-062, expõe só metadado não sensível

### 3.2 Colunas novas em `leads` (todas aditivas e nullable — zero impacto no existente)

```sql
alter table public.leads
  add column if not exists simulador_id       text references public.simuladores(id) on delete set null,
  add column if not exists perfil_consumo     jsonb,   -- respostas do quiz (ver §4)
  add column if not exists pontuacao          int,     -- score de intenção (servidor)
  add column if not exists oferta_recomendada text,    -- chave de serviço (enum de ofertas)
  add column if not exists cidade             text,    -- bairro já existe (D-062)
  add column if not exists utm                jsonb;   -- atribuição de tráfego (ver §6.3)

create index if not exists idx_leads_simulador on public.leads (simulador_id);
-- índice para o relatório de demanda territorial (§9)
create index if not exists idx_leads_cidade_bairro on public.leads (cidade, bairro)
  where deletado = false;
```

- `origem` ganha o valor `'simulador'` — verificado: a coluna é `text` livre, sem
  check constraint (`migracao-qrcode.sql`), custo zero.
- A constraint `leads_evento_xor_mes` já aceita lead sem evento/mês desde D-061
  (`num_nonnulls(...) <= 1`) — nada a alterar.
- Após rodar: `NOTIFY pgrst, 'reload schema';` (gotcha documentado em
  `migracao-form-builder.sql`).

### 3.3 Frontend (`dataService.js`)

Acrescentar as colunas novas em `LEADS_COLS`, `leadFromDb` e `leadToDb`
(mesmo padrão aditivo de `formulario_id`/`bairro`/`campos_extras`).

---

## 4. Catálogo de perguntas e armazenamento das respostas

### 4.1 Catálogo em código (`src/lib/constants.js`)

```js
// Simulador: catálogo FIXO e versionado de perguntas — mesmo princípio de
// CAMPOS_FORMULARIO (D-062): nunca um motor de quiz genérico em runtime.
export const PERGUNTAS_SIMULADOR_VERSAO = 1;
export const PERGUNTAS_SIMULADOR = [
  { key: 'moradores', label: 'Quantas pessoas moram na residência?', tipo: 'single',
    opcoes: [
      { key: '1',       label: '1 pessoa' },
      { key: '2_4',     label: '2 a 4 pessoas' },
      { key: '5_mais',  label: '5 ou mais pessoas' },
    ] },
  { key: 'usos', label: 'Como vocês usam a internet?', tipo: 'multi',
    opcoes: [
      { key: 'streaming',   label: 'Streaming (Netflix, filmes, séries)' },
      { key: 'jogos',       label: 'Jogos online' },
      { key: 'home_office', label: 'Trabalho / home office' },
      { key: 'estudos',     label: 'Estudos' },
      { key: 'redes',       label: 'Redes sociais' },
      { key: 'muitos_disp', label: 'Muitos dispositivos conectados' },
    ] },
  { key: 'equipamentos', label: 'Principais equipamentos conectados', tipo: 'multi',
    opcoes: [
      { key: 'smart_tv', label: 'Smart TV' },
      { key: 'pc',       label: 'Computadores' },
      { key: 'console',  label: 'Consoles' },
      { key: 'celular',  label: 'Celulares' },
      { key: 'iot',      label: 'Câmeras / dispositivos inteligentes' },
    ] },
  { key: 'tem_internet', label: 'Possui internet atualmente?', tipo: 'single',
    opcoes: [
      { key: 'sim', label: 'Sim' },
      { key: 'nao', label: 'Não' },
    ] },
  { key: 'dificuldade', label: 'Qual a principal dificuldade hoje?', tipo: 'single',
    exibirSe: { tem_internet: 'sim' },   // pergunta condicional
    opcoes: [
      { key: 'lenta',      label: 'Internet lenta' },
      { key: 'oscilacao',  label: 'Oscilação / quedas' },
      { key: 'velocidade', label: 'Pouca velocidade pro que preciso' },
      { key: 'preco',      label: 'Preço' },
      { key: 'satisfeito', label: 'Estou satisfeito com o serviço atual' },
    ] },
];
```

### 4.2 Respostas: JSONB na linha do lead (`perfil_consumo`)

```json
{
  "versao": 1,
  "respostas": {
    "moradores": "2_4",
    "usos": ["streaming", "jogos", "home_office"],
    "equipamentos": ["smart_tv", "console", "celular"],
    "tem_internet": "sim",
    "dificuldade": "oscilacao"
  }
}
```

**Por que na linha do lead, e não tabela normalizada nem `campos_extras`:**
- LGPD de graça: perfil de consumo é dado pessoal comportamental; vivendo no lead,
  é coberto automaticamente pela retenção D-064 (leads sem evento/mês expiram por
  `criado_em`) e pelo soft delete — sem novo bloco em `limpar_leads_expirados()`.
- Respostas são chaves de um catálogo fechado (nunca texto livre do usuário) —
  agregação para BI funciona com operadores jsonb nativos.
- `campos_extras` tem semântica própria (texto livre criado pela equipe, D-063);
  o perfil é estruturado e tem consumidores próprios (scoring, BI, exibição rica).

---

## 5. Pontuação, temperatura e oferta recomendada

### 5.1 `src/lib/scoring.js` — função pura, determinística, testável

```
calcularPerfil(respostas) → { pontuacao, temperatura, ofertaRecomendada, resumo }
```

Modelo de soma ponderada (pesos iniciais — calibráveis por commit + teste unitário):

| Sinal | Peso |
|---|---|
| Não tem internet hoje | +30 (demanda reprimida — o sinal mais quente) |
| Dificuldade = lenta / oscilação / velocidade | +20 (dor ativa, intenção de troca) |
| Dificuldade = preço | +15 |
| Cada uso de alta demanda (jogos, home office, streaming, muitos dispositivos) | +8 |
| 5+ moradores | +10 |
| 3+ tipos de equipamento | +5 |
| "Satisfeito com o serviço atual" | −15 |

Saídas gravadas no lead:
1. `pontuacao` — número cru (ordenação da fila, BI)
2. `temperatura` — mapeada por faixa (**≥60 → `quente`, 30–59 → `morno`, <30 → `frio`**).
   É o enum que todo o fluxo existente já entende; o simulador passa a preenchê-la
   com critério (o `submeter-formulario` hoje grava `'morno'` fixo).
3. `oferta_recomendada` — regra simples perfil→serviço (chave do enum de `ofertas`,
   D-057); a página pública renderiza a oferta ativa daquele serviço (imagem + copy
   que o marketing já mantém).

### 5.2 Servidor é a fonte de verdade

Duas cópias da função, mesmo padrão já aceito para `sanitizeText`/`containsLink`
(duplicadas em Deno por rodarem fora do bundle):
- Cliente (`scoring.js`): só para **UX** — decidir qual recomendação exibir na hora.
- Edge Function `submeter-simulador`: **recalcula** pontuação/temperatura/oferta a
  partir das respostas brutas e grava o resultado dela. O cliente nunca envia score
  pronto (formulário público = input hostil, princípio D-067).

Teste unitário Node (`tests/scoring.unit.test.js`), mesmo padrão de
`lead.unit.test.js` — cobre faixas de temperatura, respostas vazias/parciais,
respostas com chaves fora do catálogo (devem ser ignoradas).

---

## 6. Página pública `/s/:slug` (`src/public/SimuladorPublico.jsx`)

### 6.1 Acoplamento (espelho exato do `/f/:slug`)

- `main.jsx`: segundo desvio mínimo no boot (`/^\/s\/([^/]+)\/?$/`), ao lado do
  `formMatch` existente — continua não sendo um roteador (restrição arquitetural mantida).
- `vercel.json`: rewrite `{ "source": "/s/:path*", "destination": "/index.html" }`.
- CSP atual já cobre (self + `*.supabase.co`) — **nenhuma dependência externa nova**.
- Modo local/dev: estender `localPublicSubmit.js` (nunca caminho de produção).

### 6.2 UX do wizard (mobile-first — tráfego pago é ~100% mobile)

- **Uma pergunta por tela**, barra de progresso, avanço automático em resposta
  single-choice, botão "Continuar" nas multi. Meta: 30–45s do scan ao resultado.
- Tela intermediária "Analisando seu perfil…" (micro-transição de ~1s) antes do
  resultado — percepção de personalização.
- **Resultado antes do contato**: headline personalizada a partir do `resumo` do
  scoring + card da oferta recomendada (imagem 1080x1080 + copy da tabela `ofertas`).
- Só então o formulário curto: nome, WhatsApp, bairro, cidade + checkbox de
  consentimento LGPD (mesmo padrão do `FormularioPublico`) + honeypot invisível.
- Estilo: CSS variables da V3 (`index.css`), tema claro/escuro, sem framework.
- Estado do wizard em `useState` local — sem `AppProvider`, sem sessão (por design).

### 6.3 Atribuição de tráfego (UTM) — o que torna o link "trabalhável" em mídia paga

A página captura `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
`utm_term` da URL no load e envia junto da submissão; a Edge Function sanitiza
(tamanho máx., `containsLink`) e grava em `leads.utm` (jsonb).

Isso resolve os dois canais com **um único link por campanha**:
- **Tráfego pago**: cada anúncio/conjunto recebe seus próprios UTMs — atribuição
  por anúncio, não só por campanha.
- **Material impresso**: o QR Code gerado pela aba de gestão **embute
  automaticamente** `?utm_source=qrcode&utm_medium=impresso` no link — o mesmo
  simulador distingue scan físico de clique em anúncio sem duplicar campanha.

Funil sem código extra: a plataforma de anúncios já dá cliques; leads criados ÷
cliques = conversão do simulador por anúncio (via UTM). Não é necessário pixel
para a v1 (ver §11, sugestão S4, para os trade-offs de adicionar pixel depois).

---

## 7. Edge Function `submeter-simulador` + refatoração `_shared/`

### 7.1 Pré-requisito: extrair `supabase/functions/_shared/captacao.ts`

`submeter-formulario/index.ts` hoje carrega cópias locais de `sanitizeText`,
`validarTelefone`, `containsLink`, CORS (`getCorsHeaders`/`getAllowedOrigins`),
`json()`, honeypot e rate limit por IP. Antes de escrever a segunda função,
mover esse miolo para `_shared/` (suportado nativamente pelo Supabase) e fazer
`submeter-formulario` importar de lá. **Única refatoração de código existente
que o plano exige — reduz dívida em vez de criar.**

⚠️ Exige redeploy de `submeter-formulario` + smoke test do formulário público em
produção (gotcha de CORS do D-064: `authorization, apikey, content-type`).

### 7.2 A função nova

Fluxo (espelho de `submeter-formulario`, com as diferenças em negrito):
1. CORS restrito via `CORS_ALLOWED_ORIGINS` + honeypot + método POST.
2. Consentimento obrigatório (`consentimentoColetado === true`).
3. Rate limit 5/10min por IP contando em `leads` (D-067, reaproveitado de `_shared/`).
4. Busca o simulador por id/slug: precisa estar `ativo = true`.
5. **Valida `respostas` contra `PERGUNTAS_SIMULADOR` (versão em Deno)** — chave de
   pergunta/opção fora do catálogo é descartada silenciosamente; single vs multi
   validado por tipo.
6. Valida contato: nome (obrigatório, `containsLink`), telefone (10–11 dígitos),
   bairro/cidade (texto, `containsLink`, tamanhos máx.).
7. **Recalcula `pontuacao`/`temperatura`/`oferta_recomendada` no servidor.**
8. Insert em `leads` com service_role:
   `id: l-sim-<uuid>`, `origem: 'simulador'`, `simulador_id`, `vendedor_id: null`,
   `evento_id/mes_referencia: null`, `perfil_consumo`, `pontuacao`,
   `oferta_recomendada`, `cidade`, `bairro`, `utm`, `origem_ip`,
   `temperatura` calculada, `versao_termo: 'simulador-v1'`.

Para `tipo = 'territorial'`: mesma função, questionário reduzido (a config do
simulador decide quais etapas a página renderiza); scoring vira apenas
frio/morno fixo + interesse declarado.

---

## 8. Gestão interna (`src/features/simulador/SimuladorTab.jsx`)

- Entra no grupo **Captação** do menu "Mais" do Marketing (`MORE_GROUPS`,
  `MarketingApp.jsx`, D-065), ao lado de Formulários. Comercial: decidir na
  implementação se ganha acesso (RLS já permite; a UI do `ComercialApp` tem só
  4 tabs diretas — sugestão: **não** adicionar na v1, marketing cria e compartilha
  o link).
- CRUD de campanhas via nova factory `createSimuladorApi` (`src/api/simuladorApi.js`),
  instanciada no `AppProvider` — padrão obrigatório do projeto.
- Por campanha: **link copiável** (para colar no gerenciador de anúncios) e
  **QR Code** (lib `qrcode` client-side, mesmo código do `FormBuilderTab`), já com
  UTMs de impresso embutidos (§6.3).
- Ativar/desativar campanha (página pública passa a responder "indisponível" —
  mata QR impresso vazado sem apagar histórico).
- Contador simples de leads por campanha (count em `leads` por `simulador_id`).

---

## 9. Integração comercial e inteligência territorial

### 9.1 Fila de distribuição (`LeadsTab.jsx`) — custo quase zero

`fetchLeadsSemVendedor` já filtra `origem is not null` (origem-agnóstico por
design, D-061) — leads do simulador **caem na fila sem mudar uma linha**.
Melhorias:
- Exibir pontuação + temperatura + oferta recomendada no card da fila.
- **Ordenar por `pontuacao` desc** — o marketing distribui os quentes primeiro.
  É o primeiro lugar onde o score paga o investimento.
- Botão de exclusão em dois passos (D-067) já cobre lead suspeito do simulador.

### 9.2 Vendedor (`VendedorApp.jsx`)

- Generalizar `fetchLeadsQrCode` (`dataService.js`, filtro hoje `origem = 'qrcode'`)
  para `origem in ('qrcode','formulario','simulador')` e renomear o contexto do
  seletor para **"Captação Digital"** — corrige de quebra a lacuna que o Form
  Builder já tem hoje (leads de formulário distribuídos não aparecem no seletor).
- Card do lead exibe o perfil legível ("4 moradores · Streaming + Jogos · sem
  internet hoje") — labels derivados do catálogo, mesmo espírito do `rótulo: valor`
  do D-063. O vendedor liga já sabendo a dor.
- `OfertaPickerModal` (D-057): oferta com chave igual a `oferta_recomendada` sobe
  ao topo com selo "Recomendada pelo simulador" — o vendedor envia no WhatsApp
  exatamente o que o lead viu na tela. Consistência de discurso ponta a ponta.

### 9.3 Relatório de demanda territorial (diretoria)

**Não é mapa nem feature de captação — é relatório agregado interno:**
- RPC `demanda_por_regiao()` (security definer, grant só a `authenticated` —
  mesmo padrão de `ranking_mes`): `count(*)` de leads não deletados agrupado por
  `cidade`, `bairro`, `origem`, com filtro opcional de período.
- UI: seção nova em Relatórios (`LeadsTab.jsx`) visível para marketing/comercial —
  tabela "Cidade → Bairro → interessados" + export CSV (reaproveita `csv.js`).
- Nada de cobertura de rede exposto: o dado não existe no sistema, e o relatório
  é interno (atrás de auth).
- ⚠️ Consciente: quando a retenção LGPD (D-064) expurgar leads antigos, o
  agregado histórico encolhe junto. Se a diretoria quiser série longitudinal,
  ver sugestão S3 (§11) — tabela agregada anônima, fora do escopo LGPD.

---

## 10. LGPD e segurança (bloqueia o go-live da Fase 2)

| Item | Ação | Referência |
|---|---|---|
| Novo tratamento (perfil comportamental + UTM) | Linha nova no RIPD e no ROPA | `doc/lgpd/RIPD.md`, `doc/lgpd/ROPA.md` |
| Consentimento | Texto do checkbox cita finalidade ("recomendação de plano e contato comercial"); `versao_termo: 'simulador-v1'` | `POLITICA_DE_PRIVACIDADE.md` (menção ao simulador) |
| Retenção | Já coberta: lead sem evento/mês expira por `criado_em` (D-064) — `perfil_consumo`/`utm` morrem com o lead | `migracao-qrcode-retencao.sql` |
| Segunda escrita não autenticada do sistema | Atualizar `doc/SEGURANCA_MODERACAO.md` e a regra D-067 no `SYSTEM_MAP.md` (hoje dizem "única") | `doc/SEGURANCA_MODERACAO.md` |
| Anti-abuso | Herdado de `_shared/`: honeypot, `containsLink`, rate limit 5/10min por IP, `origem_ip` | D-067 |
| Dado mínimo | Não coletar CPF no simulador (não é necessário para a finalidade) | princípio de minimização |

---

## 11. Sugestões além do pedido (avaliar, não obrigatórias)

- **S1 — QR com UTM embutido (§6.3):** já incorporada ao plano; é o que unifica
  impresso + tráfego numa campanha só.
- **S2 — Ordenação da fila por pontuação (§9.1):** já incorporada; transforma o
  score em decisão operacional imediata.
- **S3 — Tabela agregada anônima `demanda_agregada`** (cidade, bairro, mês,
  contador — sem nenhum dado pessoal): a Edge Function incrementa no insert.
  Preserva a série histórica territorial mesmo após o expurgo LGPD dos leads.
  Custo baixo, mas é tabela nova + escrita extra — recomendo só quando a
  diretoria pedir histórico além da janela de retenção.
- **S4 — Pixel de conversão (Meta/GA) na página pública:** melhora otimização de
  campanha, **mas** exige afrouxar a CSP (`script-src`/`connect-src` para domínios
  de terceiros), banner de cookies e nova entrada no RIPD/DPA. Recomendo **não**
  na v1 — a atribuição por UTM + leads/cliques cobre a leitura de performance.
  Se a operação de tráfego exigir otimização por conversão, tratar como decisão
  própria (D-0xx) com o custo LGPD explícito. Alternativa intermediária sem
  pixel: API de conversões server-side na própria Edge Function (também exige
  DPA, mas não toca CSP nem cookies).
- **S5 — Resultado compartilhável:** botão "compartilhar no WhatsApp" na tela de
  resultado (Web Share API, sem dependência) — captação orgânica secundária.
  Custo ~zero, decidir na Fase 2 pelo apetite de escopo.
- **S6 — A/B de perguntas via `versao_perguntas`:** a coluna já existe no modelo;
  duas campanhas iguais com versões de catálogo diferentes permitem comparar
  conversão. Não requer código novo além de manter a v1 e v2 no catálogo.

---

## 12. Fases de execução

Cada fase é deployável sozinha e invisível ao usuário final até a F3.
Não iniciar uma fase com a anterior quebrada.

| Fase | Entrega | Arquivos principais | Risco | Status |
|---|---|---|---|---|
| **F0 — Fundação sem UI** | `migracao-simulador.sql` (tabela + colunas + RLS + índices + `NOTIFY pgrst`); `PERGUNTAS_SIMULADOR` + `scoring.js` + `tests/scoring.unit.test.js`; colunas em `LEADS_COLS`/`leadFromDb`/`leadToDb` | `supabase/migracao-simulador.sql`, `src/lib/constants.js`, `src/lib/scoring.js`, `src/lib/dataService.js`, `tests/` | Zero (nada renderiza) | ✅ |
| **F1 — `_shared/` + Edge Function** | Extração do miolo comum; `submeter-simulador`; redeploy + smoke test do formulário público existente | `supabase/functions/_shared/captacao.ts`, `supabase/functions/submeter-simulador/index.ts`, `supabase/functions/submeter-formulario/index.ts` | Médio (única fase que toca código público existente — por isso isolada) | ✅ |
| **F2 — Página pública** | Wizard `/s/:slug` + desvio no boot + rewrite + captura de UTM + fallback local + E2E Playwright do fluxo completo. **Gate: itens LGPD do §10 prontos antes do go-live** | `src/public/SimuladorPublico.jsx`, `src/main.jsx`, `vercel.json`, `src/lib/localPublicSubmit.js`, `tests/simulador.test.js` | Baixo (sem campanha ativa, rota responde "não encontrado") | ✅ |
| **F3 — Gestão** | `SimuladorTab` no grupo Captação + factory `createSimuladorApi` + link/QR com UTM + ativar/desativar. A partir daqui o marketing roda piloto real | `src/features/simulador/`, `src/api/simuladorApi.js`, `src/context/AppProvider.jsx`, `src/apps/MarketingApp.jsx` | Baixo | ✅ |
| **F4 — Integração comercial** | Fila enriquecida + ordenação por score; contexto "Captação Digital" no vendedor (generaliza filtro `qrcode`); selo no `OfertaPickerModal`; perfil legível no card do lead | `src/features/leads/LeadsTab.jsx`, `src/lib/dataService.js`, `src/apps/VendedorApp.jsx` | Baixo | ✅ |
| **F5 — Territorial** | `tipo='territorial'` na página (questionário reduzido); RPC `demanda_por_regiao()`; seção de demanda em Relatórios + export CSV | `supabase/migracao-demanda.sql`, `src/features/leads/LeadsTab.jsx`, `src/utils/csv.js` | Baixo | ⏸️ |
| **F6 — Fechamento documental** | `SYSTEM_MAP.md`, `DECISIONS.md` (registrar decisões), `CLAUDE.md`, `doc/CHANGELOG.md`, RIPD/ROPA/Política, `SEGURANCA_MODERACAO.md` | `doc/` | Zero | ⏸️ |

**Rollback por fase:** F0 é aditiva (colunas nullable — reverter = ignorar);
F1 reverte re-deployando o `submeter-formulario` anterior; F2/F3 revertem por
commit (rota some, tab some); campanhas podem ser desativadas individualmente
(`ativo = false`) sem deploy.

**Ordem de commits:** atômicos por fase, mensagens no padrão do repositório
(`feat:`/`fix:`/`docs:` em pt-BR), preview Vercel validado antes de merge
(fluxo de `doc/BOAS_PRATICAS.md`).

---

## 13. Fora de escopo (explícito)

- Motor de quiz genérico configurável em runtime (rejeitado — mesmo racional do D-062).
- Mapa geográfico visual / integração com serviço de mapas (o relatório é tabular;
  nada de tile server externo, que quebraria CSP e adicionaria dependência).
- Exposição de cobertura de rede em qualquer forma pública.
- Pixel de rastreamento de terceiros na v1 (ver S4).
- Coleta de geolocalização do dispositivo (`Permissions-Policy: geolocation=()`
  continua bloqueando — a localização é **declarada** pela pessoa, nunca captada).
- Automação de distribuição de leads (continua manual por marketing/comercial, D-061).
