# UX/UI V2 — Changelog de Implementação

> Registro oficial de cada etapa implementada, com hashes git, arquivos alterados e instruções de rollback.
> Atualizar este documento a cada etapa concluída.
> **Nunca apagar entradas anteriores — apenas adicionar.**

---

## Índice de Referência Rápida

| Estado | Significado |
|--------|-------------|
| ✅ CONCLUÍDO | Implementado, commitado, publicado |
| 🔄 EM ANDAMENTO | Sendo implementado agora |
| ⏳ PENDENTE | Aguardando vez na fila |
| ⏸ PAUSADO | Implementado mas revertido temporariamente |
| ❌ CANCELADO | Descartado com justificativa |

---

## Pontos de Restauração Principais

> Estes são os commits âncora do projeto. Use-os para rollback total quando necessário.

| Nome | Hash completo | Data | Descrição |
|------|--------------|------|-----------|
| **V1 — Produção estável** | `b250c6827d433b0133f766a025c00115508708bc` | 2026-06-18 | Último commit antes de qualquer trabalho de UI/UX V2. Estado de produção estável com D-051. |
| **Docs V1 catalogada** | `48205f3f50650232df1db4ca5052de4614783f72` | 2026-06-18 | Criação do catálogo UI_VERSIONS.md com V1 documentada. |
| **Proposta V2 criada** | `3cb9250fedbf88fb48510ccdf945c1c71b2b2ecc` | 2026-06-18 | UX_UI_V2_PROPOSAL.md completo. Nenhum código alterado. |
| **Início da V2 (cor + plano)** | `0a7e4b2dddf3de93c5dd1e64d2492e3e1190ed21` | 2026-06-18 | Cor `#ffcb00` aplicada + plano de implementação criado. Primeiro commit que tocou em código. |

### Como usar os pontos de restauração

```bash
# Ver o estado do projeto em qualquer ponto de restauração (sem alterar nada):
git show <hash>:src/index.css

# Voltar completamente para a V1 estável (opção segura — preserva histórico):
git revert 0a7e4b2..HEAD --no-edit
git push

# Voltar completamente para a V1 estável (opção destrutiva — usar só em branch de teste):
git reset --hard b250c6827d433b0133f766a025c00115508708bc
git push --force
```

---

## Fase A — Correções CSS

> Objetivo: corrigir contraste, área de toque, acessibilidade e light mode.
> Estratégia de rollback: `git revert <hash> --no-edit` por item.
> Sem alteração de lógica ou fluxos de negócio.

---

### A-01 — Cor de marca: `#f5c000` → `#ffcb00`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `0a7e4b2dddf3de93c5dd1e64d2492e3e1190ed21` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css`, `src/features/events/Dashboard.jsx`, `src/features/events/EventDetail.jsx`, `src/features/team/EquipeTab.jsx`, `src/components/ui.jsx`, `src/apps/VendedorApp.jsx` |
| **O que mudou** | `--rj-blue: #f5c000` → `#ffcb00` / `--rj-blue-light: #ffd740` → `#ffe04d` / `--yellow: #f5c000` → `#ffcb00` / Todas as ocorrências hardcoded substituídas |
| **Por quê** | Cor oficial da RJNet é `#ffcb00`. O sistema usava `#f5c000` (amarelo levemente diferente). |
| **Rollback** | `git revert 0a7e4b2 --no-edit && git push` |

---

### A-02 — Contraste `--text-3`: `#666666` → `#777777`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `de2f3b912ab056bfe0f39c4a81b243906735484f` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | `--text-3: #666666` → `--text-3: #777777` |
| **Por quê** | `#666666` em fundo `#111111` tem contraste 3.0:1 — falha WCAG AA para texto < 18px. `#777777` atinge 3.5:1. Afeta labels de tabela, captions e textos terciários. |
| **Rollback** | `git revert de2f3b912ab056bfe0f39c4a81b243906735484f --no-edit && git push` |

---

### A-03 — Fundo dark: `#0f0f0f` → `#111111`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `df0dc9ed74d2d740b2f0aad2c6b75cf2b4cb561e` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | `--bg: #0f0f0f` → `--bg: #111111` |
| **Por quê** | `#111111` é padrão Material Design para dark mode e renderiza melhor em LCD. `#0f0f0f` pode parecer "sujo" em telas não-OLED. |
| **Rollback** | `git revert df0dc9ed74d2d740b2f0aad2c6b75cf2b4cb561e --no-edit && git push` |

---

### A-04 — Bordas dark mais visíveis: `#2e2e2e` → `#333333`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `bf55cd9775c0744c3371c89fae88482f2692248d` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | `--border: #2e2e2e` → `--border: #333333` |
| **Por quê** | Contraste de `#2e2e2e` sobre `#1a1a1a` é ~1.3:1 — bordas quase invisíveis. `#333333` melhora para ~1.5:1. |
| **Rollback** | `git revert bf55cd9775c0744c3371c89fae88482f2692248d --no-edit && git push` |

---

### A-05 — Hover de card: tint de fundo amarelo sutil

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `0d62300ded4cfcb252f8823bfa29ff8746353c4d` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | `.event-card:hover` e `.kpi:hover` ganham `background: rgba(255,203,0,0.04)` além do box-shadow existente |
| **Por quê** | Hover com apenas borda colorida é sutil demais. O tint torna a interatividade óbvia sem poluir visualmente. |
| **Rollback** | `git revert 0d62300ded4cfcb252f8823bfa29ff8746353c4d --no-edit && git push` |

---

### A-06 — Inputs do Vendedor: `min-height: 48px`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `05cb72850f01a2dd226a9916c3d8ad6a574ddd50` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | `.big-field` e `.seg-btn` dentro de `.vend-shell` recebem `min-height: 48px` |
| **Por quê** | Área de toque mínima recomendada é 44–48px. Em campo com uma mão, inputs pequenos causam erros de toque. |
| **Rollback** | `git revert 05cb72850f01a2dd226a9916c3d8ad6a574ddd50 --no-edit && git push` |

---

### A-07 — Botão "Registrar Lead": altura `56px`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `81ef0b527aa9884f45b1b3895c85f03cf3410a71` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | Criar classe `.btn-submit-lead` com `min-height: 56px; font-size: 16px; font-weight: 700; width: 100%`. Adicionar a classe no botão de submit do VendedorApp. |
| **Por quê** | É a ação principal do app do vendedor — merece o maior alvo de toque da tela. |
| **Rollback** | `git revert 81ef0b527aa9884f45b1b3895c85f03cf3410a71 --no-edit && git push` |

---

### A-08 — `aria-label` em botões de ícone

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `3b9d213aee743d425d315633716fc26f78203e16` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/components/modals/EventModal.jsx`, `src/components/modals/MaterialModal.jsx`, `src/features/checkin/CheckinTab.jsx`, `src/apps/MarketingApp.jsx` |
| **O que vai mudar** | Adicionar `aria-label="Fechar"` nos botões X dos modais; `aria-label="Limpar busca"` no botão clear do check-in; `aria-label="Alternar tema"` no toggle de tema |
| **Por quê** | Botões sem texto visível são invisíveis para leitores de tela. Requisito básico de acessibilidade. |
| **Rollback** | `git revert 3b9d213aee743d425d315633716fc26f78203e16 --no-edit && git push` |

---

### A-09 — Light mode: sombra nos cards

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `2847bc3dd0e8ee087a7406221a4c651d01b3fe1d` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | Dentro de `:root.light`: `.event-card`, `.kpi`, `.vendor-card` recebem `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` |
| **Por quê** | Em light mode os cards se dissolvem no fundo claro sem elevação visual. Sombra sutil define estrutura. |
| **Rollback** | `git revert 2847bc3dd0e8ee087a7406221a4c651d01b3fe1d --no-edit && git push` |

---

### A-10 — Light mode: botão primário escuro

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `e121834a2704e55965abce82c739542452549848` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | Dentro de `:root.light`: `.btn-primary { background: #111111; color: #ffffff }` e `.btn-primary:hover { background: #222222 }` |
| **Por quê** | `.btn-primary` amarelo em fundo claro perde força visual. Escuro com texto branco tem mais contraste e aparência profissional. O amarelo `#ffcb00` permanece como acento/hover/bordas. |
| **Rollback** | `git revert e121834a2704e55965abce82c739542452549848 --no-edit && git push` |

---

### A-11 — Toggle de tema no login: mover para canto superior direito

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `414d7f8010cd2e14660332df2c58f2c9182f797b` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/auth/LoginAuth.jsx`, `src/auth/Login.jsx` |
| **O que vai mudar** | Mover o botão de toggle de tema para fora do card, posicionado com `position: absolute; top: 16px; right: 16px` no container da tela de login |
| **Por quê** | No canto inferior direito do card é pouco descobrível. No topo é consistente com a posição no app logado. |
| **Rollback** | `git revert 414d7f8010cd2e14660332df2c58f2c9182f797b --no-edit && git push` |

---

### A-12 — Ellipsis no ranking do Vendedor

| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `550c4426a1ea465c999dad875fd2c61cbe0dba2f` |
| **Data** | 2026-06-18 |
| **Arquivos alterados** | `src/index.css` |
| **O que vai mudar** | `.ranking-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }` |
| **Por quê** | Nomes longos quebram o layout do ranking em telas pequenas. |
| **Rollback** | `git revert 550c4426a1ea465c999dad875fd2c61cbe0dba2f --no-edit && git push` |

---

## Fase B — Reorganização de Componentes

> Objetivo: reordenar navegação, simplificar telas, melhorar fluxos operacionais.
> Estratégia de rollback: `git revert <hash> --no-edit` por item.
> Cada item é independente — pode ser revertido sem afetar os demais.

---

### B-01 — Dashboard como primeira tab "Início"

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/apps/MarketingApp.jsx`, `src/features/events/EventosTab.jsx` |
| **O que vai mudar** | Adicionar tab `"inicio"` como primeira na navegação usando `Dashboard.jsx`. Remover `<Dashboard />` do rodapé de `EventosTab`. Definir `"inicio"` como tab padrão ao abrir o app. |
| **Por quê** | KPIs e visão geral estão enterrados via scroll no tab Eventos. Devem ser o primeiro ponto de contato. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-02 — Avatares de vendedor: limitar a 3 + "+N"

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/features/events/EventosTab.jsx` |
| **O que vai mudar** | Exibir no máximo 3 avatares + `+N` quando houver mais. Ex: com 8 vendedores → 3 avatares + "+5". |
| **Por quê** | Eventos com muitos vendedores transbordavam o card sem indicação do total real. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-03 — Empty states nos tabs sem conteúdo

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/features/events/EventosTab.jsx`, `src/features/leads/LeadsTab.jsx`, `src/apps/VendedorApp.jsx` |
| **O que vai mudar** | Bloco condicional com mensagem contextual quando lista está vazia. Usa classe `.empty` já existente no CSS. |
| **Por quê** | Tela em branco sem feedback confunde o usuário — não sabe se é bug ou se de fato não há dados. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-04 — Busca por nome em "Meus Leads" (Vendedor)

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/apps/VendedorApp.jsx` |
| **O que vai mudar** | `useState` de busca + input acima da lista + `filter()` local no array de leads. Sem nova lógica de negócio. |
| **Por quê** | Com 20+ leads a lista sem filtro é impraticável em campo. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-05 — Tab "Leads" renomeada para "Relatórios"

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/apps/MarketingApp.jsx` |
| **O que vai mudar** | Label `"Leads"` → `"Relatórios"` no array de tabs e no bottom nav. |
| **Por quê** | A tab entrega exportação CSV, não visão de leads. Nome atual cria expectativa errada. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-06 — Reordenar bottom nav mobile do marketing

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Depende de** | B-01 (tab Início criada) |
| **Data** | — |
| **Arquivos a alterar** | `src/apps/MarketingApp.jsx` |
| **O que vai mudar** | Nova ordem: Início / Eventos / Estoque / Equipe / Check-in |
| **Por quê** | Com Dashboard como primeira tab, a ordem de navegação precisa refletir a nova hierarquia. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-07 — Mini gráfico de vendedor → números diretos

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/features/team/EquipeTab.jsx` |
| **O que vai mudar** | Substituir o gráfico `<Bar>` do Chart.js por números diretos dos últimos 3 eventos (ex: `12 / 8 / 15`) em fonte mono. |
| **Por quê** | Mini gráfico é pequeno demais para ser legível. Números diretos ocupam menos espaço e comunicam melhor. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-08 — Menu "⋯" para ações destrutivas nos cards

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/features/events/EventDetail.jsx`, `src/features/team/EquipeAuthTab.jsx` |
| **O que vai mudar** | Botões "Excluir" saem do nível principal e vão para dropdown `⋯`. "Excluir" em vermelho. "Finalizar" (se aplicável) em amarelo. |
| **Por quê** | Ações de impactos muito diferentes (editar vs. excluir) no mesmo nível visual aumentam risco de clique acidental. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-09 — Check-in: filtrar apenas eventos ativos por padrão

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/features/checkin/CheckinTab.jsx` |
| **O que vai mudar** | Select de eventos filtra `status === "ativo"` por padrão. Checkbox "Ver todos os eventos" remove o filtro. |
| **Por quê** | Usuários selecionavam eventos encerrados e ficavam confusos sem feedback claro. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-10 — Check-in: CTA "Cadastrar como lead" quando sem match

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/features/checkin/CheckinTab.jsx` |
| **O que vai mudar** | Abaixo do card "sem resultado", botão ghost "Registrar como novo lead" que navega para o tab Registrar. Nenhuma lógica nova — apenas navegação existente. |
| **Por quê** | Sem match, o sistema só mostra erro. Sugere o próximo passo natural. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-11 — Monitor: última posição na navegação

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/apps/MarketingApp.jsx` |
| **O que vai mudar** | Tab Monitor movida para última posição no array de tabs. |
| **Por quê** | Monitor é ferramenta de diagnóstico avançado — não deve competir visualmente com Eventos, Estoque ou Equipe na navegação principal. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### B-12 — Pacotes: sair do nav, acessar via Evento

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/apps/VendedorApp.jsx` |
| **O que vai mudar** | Tab `"pacotes"` removida do bottom nav. Na tab `"evento"`, botão ghost "Ver tabela de preços" que faz toggle do conteúdo de Pacotes inline. O componente `PacotesTab` não é deletado. |
| **Por quê** | Pacotes usa um slot permanente do nav com conteúdo raramente consultado após treinamento. Libera o nav para as 3 ações reais de campo. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

## Fase C — Componentes Novos

> Objetivo: padronizar componentes reutilizáveis, polish final.
> Estratégia de rollback: `git revert <hash> --no-edit` por item.

---

### C-01 — Componente `EmptyState` reutilizável

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a criar** | `src/components/EmptyState.jsx` |
| **Arquivos a alterar** | `src/features/events/EventosTab.jsx`, `src/features/leads/LeadsTab.jsx`, `src/apps/VendedorApp.jsx` (substituir os empty states inline criados em B-03) |
| **Por quê** | Com 3+ telas usando o mesmo padrão de empty state, extrair para componente evita duplicação. |
| **Rollback** | `git revert <hash> --no-edit && git push` (restaura inline states, deleta arquivo) |

---

### C-02 — Componente `SearchInput` padronizado

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a criar** | `src/components/SearchInput.jsx` |
| **Arquivos a alterar** | `src/apps/VendedorApp.jsx` (Meus Leads — substituir input de B-04) |
| **Por quê** | Padroniza o input de busca para reuso em C-03 e futuras telas. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### C-03 — Busca de leads na tabela do EventDetail

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Depende de** | C-02 |
| **Data** | — |
| **Arquivos a alterar** | `src/features/events/EventDetail.jsx` |
| **O que vai mudar** | `<SearchInput>` acima da tabela de leads + `filter()` local por nome. |
| **Por quê** | Com 50+ leads a tabela sem busca é inutilizável. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### C-04 — Hint de scroll horizontal em tabelas (CSS)

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/index.css` |
| **O que vai mudar** | `.tbl-wrap::after` com gradiente `linear-gradient(to right, transparent, var(--bg))` visível apenas em mobile (`@media max-width: 760px`). |
| **Por quê** | Tabelas com overflow horizontal em mobile não têm indicação visual de que há conteúdo para o lado. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### C-05 — Destaque da posição do vendedor no ranking

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/apps/VendedorApp.jsx` |
| **O que vai mudar** | Item do ranking onde `v.id === usuarioAtual.id` recebe classe `ranking-item.me` (já tem CSS definido: `box-shadow: 0 0 0 2px var(--rj-blue)`). Scroll automático até ele ao carregar. |
| **Por quê** | Vendedor precisa ver imediatamente onde está no ranking sem procurar o próprio nome. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

### C-06 — Modais como bottom sheet em mobile (CSS)

| Campo | Valor |
|-------|-------|
| **Status** | ⏳ PENDENTE |
| **Hash** | — |
| **Data** | — |
| **Arquivos a alterar** | `src/index.css` |
| **O que vai mudar** | `@media (max-width: 760px)` no `.modal`: `position: fixed; bottom: 0; border-radius: 20px 20px 0 0; animation: slideUp .25s ease`. Nenhum JSX alterado. |
| **Por quê** | Modais centralizados em mobile com teclado virtual causam problemas de layout em iOS. Bottom sheet é o padrão nativo. |
| **Rollback** | `git revert <hash> --no-edit && git push` |

---

## Comandos de Rollback — Referência Rápida

```bash
# Desfazer o último commit
git revert HEAD --no-edit && git push

# Desfazer um commit específico pelo hash
git revert <hash> --no-edit && git push

# Ver o que um commit alterou antes de reverter
git show <hash> --stat

# Ver o conteúdo de um arquivo em determinado commit
git show <hash>:src/index.css

# Desfazer todos os commits da Fase A (exemplo com 11 commits)
git revert HEAD~11..HEAD --no-edit && git push

# Voltar completamente à V1 estável (SEGURO — preserva histórico)
git revert 0a7e4b2..HEAD --no-edit && git push

# Voltar completamente à V1 estável (DESTRUTIVO — apaga commits)
git reset --hard b250c6827d433b0133f766a025c00115508708bc && git push --force
```

---

## Checklist de Status

### Fase A — Correções CSS
- [x] A-01 — Cor de marca `#ffcb00` — `de2f3b9` (incluído no commit `0a7e4b2`)
- [x] A-02 — Contraste `--text-3` → `#777777` — `de2f3b9`
- [x] A-03 — Fundo dark → `#111111` — `df0dc9e`
- [x] A-04 — Bordas dark → `#333333` — `bf55cd9`
- [x] A-05 — Hover de card com tint — `0d62300`
- [x] A-06 — Inputs Vendedor min-height 52px — `05cb728`
- [x] A-07 — Botão Registrar Lead 56px bold — `81ef0b5`
- [x] A-08 — `aria-label` em botões de ícone — `3b9d213`
- [x] A-09 — Light mode: sombra nos cards — `2847bc3`
- [x] A-10 — Light mode: botão primário escuro — `e121834`
- [x] A-11 — Toggle tema no login: topo direito — `414d7f8`
- [x] A-12 — Ellipsis no ranking — `550c442`

### Fase B — Reorganização de Componentes
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

### Fase C — Componentes Novos
- [ ] C-01 — `EmptyState` como componente
- [ ] C-02 — `SearchInput` padronizado
- [ ] C-03 — Busca de leads no EventDetail
- [ ] C-04 — TableScrollHint (CSS)
- [ ] C-05 — Destaque da posição no ranking
- [ ] C-06 — Bottom sheet para modais mobile

---

## Histórico de Rollbacks

> Registrar aqui quando alguma etapa for revertida, com motivo.

| Data | Etapa revertida | Hash revertido | Motivo |
|------|----------------|---------------|--------|
| — | — | — | — |
