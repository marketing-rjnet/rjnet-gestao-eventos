# UI_VERSIONS.md — RJNet Gestão de Eventos

> Catálogo de versões da interface. Registra o estado de cada versão, o que mudou, por quê, e o status atual.
> Atualizado em: 2026-06-18

---

## Índice de Versões

| Versão | Status | Data | Resumo |
|--------|--------|------|--------|
| [v3.0](#v30--redesign-visual-v3) | **atual** | 2026-06-18 | Redesign visual completo — identidade forte, wizard vendedor, bottom nav mobile |
| [v2.0](#v20--refinamentos-v2) | anterior | 2026-06-18 | Refinamentos técnicos — 22 itens CSS/JSX (Fases A, B, C) |
| [v1.0](#v10--baseline) | anterior | 2026-06-18 | Interface baseline — dark mode, 2 perfis, 6 tabs marketing |

---

## v3.0 — Redesign Visual V3

**Status:** `atual`
**Data:** 2026-06-18
**PR:** #45 — `claude/v3-visual-redesign` → `main`
**Documentação:** `doc/ui/UX_UI_V3_PROPOSAL.md` | `doc/ui/UX_UI_V3_IMPLEMENTATION_PLAN.md` | `doc/ui/UX_UI_V3_CHANGELOG.md`

### Visão Geral

Redesign visual real — sem alteração de lógica de negócio. Objetivo: interface moderna, mobile-first, com identidade de marca forte (preto profundo + amarelo RJNet como protagonista). Inspiração: Linear.app, Vercel dashboard, Raycast.

### Identidade Visual

| Propriedade | Valor |
|-------------|-------|
| Fundo base | `#090909` (`--bg`) |
| Superfície card | `#111111` (`--surface`) |
| Superfície interna | `#1a1a1a` (`--surface2`) |
| Hover/selecionado | `#222222` (`--surface3`) |
| Borda padrão | `#2a2a2a` (`--border`) |
| Borda visível | `#333333` (`--border-2`) |
| Amarelo RJNet | `#ffcb00` (`--yellow`) |
| Amarelo dim | `rgba(255,203,0,0.10)` (`--yellow-dim`) |
| Amarelo glow | `rgba(255,203,0,0.20)` (`--yellow-glow`) |
| Texto primário | `#f4f4f4` |
| Texto secundário | `#aaaaaa` |
| Texto terciário | `#666666` |
| Sombra card | `0 1px 3px rgba(0,0,0,.5), 0 4px 16px rgba(0,0,0,.3)` |
| Sombra float | `0 8px 32px rgba(0,0,0,.7), 0 2px 8px rgba(0,0,0,.4)` |
| Border radius padrão | `14px` (era 10px) |
| Border radius sm | `8px` (novo) |
| Border radius lg | `20px` (novo) |

### O que mudou em relação à V2

#### Design System
- Fundos mais escuros (`#090909` vs `#111111`) — mais profundidade
- Cards com `box-shadow` real (elevação) em vez de borda `0 0 0 1px`
- Hover eleva cards com `translateY(-2px)` + sombra maior
- KPIs: números 40px/800 (era 28px)
- Section titles: uppercase menor, `var(--text-3)` (era text-2)
- Micro-interações em todos os botões: `transition: all .15s ease`
- `.btn-primary:active`: `scale(.97)` (era .98)
- Toast: `slideFromBottom` animation + `border-left: 3px solid var(--green)`

#### Navegação — Marketing (mobile)
- Bottom nav reestruturado: 4 itens principais + "Mais ⋯"
- "Mais" abre bottom sheet com Estoque, Relatórios e Monitor
- Altura: 72px (era 62px)
- Item ativo: pill amarela `::after` embaixo (era `border-top`)
- Toque mínimo: 64px por item

#### Navegação — Vendedor (mobile)
- Mesmo redesign: 72px, pill amarela, fundo `var(--surface)`

#### Cards de evento
- Borda esquerda colorida por status: `var(--yellow)` ativo, `var(--text-3)` planejado, `var(--border-2)` encerrado

#### Dashboard
- Hero card no topo: evento ativo com nome, local, período, leads e vendedores
- Barras horizontais CSS substituem gráfico donut (Chart.js não é mais usado no Dashboard)
- KPIs mantidos

#### Formulário do Vendedor — Wizard 3 etapas
- **Etapa 1:** Nome + Telefone + indicador de progresso
- **Etapa 2:** Grade 2×2 visual de serviços com emoji + label; selecionado: `yellow-dim + border yellow`
- **Etapa 3:** Temperatura, Já é cliente, Observação, CPF, Endereço
- Modo rápido: pula etapa 3, submete direto após etapa 2
- `addLead()` inalterado — mesmos campos, mesma lógica

#### Barra de meta
- `transition: width .6s cubic-bezier(.34,1.56,.64,1)` (spring)
- Bronze: `#cd7f32` | Prata: `#c0c0c0` | Ouro: `var(--yellow)`

#### Toast
- `border-left: 3px solid var(--green)`
- Botão Desfazer: `border: 1px solid var(--yellow)`

### Responsividade

| Breakpoint | Comportamento |
|------------|---------------|
| > 760px (desktop) | Header nav completo (7 tabs), bottom nav oculto |
| ≤ 760px (mobile) | Bottom nav 72px, 4 itens + "Mais", grids 1 coluna |

---

## v2.0 — Refinamentos V2

**Status:** `anterior`
**Data:** 2026-06-18
**PR:** #44 — `claude/v2-ux-ui` → `main`
**Documentação:** `doc/ui/UX_UI_V2_PROPOSAL.md` | `doc/ui/UX_UI_V2_IMPLEMENTATION_PLAN.md` | `doc/ui/UX_UI_V2_CHANGELOG.md`

22 itens em 3 fases (A: CSS foundation, B: reorganização UX, C: componentes). Melhorias técnicas corretas, sem impacto visual percebido pelo usuário final — motivou a criação da V3.

---

## v1.0 — Baseline

**Status:** `anterior`
**Data de catalogação:** 2026-06-18
**Branch de referência:** `main`

### Visão Geral

Primeira versão catalogada do sistema. SPA React com tema dark por padrão, dois perfis de acesso distintos (Marketing e Vendedor), e operação em dois modos (Supabase ou localStorage).

---

### Identidade Visual

| Propriedade | Valor |
|-------------|-------|
| Paleta principal | Dark (`#0f0f0f` fundo, `#1a1a1a` superfície) |
| Cor de marca | Amarelo/dourado `#f5c000` (`--rj-blue`) |
| Cor de hover | `#ffd740` (`--rj-blue-light`) |
| Cor de sucesso | `#22c55e` (verde) |
| Cor de erro | `#ef4444` (vermelho) |
| Cor de aviso | `#f5c000` (amarelo) |
| Texto primário | `#f0f0f0` |
| Texto secundário | `#b0b0b0` |
| Texto terciário | `#666666` |
| Border | `#2e2e2e` |
| Border radius padrão | `12px` |
| Tipografia | DM Sans (texto) + DM Mono (números/monospace) |
| Tamanho base | 14px, line-height 1.5 |
| Tema alternativo | Light mode disponível (toggle no header/login) |

---

### Estrutura de Navegação

#### App de Marketing (`MarketingApp.jsx`)

Header fixo com logo RJNet + navegação horizontal (desktop) / bottom nav (mobile).

| # | Tab | Ícone | Componente | Função principal |
|---|-----|-------|------------|-----------------|
| 1 | Eventos | calendar | `EventosTab` / `EventDetail` | CRUD de eventos, materiais alocados, leads por vendedor |
| 2 | Estoque | box | `EstoqueTab` | Gestão de materiais com nível de disponibilidade |
| 3 | Leads | users | `LeadsTab` | Exportação CSV (por evento ou consolidado) |
| 4 | Equipe | briefcase | `EquipeTab` / `EquipeAuthTab` | CRUD de vendedores / usuários RBAC |
| 5 | Check-in | search | `CheckinTab` | Busca de lead por CPF em evento ativo |
| 6 | Monitor | activity | `MonitoringTab` | Diagnóstico ao vivo + histórico de atividade |

**Header direito:** SyncBadge + toggle de tema + badge do usuário + botão Sair.

#### App do Vendedor (`VendedorApp.jsx`)

Bottom navigation fixo, mobile-first (max-width 480px centralizado).

| # | Tab | Ícone | Função principal |
|---|-----|-------|-----------------|
| 1 | Registrar | plus | Formulário de captura de lead |
| 2 | Meus Leads | person + badge | Lista filtrável de leads próprios |
| 3 | Evento | calendar | Detalhes do evento ativo + ranking |
| 4 | Pacotes | box | Tabela de preços dos serviços RJNet |

---

### Telas por Módulo

#### Login

| Modo | Componente | Campos | Extras |
|------|------------|--------|--------|
| Supabase | `LoginAuth.jsx` | Email + Senha | Recuperação de senha, MFA (6 dígitos), link "Esqueci a senha" |
| Local | `Login.jsx` | Usuário + Senha | Sem recuperação |

Layout: card centralizado (max-width 380px), logo 90px, tag "Gestão de Eventos", toggle de tema canto inferior direito.

---

#### Eventos

**Lista (`EventosTab`):**
- Filtro por status: chips `ativo / planejado / encerrado / todos`
- Grid de cards (2 colunas desktop, 1 coluna mobile)
- Card: nome, local, datas, tipo, badge de status, contagem de leads, avatares dos vendedores
- Botão "+ Novo Evento" abre `EventModal`

**Dashboard (abaixo da lista):**
- 4 KPIs: Eventos Ativos, Total Leads, Materiais Críticos, Vendedores Ativos
- Gráfico donut: distribuição de leads por serviço de interesse
- Lista de próximos eventos

**Detalhe (`EventDetail`):**
- Breadcrumb de volta + ações (Editar / Finalizar / Excluir)
- Hero: nome + badges de status e tipo
- Layout 2 colunas: Informações (local, datas, notas) | Mini stats (leads, materiais)
- Seção Materiais: form inline de adição + tabela (material, qtd, estoque, disponível, status, devolver)
- Seção Leads: gráfico de barras por vendedor + tabela (nome, telefone, endereço, serviço, vendedor)

**Modal de criação/edição (`EventModal`):**

| Campo | Tipo | Validação |
|-------|------|-----------|
| Nome | text | obrigatório, max 120 |
| Local | text | obrigatório, max 200 |
| Data Início | date | obrigatório |
| Data Fim | date | obrigatório, ≥ Data Início |
| Tipo | select | Sinalização / Presença Comercial / Ativação Especial |
| Status | select | Planejado / Ativo / Encerrado |
| Observações | textarea | opcional, max 500 |

---

#### Estoque

- 3 KPIs: Total de Tipos, Total de Itens, Em Campo
- Agrupamento por nível:
  - **CRÍTICO** (borda vermelha) — estoque = 0
  - **ATENÇÃO** (borda amarela) — estoque 1–3
  - **OK** (borda verde) — estoque ≥ 4
- Row card: nome + descrição | total / em campo / disponível
- Botão "+ Adicionar Material" abre `MaterialModal`

**Modal (`MaterialModal`):**

| Campo | Tipo | Validação |
|-------|------|-----------|
| Nome | text | obrigatório, max 120 |
| Quantidade | number | obrigatório, 1–9999 |
| Descrição | textarea | opcional, max 300 |

---

#### Leads

- Dois botões de exportação CSV:
  - "↓ Exportar evento" (1 evento selecionado)
  - "↓ Exportar consolidado" (N eventos)
- Tabela de seleção de eventos: checkbox + nome + status + datas
- Suporte a Selecionar Todos / Desmarcar Todos

---

#### Check-in

- Card centralizado (max-width 520px)
- Select de evento + input de nome com botão limpar
- Resultado:
  - Sem match → card vermelho com ícone X
  - Matches parciais → lista azul com nome, telefone, vendedor
  - Match exato → card verde com checkmark + dados completos

---

#### Equipe

**Modo local (`EquipeTab`):**
- Cards de vendedor: avatar (iniciais), nome, badge status, contagem de leads, mini gráfico de barras (últimos 3 eventos)
- Ações: Ativar / Desativar
- Form inline: adicionar vendedor por nome

**Modo Supabase (`EquipeAuthTab`):**
- Duas seções: Administradores (⚙, borda amarela) | Equipe de Vendas (👥)
- Cards: avatar + nome + email + badges (papel + status) + ações (editar papel, editar, ativar/desativar, excluir)
- Form inline: Nome + Email + Senha inicial + Papel

---

#### Monitor

- Header: título + seletor de dia + stats (leads / erros de sync / avisos de perf / fila offline)
- Toolbar de sessão (somente hoje): ▶ Iniciar | ■ Encerrar | Limpar log
- Cards de vendedores: avatar com dot de status de atividade (verde < 5min / amarelo < 30min / cinza < 24h / inativo ≥ 24h)
- Feed de atividade filtrável (Todos / Leads / Sync / Perf)
- 9 tipos de eventos no feed:

| Tipo | Cor | Descrição |
|------|-----|-----------|
| `lead_add` | verde | Lead adicionado |
| `lead_update` | azul | Lead atualizado |
| `lead_remove` | vermelho | Lead removido |
| `lead_sync_ok` | verde claro | Confirmação de sync com Supabase |
| `sync_error` | vermelho | Erro de sincronização |
| `perf_warn` | amarelo/laranja/vermelho | Requisição lenta (4 tiers de severidade) |
| `offline_queue` | amarelo | Lead enfileirado offline |
| `session_start` | roxo | Marcador de início de sessão |
| `session_end` | roxo | Marcador de encerramento de sessão |

---

#### Registrar Lead (Vendedor)

| Campo | Tipo | Detalhes |
|-------|------|----------|
| Nome | text | obrigatório |
| CPF | text | máscara xxx.xxx.xxx-xx, validação |
| Telefone | text | máscara (xx) xxxxx-xxxx, validação |
| Endereço | text | opcional |
| Serviço de Interesse | segmented (multi) | internet_residencial / internet_empresarial / rjnet_movel / streamings / outro |
| Temperatura | segmented (4 estados) | frio (azul) / morno (laranja) / quente (vermelho) / convertido (verde) |
| Já é cliente | toggle Sim/Não | |
| Modo rápido | toggle | oculta campos opcionais |

- Barra de meta com 3 níveis: 🥉 Bronze (20) / 🥈 Prata (40) / 🥇 Ouro (60)
- Toast de confirmação com botão Desfazer

---

#### Meus Leads (Vendedor)

- Lista de cards com filtro por temperatura
- Card: nome, serviço, temperatura (colorida), telefone
- Botões de contato: ligar (azul) + WhatsApp (verde)
- Edição inline com confirmação
- Exclusão em 2 passos (confirmar antes de apagar)

---

#### Evento (Vendedor)

- Card de info do evento: nome, local (link Maps), datas, tipo, totais
- Ranking da equipe: lista com barra animada proporcional ao número de leads
- Medalhas para top 3 posições

---

#### Pacotes (Vendedor)

Tabela de preços hardcoded, dividida em seções:

| Seção | Itens |
|-------|-------|
| 📶 Internet Fibra | 5 velocidades com destaque |
| 📺 TV | 2 pacotes + 3 canais premium |
| 📱 Móvel | 4 planos |
| 🎁 Apps | 2 cards (Yellow & Black) |

---

### Componentes Reutilizáveis

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Icon` | `ui.jsx` | SVG stroke-based, props: size, stroke, strokeWidth |
| `StatusBadge` | `ui.jsx` | Badge colorida por status de evento |
| `TipoBadge` | `ui.jsx` | Badge de tipo de evento |
| `Kpi` | `ui.jsx` | Card de métrica com ícone, label e valor |
| `ChartView` | `ui.jsx` | Wrapper do Chart.js (donut) |
| `SyncBadge` | `SyncBadge.jsx` | Indicador de sincronização em tempo real |

---

### Responsividade

| Breakpoint | Comportamento |
|------------|---------------|
| > 760px (desktop) | Header nav visível, bottom nav oculto, grids 2–4 colunas |
| ≤ 760px (tablet/mobile) | Bottom nav fixo (62px), grids 1 coluna, padding ajustado |
| ≤ 360px (mobile pequeno) | Modal full-screen (bottom sheet), KPIs em 2 colunas |

- Bottom nav usa `env(safe-area-inset-bottom)` para suporte a notch.
- App do Vendedor: max-width 480px centralizado em telas maiores.

---

### Padrões de UX

- **Atualização otimista:** estado muda imediatamente, sync com banco é assíncrono
- **Fila offline:** leads capturados sem conexão são sincronizados ao reconectar
- **Soft delete:** leads têm flag `deletado`, não são apagados do banco
- **Toast com desfazer:** após adicionar lead, janela de 5s para cancelar
- **Confirmação em 2 passos:** exclusão de lead requer confirmação inline antes de apagar
- **Retry automático:** erros de rede fazem até 3 tentativas (backoff 800ms, fator 2x)
- **Timeout de fetch:** 15s com `AbortSignal`, evita loading infinito

---

## Próximas Versões

> Preencher aqui antes de iniciar qualquer mudança de interface.

| Versão | Status | Planejado para | Escopo previsto |
|--------|--------|----------------|-----------------|
| v2.0 | `proposta` | Após aprovação | Ver `doc/ui/UX_UI_V2_PROPOSAL.md` |

---

## Como usar este documento

1. **Antes de mudar a interface:** registre a versão atual aqui com status `atual`.
2. **Ao iniciar uma nova versão:** crie uma nova seção `## vX.Y`, descreva o escopo, mude a anterior para `anterior`.
3. **Ao concluir:** atualize o status para `atual` e a tabela do índice.
4. **Status possíveis:** `atual` / `planejada` / `anterior` / `descontinuada`
