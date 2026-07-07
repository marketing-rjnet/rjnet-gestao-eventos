# UX/UI V2 — Plano de Implementação

> **Status:** APROVADO — implementação autorizada em fases.
> **Baseado em:** `doc/ui/historico/UX_UI_V2_PROPOSAL.md`
> **Data:** 2026-06-18
> **Cor de marca atualizada:** `#ffcb00` (RJNet amarelo oficial) — substituiu `#f5c000` em todos os arquivos fonte.

---

## Regras do Plano

- Cada etapa é **atômica e reversível** — um commit por item.
- Nenhuma etapa depende de outra não concluída para funcionar.
- A V1 permanece acessível via `git log` a qualquer momento.
- Rollback de qualquer fase: `git revert <hash>` — tempo < 5 minutos.
- **Não implementar Fase B antes de validar Fase A em produção.**
- **Não implementar Fase C antes de validar Fase B em produção.**

---

## Fase A — Correções sem risco (CSS e markup)

> Mudanças de CSS e atributos HTML. Sem alteração de lógica ou estrutura de componentes.
> Tempo estimado: 1–2 dias.
> Rollback: `git revert` por commit.

---

### A-01 — Cor de marca: `#f5c000` → `#ffcb00`

**Status:** ✅ CONCLUÍDO (2026-06-18)

**O que foi feito:**
- `src/index.css`: `--rj-blue: #ffcb00`, `--rj-blue-light: #ffe04d`, `--yellow: #ffcb00`
- Todas as ocorrências hardcoded de `#f5c000` e `#ffd740` substituídas em:
  - `src/features/events/Dashboard.jsx`
  - `src/features/events/EventDetail.jsx`
  - `src/features/team/EquipeTab.jsx`
  - `src/components/ui.jsx`
  - `src/apps/VendedorApp.jsx`

**Arquivos alterados:** `src/index.css`, 5 arquivos fonte.
**Rollback:** `git revert <hash-do-commit-A01>`

---

### A-02 — Corrigir contraste: `--text-3` de `#666666` para `#777777`

**Status:** pendente

**Por quê:** `#666666` em `#111111` tem contraste 3.0:1 — falha WCAG AA para texto < 18px. Usado em labels de tabela, placeholders e captions. `#777777` atinge 3.5:1.

**Arquivo:** `src/index.css`

```css
/* antes */
--text-3: #666666;

/* depois */
--text-3: #777777;
```

**Impacto visual:** labels de tabela e textos terciários ficam levemente mais claros.
**Rollback:** 1 linha de CSS.

---

### A-03 — Fundo dark: `#0f0f0f` → `#111111`

**Status:** pendente

**Por quê:** `#111111` é o padrão Material Design para dark mode e renderiza melhor em displays LCD. `#0f0f0f` é quase preto absoluto e pode parecer "sujo" em telas não-OLED.

**Arquivo:** `src/index.css`

```css
/* antes */
--bg: #0f0f0f;

/* depois */
--bg: #111111;
```

**Rollback:** 1 linha de CSS.

---

### A-04 — Bordas dark mais visíveis: `#2e2e2e` → `#333333`

**Status:** pendente

**Por quê:** contraste de `#2e2e2e` sobre `#1a1a1a` é ~1.3:1 — bordas praticamente invisíveis. `#333333` sobre `#1a1a1a` atinge ~1.5:1, suficiente para definir estrutura visual.

**Arquivo:** `src/index.css`

```css
/* antes */
--border: #2e2e2e;

/* depois */
--border: #333333;
```

**Rollback:** 1 linha de CSS.

---

### A-05 — Hover de card: adicionar tint de fundo além da borda

**Status:** pendente

**Por quê:** hover com apenas `border-color: --rj-blue` é sutil demais. Adicionar background tint torna a interatividade óbvia.

**Arquivo:** `src/index.css`

```css
/* antes */
.event-card:hover { box-shadow: 0 0 0 1px var(--rj-blue); }

/* depois */
.event-card:hover {
  box-shadow: 0 0 0 1px var(--rj-blue);
  background: rgba(255,203,0,0.04);
}
```

Aplicar o mesmo padrão em `.kpi:hover` e `.vendor-card` que tenham hover.

**Rollback:** remover 1 linha de CSS por seletor.

---

### A-06 — Inputs do Vendedor: min-height `40px` → `48px`

**Status:** pendente

**Por quê:** área de toque mínima recomendada para mobile é 44px (Apple HIG) / 48px (Material). Em campo, com uma mão, inputs pequenos causam erros de toque.

**Arquivo:** `src/index.css` — seletores `.big-field`, inputs dentro de `.vend-shell`

```css
/* antes */
.big-field { padding: 14px; }

/* depois */
.big-field { padding: 14px; min-height: 48px; box-sizing: border-box; }
```

Verificar também botões de serviço (`.seg-btn`) e temperatura — aplicar `min-height: 48px` onde ainda não tiverem.

**Rollback:** remover `min-height` adicionado.

---

### A-07 — Botão REGISTRAR LEAD: height `auto` → `56px`

**Status:** pendente

**Por quê:** é a ação principal do app do vendedor. Merece o maior alvo de toque da tela — impossível de errar mesmo com a mão em movimento.

**Arquivo:** `src/index.css` — criar modificador ou aplicar diretamente no seletor do botão de submit do VendedorApp.

```css
.btn-submit-lead {
  min-height: 56px;
  font-size: 16px;
  font-weight: 700;
  width: 100%;
}
```

No JSX (`VendedorApp.jsx`): adicionar classe `btn-submit-lead` ao botão de registro.

**Rollback:** remover classe e CSS.

---

### A-08 — `aria-label` em botões de ícone

**Status:** pendente

**Por quê:** botões sem texto visível precisam de `aria-label` para leitores de tela. Afeta: fechar modal (X), clear do input de check-in, toggle de tema.

**Arquivos:**
- `src/components/modals/EventModal.jsx` — botão fechar
- `src/components/modals/MaterialModal.jsx` — botão fechar
- `src/features/checkin/CheckinTab.jsx` — botão limpar input
- `src/apps/Root.jsx` ou `src/apps/MarketingApp.jsx` — toggle de tema

**Mudança:** adicionar `aria-label="Fechar"`, `aria-label="Limpar busca"`, `aria-label="Alternar tema"` nos respectivos botões.

**Rollback:** remover atributos.

---

### A-09 — Light mode: sombra nos cards

**Status:** pendente

**Por quê:** em light mode os cards se dissolvem no fundo branco sem elevação. Sombra sutil define estrutura sem poluir.

**Arquivo:** `src/index.css` — dentro do bloco `:root.light`

```css
:root.light .event-card,
:root.light .kpi,
:root.light .vendor-card {
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
```

**Rollback:** remover bloco CSS.

---

### A-10 — Light mode: botão primário em dark quando fundo é claro

**Status:** pendente

**Por quê:** `.btn-primary` com `background: #ffcb00` em fundo claro perde força visual. Em light mode, fundo escuro com texto branco é mais profissional e tem melhor contraste.

**Arquivo:** `src/index.css`

```css
:root.light .btn-primary {
  background: #111111;
  color: #ffffff;
}
:root.light .btn-primary:hover {
  background: #222222;
}
```

O amarelo `#ffcb00` permanece como cor de acento/borda em light — não some, só muda de papel.

**Rollback:** remover bloco CSS.

---

### A-11 — Toggle de tema: mover do canto inferior para superior direito (Login)

**Status:** pendente

**Por quê:** no login, o toggle fica no canto inferior direito da tela — pouco descobrível. Fora do card, no canto superior direito, fica sempre visível e consistente com a posição no app logado.

**Arquivo:** `src/auth/LoginAuth.jsx`, `src/auth/Login.jsx`

Mover o botão de toggle para fora do card de login, posicionado fixo no `top: 16px; right: 16px` via CSS absoluto relativo ao container da tela.

**Rollback:** reverter posição no JSX.

---

### A-12 — `text-overflow: ellipsis` no ranking do Vendedor

**Status:** pendente

**Por quê:** nomes longos de vendedores quebram o layout do ranking em telas pequenas.

**Arquivo:** `src/index.css` — seletor `.ranking-name`

```css
.ranking-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}
```

**Rollback:** remover propriedades.

---

## Fase B — Reorganização de componentes

> Mudanças em JSX: mover componentes, reordenar navegação, extrair pequenos componentes.
> Cada item é independente — pode ser implementado e revertido separadamente.
> Tempo estimado: 3–5 dias.

---

### B-01 — Dashboard como primeira tab ("Início")

**Status:** pendente

**Por quê:** o conteúdo de maior valor (KPIs, gráfico, alertas) está enterrado no scroll do tab Eventos. Deve ser o primeiro ponto de contato ao abrir o app.

**Arquivos:** `src/apps/MarketingApp.jsx`, `src/features/events/EventosTab.jsx`, `src/features/events/Dashboard.jsx`

**Mudanças:**
1. Em `MarketingApp.jsx`: adicionar `"inicio"` como primeiro tab na ordem de navegação, usando `Dashboard` como componente.
2. Definir `inicio` como tab ativa por padrão (substituir `eventos`).
3. Em `EventosTab.jsx`: remover a seção de Dashboard do final do arquivo (o componente `<Dashboard />` que aparece abaixo da lista).
4. Atualizar label e ícone do tab: label `"Início"`, ícone `home` (ou manter `chart` para "Visão Geral").
5. Ajustar bottom nav mobile para incluir o novo tab.

**O que NÃO muda:** o componente `Dashboard.jsx` em si — apenas onde é renderizado.

**Rollback:** `git revert <hash>` — remove o tab e restaura Dashboard no EventosTab.

---

### B-02 — Avatares de vendedor em EventosTab: limitar a 3 + contador "+N"

**Status:** pendente

**Por quê:** eventos com muitos vendedores transbordavam o card sem indicação do total real.

**Arquivo:** `src/features/events/EventosTab.jsx`

**Lógica:** onde atualmente renderiza todos os avatares, aplicar:
```jsx
const MAX_AVATARS = 3;
const visible = vendedores.slice(0, MAX_AVATARS);
const extra = vendedores.length - MAX_AVATARS;
// renderizar visible + (extra > 0 && <span>+{extra}</span>)
```

**Rollback:** remover lógica de slice — renderizar todos novamente.

---

### B-03 — Estado vazio nos tabs que ficam em branco

**Status:** pendente

**Por quê:** quando não há eventos no filtro ativo (ex: "ativo") a tela fica em branco sem feedback. Contexto zero = confusão do usuário.

**Arquivos:** `src/features/events/EventosTab.jsx`, `src/features/leads/LeadsTab.jsx`, `src/apps/VendedorApp.jsx` (Meus Leads)

**Mudança:** criar inline (sem novo arquivo de componente) um bloco condicional:
```jsx
{eventos.length === 0 && (
  <div className="empty">
    <p>Nenhum evento {filtro !== "todos" ? filtro : ""} no momento.</p>
  </div>
)}
```

A classe `.empty` já existe no CSS (`src/index.css`).

**Rollback:** remover bloco condicional.

---

### B-04 — Busca por nome em "Meus Leads" (Vendedor)

**Status:** pendente

**Por quê:** com 20+ leads a lista sem filtro é impraticável em campo.

**Arquivo:** `src/apps/VendedorApp.jsx`

**Mudança:** adicionar `useState` de busca + input simples acima da lista:
```jsx
const [busca, setBusca] = useState("");
const leadsFiltrados = leads.filter(l =>
  l.nome.toLowerCase().includes(busca.toLowerCase())
);
```

Input com `placeholder="Buscar por nome..."`, `className="big-field"`, botão clear (ícone X) quando tem texto.

**Sem nova lógica de negócio** — apenas filter local no array de estado existente.

**Rollback:** remover state + input + filter.

---

### B-05 — Tab Leads renomeada para "Relatórios"

**Status:** pendente

**Por quê:** a tab entrega exportação de CSV, não uma visão de leads. Nome atual cria expectativa errada.

**Arquivo:** `src/apps/MarketingApp.jsx`

**Mudança:** trocar label `"Leads"` por `"Relatórios"` no array de tabs e no bottom nav. O ícone permanece.

**Rollback:** trocar label de volta.

---

### B-06 — Reordenar bottom nav mobile do marketing

**Status:** pendente

**Depende de:** B-01 (tab Início)

**Ordem atual:** Eventos / Estoque / Leads / Equipe / Check-in (Monitor fora do nav mobile)

**Ordem V2:** Início / Eventos / Estoque / Equipe / ⋯ (Check-in e Relatórios via tab normal no desktop; no mobile o menu "⋯" ou simplificar para os 4 mais usados)

**Arquivo:** `src/apps/MarketingApp.jsx` — array de tabs na seção do bottom nav.

**Abordagem simples:** reordenar as tabs no array, manter as mesmas 5 no bottom nav mas com nova ordem. Não criar menu "⋯" nesta fase — apenas reordenar.

**Rollback:** restaurar ordem anterior do array.

---

### B-07 — Mini gráfico de vendedor → números diretos (EquipeTab)

**Status:** pendente

**Por quê:** o mini gráfico de barras dos últimos 3 eventos é pequeno demais para ser informativo. Números diretos são mais legíveis e ocupam menos espaço.

**Arquivo:** `src/features/team/EquipeTab.jsx`

**Mudança:** onde aparece o `<Bar>` (Chart.js) do mini gráfico, substituir por:
```jsx
<div className="v-recent-nums">
  {recent.slice(0,3).map((r,i) => (
    <span key={i} className="mono" title={r.nome}>{r.n}</span>
  ))}
</div>
```

Com CSS: exibição em linha, separados por `/`, fonte mono pequena.

**Rollback:** restaurar o bloco do gráfico.

---

### B-08 — Ações destrutivas em cards: introduzir menu "⋯"

**Status:** pendente

**Por quê:** Excluir evento e Excluir vendedor ficam no mesmo nível visual que Editar — ações de impactos muito diferentes sem hierarquia clara.

**Arquivos:** `src/features/events/EventDetail.jsx`, `src/features/team/EquipeAuthTab.jsx`

**Abordagem:** criar inline um componente de dropdown simples:
- Botão `⋯` que toggle um `div` com as ações menos frequentes
- Fechar ao clicar fora (listener `mousedown` no document)
- "Excluir" em vermelho com ícone de lixeira
- "Finalizar" (se aplicável) em amarelo

Não criar arquivo de componente separado nesta fase — implementar inline em cada tela.

**Rollback:** remover botão `⋯` e restaurar botões em linha.

---

### B-09 — Check-in: select filtrado a eventos ativos por padrão

**Status:** pendente

**Por quê:** usuários selecionavam eventos encerrados no check-in e ficavam confusos sem feedback.

**Arquivo:** `src/features/checkin/CheckinTab.jsx`

**Mudança:** filtrar o `<select>` de eventos para mostrar apenas os com `status === "ativo"` por padrão. Adicionar toggle `<label><input type="checkbox"> Ver todos os eventos</label>` que remove o filtro.

**Rollback:** remover filtro e toggle.

---

### B-10 — Check-in: CTA "Cadastrar como lead" quando sem match

**Status:** pendente

**Por quê:** sem match o sistema só mostra erro. Melhor aproveitamento: sugerir o próximo passo.

**Arquivo:** `src/features/checkin/CheckinTab.jsx`

**Mudança:** no bloco de "nenhum resultado", adicionar abaixo do card vermelho:
```jsx
<p style={{ color: "var(--text-2)", textAlign: "center", marginTop: 12 }}>
  Não encontrado. <button className="btn-ghost" onClick={...}>Registrar como novo lead</button>
</p>
```

O botão navega para o tab de Registrar (se no VendedorApp) ou pode abrir EventDetail do evento selecionado (se no MarketingApp). Nenhuma lógica nova — apenas navegação existente.

**Rollback:** remover bloco de CTA.

---

### B-11 — Monitor: mover para última posição na navegação

**Status:** pendente

**Por quê:** Monitor é uma aba de diagnóstico avançado. Tratá-la com o mesmo peso que Eventos ou Estoque cria ruído na navegação principal.

**Arquivo:** `src/apps/MarketingApp.jsx`

**Mudança:** no array de tabs, mover `"monitor"` para a última posição. No bottom nav mobile, se não couber, Monitor pode ser acessado apenas via header desktop — avaliar na implementação.

**Rollback:** restaurar posição no array.

---

### B-12 — Pacotes: mover do bottom nav para modal dentro de Evento

**Status:** pendente

**Por quê:** Pacotes ocupa um slot permanente no bottom nav do Vendedor com conteúdo raramente consultado após treinamento. Libera o nav para as 3 ações reais do campo.

**Arquivo:** `src/apps/VendedorApp.jsx`

**Mudanças:**
1. Remover tab `"pacotes"` do bottom nav.
2. Na tab `"evento"`, adicionar botão "Ver tabela de preços" (`.btn-ghost`, largura total).
3. Ao clicar, renderizar condicionalmente o conteúdo de Pacotes dentro da própria tab (toggle show/hide) — sem modal complexo, apenas um `useState` de visibilidade.
4. O componente `PacotesTab` continua existindo, apenas deixa de ser uma tab do nav.

**Rollback:** restaurar tab no array de navegação e remover botão/toggle.

---

## Fase C — Componentes novos

> Criação de componentes reutilizáveis. Maior esforço, maior consistência a longo prazo.
> Tempo estimado: 1 semana.
> Cada componente tem seu próprio commit e pode ser revertido independentemente.

---

### C-01 — `EmptyState` como componente reutilizável

**Status:** pendente

**Por quê:** a fase B implementa empty states inline em cada tela. Com 3+ telas usando o mesmo padrão, vale extrair para componente.

**Arquivo novo:** `src/components/EmptyState.jsx`

```jsx
// Props: icon (string, opcional), title, description (opcional), action (node, opcional)
export function EmptyState({ icon, title, description, action }) { ... }
```

Substituir os empty states inline implementados na Fase B por este componente.

**Rollback:** restaurar inline states e deletar arquivo.

---

### C-02 — `SearchInput` padronizado

**Status:** pendente

**Por quê:** busca foi adicionada em Meus Leads (B-04) e será adicionada em EventDetail leads. Dois inputs de busca com estilo diferente cria inconsistência.

**Arquivo novo:** `src/components/SearchInput.jsx`

```jsx
// Props: value, onChange, placeholder, onClear
export function SearchInput({ value, onChange, placeholder, onClear }) { ... }
```

Aplicar em: Meus Leads, tabela de leads do EventDetail.

**Rollback:** substituir componente por inputs inline e deletar arquivo.

---

### C-03 — Busca/filtro na tabela de leads do EventDetail

**Status:** pendente

**Depende de:** C-02

**Por quê:** com 50+ leads a tabela sem busca é inutilizável.

**Arquivo:** `src/features/events/EventDetail.jsx`

**Mudança:** adicionar `useState` de busca + `<SearchInput>` acima da tabela de leads. Filter local: `leads.filter(l => l.nome.toLowerCase().includes(busca.toLowerCase()))`.

**Rollback:** remover state, componente e filter.

---

### C-04 — `TableScrollHint` nas tabelas com overflow horizontal

**Status:** pendente

**Por quê:** tabelas com scroll horizontal em mobile não têm indicação visual de que há conteúdo para o lado.

**Abordagem:** não criar componente novo — adicionar CSS puro:

```css
.tbl-wrap {
  position: relative;
}
.tbl-wrap::after {
  content: "";
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 32px;
  background: linear-gradient(to right, transparent, var(--bg));
  pointer-events: none;
}
```

Aplicar apenas em mobile via `@media (max-width: 760px)`.

**Rollback:** remover bloco CSS.

---

### C-05 — Destaque da posição do vendedor logado no ranking

**Status:** pendente

**Por quê:** o vendedor precisa saber imediatamente onde está no ranking sem procurar o próprio nome na lista.

**Arquivo:** `src/apps/VendedorApp.jsx` — seção de ranking na tab Evento

**Mudança:** identificar o item do ranking onde `v.id === usuarioAtual.id` e adicionar classe `ranking-item.me` (já existe no CSS) + scroll automático até aquele item ao carregar.

A classe `.ranking-item.me` já tem `box-shadow: 0 0 0 2px var(--rj-blue)` definido — só falta aplicar a lógica de identificação.

**Rollback:** remover condição de classe e scroll.

---

### C-06 — Bottom sheet para modais em mobile

**Status:** pendente

**Complexidade:** Média — requer lógica de detecção de mobile e animação CSS.

**Por quê:** modais centralizados em mobile com teclado virtual aberto criam problemas de layout (especialmente em iOS). Bottom sheet é o padrão nativo.

**Abordagem:** adicionar classe condicional ao modal quando `window.innerWidth <= 760`:
```css
@media (max-width: 760px) {
  .modal {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    top: auto;
    border-radius: 20px 20px 0 0;
    max-height: 90vh;
    overflow-y: auto;
    transform: translateY(0);
    animation: slideUp .25s ease;
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
}
```

Nenhuma mudança em JSX — apenas CSS.

**Rollback:** remover bloco `@media`.

---

## Checklist de Conclusão por Fase

### Fase A
- [ ] A-01 — Cor de marca `#ffcb00` ✅ CONCLUÍDO
- [ ] A-02 — Contraste `--text-3` → `#777777`
- [ ] A-03 — Fundo dark → `#111111`
- [ ] A-04 — Bordas dark → `#333333`
- [ ] A-05 — Hover de card com tint
- [ ] A-06 — Inputs Vendedor min-height 48px
- [ ] A-07 — Botão REGISTRAR 56px
- [ ] A-08 — `aria-label` em botões de ícone
- [ ] A-09 — Light mode: sombra nos cards
- [ ] A-10 — Light mode: botão primário dark
- [ ] A-11 — Toggle tema no login: mover para topo
- [ ] A-12 — Ellipsis no ranking

### Fase B
- [ ] B-01 — Dashboard como tab "Início"
- [ ] B-02 — Avatares limitados a 3 + "+N"
- [ ] B-03 — Empty states nos tabs
- [ ] B-04 — Busca em Meus Leads
- [ ] B-05 — Tab Leads → "Relatórios"
- [ ] B-06 — Reordenar bottom nav marketing
- [ ] B-07 — Mini gráfico → números diretos
- [ ] B-08 — Menu "⋯" para ações destrutivas
- [ ] B-09 — Check-in filtrado a eventos ativos
- [ ] B-10 — Check-in CTA "Cadastrar como lead"
- [ ] B-11 — Monitor como última tab
- [ ] B-12 — Pacotes → modal dentro de Evento

### Fase C
- [ ] C-01 — `EmptyState` como componente
- [ ] C-02 — `SearchInput` padronizado
- [ ] C-03 — Busca de leads no EventDetail
- [ ] C-04 — TableScrollHint (CSS)
- [ ] C-05 — Destaque da posição no ranking
- [ ] C-06 — Bottom sheet para modais mobile

---

## Referências

| Documento | Papel |
|-----------|-------|
| `doc/ui/UI_VERSIONS.md` | Baseline da V1 — preservado como referência |
| `doc/ui/historico/UX_UI_V2_PROPOSAL.md` | Proposta aprovada — origem deste plano |
| `doc/architecture/SYSTEM_MAP.md` | Restrições arquiteturais — consultar antes de cada etapa |
