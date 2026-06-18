# UX/UI V3 — Plano de Implementação

> **Status:** APROVADO — implementação autorizada.
> **Baseado em:** `doc/ui/UX_UI_V3_PROPOSAL.md`
> **Data:** 2026-06-18
> **Princípio:** 100% mobile-first. Cada etapa é atômica e reversível.

---

## Regras do Plano

- Um commit por item — nenhum commit mistura dois itens diferentes.
- Nenhuma lógica de negócio é alterada em nenhuma etapa.
- Rollback de qualquer item: `git revert <hash> --no-edit && git push`
- Validar em 375px (iPhone SE) antes de dar como concluído.

---

## Fase D — Design System + Fundação Visual

> CSS e variáveis globais. Sem tocar em JSX.
> Tudo que vem depois depende desta fase.

---

### D-01 — Nova paleta de cores e variáveis CSS

**Arquivos:** `src/index.css`

**Mudanças:**
- `--bg: #090909` (era #111111)
- `--surface: #111111` (era #1a1a1a)
- `--surface2: #1a1a1a` (era #222222)
- `--surface3: #222222` (novo — para hover/selecionado)
- `--border: #2a2a2a` (era #333333)
- `--border-2: #333333` (novo)
- `--yellow-dim: rgba(255,203,0,0.10)` (novo)
- `--yellow-glow: rgba(255,203,0,0.20)` (novo)
- `--shadow-card`, `--shadow-float`, `--shadow-glow` (novos)
- `--radius: 14px` (era 10px)
- `--radius-sm: 8px` (novo)
- `--radius-lg: 20px` (novo)

**Rollback:** `git revert <hash> --no-edit && git push`

---

### D-02 — Cards com profundidade e sombra

**Arquivos:** `src/index.css`

**Mudanças:**
- `.card`: adiciona `box-shadow: var(--shadow-card)`, remove borda flat
- `.event-card`: border-radius maior, sombra, hover com `translateY(-2px) + shadow-float`
- `.kpi`: sombra, hover elevado
- `.vendor-card`: sombra + hover

**Rollback:** `git revert <hash> --no-edit && git push`

---

### D-03 — Tipografia com escala e hierarquia

**Arquivos:** `src/index.css`

**Mudanças:**
- `.page-title`: `font-size: 22px; font-weight: 800; letter-spacing: -.02em`
- `.section-title`: `font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3)`
- `.ms-v` (mini-stat): `font-size: 36px; font-weight: 800; font-family: "DM Mono"`
- `h1` no EventDetail: `font-size: 24px; font-weight: 800`
- Números de KPI: `font-size: 40px`

**Rollback:** `git revert <hash> --no-edit && git push`

---

### D-04 — Micro-interações CSS (transições e hover)

**Arquivos:** `src/index.css`

**Mudanças:**
- Todos os botões: `transition: all .15s ease`
- `.event-card`, `.card`, `.kpi`: `transition: transform .15s ease, box-shadow .15s ease`
- `.btn-primary:active`: `transform: scale(.97)`
- `.nav-tab`, `.bn-tab`: `transition: color .15s, background .15s`
- Toast: `animation: slideFromBottom .2s ease`

**Rollback:** `git revert <hash> --no-edit && git push`

---

## Fase E — Navegação

---

### E-01 — Bottom nav do Marketing (mobile-first)

**Arquivos:** `src/apps/MarketingApp.jsx`, `src/index.css`

**Mudanças:**
- Criar bottom nav no MarketingApp igual ao Vendedor
- 5 itens: Início, Eventos, Equipe, Check-in, + Mais
- "Mais" abre bottom sheet com: Estoque, Relatórios, Monitor
- Em desktop (>760px): manter header nav horizontal existente
- Bottom nav visível apenas em mobile

**Rollback:** `git revert <hash> --no-edit && git push`

---

### E-02 — Redesign visual do bottom nav (Marketing + Vendedor)

**Arquivos:** `src/index.css`

**Mudanças:**
- Altura: `72px`
- Pill amarela embaixo do item ativo (CSS puro, `::after`)
- Ícone do item ativo: `fill` ao invés de só `stroke`
- Fundo do nav: `var(--surface)` com `border-top: 1px solid var(--border)`
- Label menor: `10px`
- Toque mínimo por botão: `64px` de largura

**Rollback:** `git revert <hash> --no-edit && git push`

---

### E-03 — Cards de evento com borda colorida por status

**Arquivos:** `src/features/events/EventosTab.jsx`, `src/index.css`

**Mudanças:**
- `.event-card`: adiciona `border-left: 3px solid` com cor por status
  - `ativo` → `var(--yellow)`
  - `planejado` → `var(--text-3)`
  - `encerrado` → `var(--border-2)`
- Tipografia do card: nome em `font-size: 16px; font-weight: 700`
- Local e datas: `font-size: 12px; color: var(--text-3)`
- Número de leads: destaque maior

**Rollback:** `git revert <hash> --no-edit && git push`

---

## Fase F — Telas Principais

---

### F-01 — Dashboard redesenhado

**Arquivos:** `src/features/events/Dashboard.jsx`, `src/index.css`

**Mudanças:**
- Hero card com evento ativo (nome, local, período, total leads)
- KPIs com número 40px + label 11px abaixo
- Substituir gráfico donut por barras horizontais de serviços
  (mais legíveis em mobile, sem Chart.js se possível — CSS puro)
- Seção "Próximos eventos" com lista compacta

**Rollback:** `git revert <hash> --no-edit && git push`

---

### F-02 — Wizard de registro de lead (Vendedor) — Etapa 1

**Arquivos:** `src/apps/VendedorApp.jsx`, `src/index.css`

**Mudanças:**
- Substituir formulário único por estado `etapa` (1, 2 ou 3)
- Etapa 1: Nome + Telefone + indicador de progresso no topo
- Botão "Próximo →" só habilita quando campos preenchidos
- Botão "Voltar" retorna à etapa anterior sem perder dados
- Todos os dados acumulados em estado único `f` (sem breaking change)

**Rollback:** `git revert <hash> --no-edit && git push`

---

### F-03 — Wizard de registro de lead — Etapa 2 (seleção visual de serviço)

**Arquivos:** `src/apps/VendedorApp.jsx`, `src/index.css`

**Mudanças:**
- Etapa 2: grade 2×2 de botões grandes (min 80px) com ícone + label
- Selecionado: fundo `var(--yellow-dim)` + borda `var(--yellow)`
- Múltipla seleção mantida (lógica existente preservada)
- CPF e Endereço: movidos para etapa 3 (campos opcionais)

**Rollback:** `git revert <hash> --no-edit && git push`

---

### F-04 — Wizard de registro de lead — Etapa 3 (temperatura + opcionais)

**Arquivos:** `src/apps/VendedorApp.jsx`, `src/index.css`

**Mudanças:**
- Etapa 3: Temperatura (4 botões visuais), Já é cliente (Sim/Não), Observação, CPF, Endereço
- Modo rápido: quando ativo, etapa 3 some — submit direto após etapa 2
- Animação de slide entre etapas (CSS `transform: translateX`)
- Submit final idêntico ao atual (`addLead` com mesmos campos)

**Rollback:** `git revert <hash> --no-edit && git push`

---

### F-05 — Animação da barra de meta do Vendedor

**Arquivos:** `src/index.css`

**Mudanças:**
- `.meta-bar-fill`: `transition: width .6s cubic-bezier(.34,1.56,.64,1)` (spring)
- Ao atingir cada meta: pulso amarelo no badge de contagem
- Cor da barra muda progressivamente: cinza → bronze → prata → dourado

**Rollback:** `git revert <hash> --no-edit && git push`

---

### F-06 — Toast redesenhado

**Arquivos:** `src/index.css`

**Mudanças:**
- Toast com `border-left: 3px solid var(--green)`
- Ícone de check verde
- Animação: `slideFromBottom .2s ease` na entrada, `fadeOut .3s` na saída
- Botão "Desfazer" mais visível: borda amarela

**Rollback:** `git revert <hash> --no-edit && git push`

---

## Checklist de Progresso

### Fase D — Design System
- [ ] D-01 — Nova paleta de cores e variáveis
- [ ] D-02 — Cards com profundidade e sombra
- [ ] D-03 — Tipografia com escala
- [ ] D-04 — Micro-interações CSS

### Fase E — Navegação
- [ ] E-01 — Bottom nav do Marketing mobile
- [ ] E-02 — Redesign visual dos bottom navs
- [ ] E-03 — Cards de evento com borda por status

### Fase F — Telas Principais
- [ ] F-01 — Dashboard redesenhado
- [ ] F-02 — Wizard etapa 1 (Nome + Telefone)
- [ ] F-03 — Wizard etapa 2 (Serviço visual)
- [ ] F-04 — Wizard etapa 3 (Temperatura + opcionais)
- [ ] F-05 — Animação barra de meta
- [ ] F-06 — Toast redesenhado
