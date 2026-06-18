# UX/UI V2 Proposal — RJNet Gestão de Eventos

> **Status:** AGUARDANDO APROVAÇÃO — não implementar nada antes da aprovação explícita.
> **Autor:** Claude (Senior Product Designer / UX / UI / PM / Frontend Architect)
> **Baseado em:** `doc/ui/UI_VERSIONS.md` (v1.0 baseline)
> **Data:** 2026-06-18

---

## Resumo Executivo

A V1 é funcional, coesa e production-ready. Entrega o que precisa. O problema não é o que ela faz — é como ela apresenta o que faz.

Três gargalos centrais foram identificados:

1. **Densidade excessiva no app de marketing** — o tab Eventos empilha lista + dashboard na mesma tela, criando scroll infinito e ausência de hierarquia de ação.
2. **Sistema de tipos tipográficos fragmentado** — 10 tamanhos distintos em uso sem escala definida, gerando inconsistência visual perceptível principalmente em tabelas e cards.
3. **App do vendedor otimizado para tela, não para contexto** — em campo, durante um evento movimentado, o vendedor precisa de velocidade máxima. A tela de Registrar exige múltiplos gestos para ações que deveriam ser de 1 toque.

A V2 proposta não altera funcionalidades, regras de negócio, fluxos principais ou arquitetura. Refina o que existe: hierarquia, espaçamento, tipografia, consistência de componentes e velocidade operacional.

**Impacto esperado:** redução de 30–40% no tempo de registro de lead em campo; navegação mais clara para o time de marketing; visual mais profissional alinhado à identidade da RJNet.

---

## Objetivos da V2

| # | Objetivo | Métrica de sucesso |
|---|----------|--------------------|
| 1 | Reduzir fricção no registro de leads | Tempo de registro < 20s em modo rápido |
| 2 | Clarificar hierarquia visual do app de marketing | Usuário encontra qualquer dado em ≤ 2 cliques |
| 3 | Padronizar o sistema tipográfico | Máximo 5 tamanhos em uso ativo |
| 4 | Tornar o dark mode mais refinado | Contraste AA em todos os textos essenciais |
| 5 | Criar consistência entre componentes análogos | 0 variações não intencionais de padding/radius |
| 6 | Melhorar experiência mobile do marketing | Navegação funcional em uma mão |

---

## Auditoria da V1

### Pontos Fortes

- **Paleta dark consistente** — as variáveis CSS (`--bg`, `--surface`, `--border`, etc.) são bem definidas e usadas de forma uniforme.
- **Responsividade funcional** — o breakpoint em 760px com troca de header/bottom-nav funciona bem na prática.
- **Padrões de badge** — `StatusBadge` e `TipoBadge` são consistentes e bem aplicados.
- **Toast com desfazer** — padrão correto de UX para ações destrutivas reversíveis.
- **Confirmação em 2 passos** — delete de lead com confirmação inline é seguro e não-intrusivo.
- **Modo rápido no Registrar** — decisão excelente; simplifica o fluxo principal do vendedor.
- **Fila offline visível no Monitor** — transparência técnica valiosa para o time de marketing.

### Pontos Fracos

#### Hierarquia e Layout

- **Tab Eventos é dupla responsabilidade**: lista de eventos + dashboard KPIs + gráfico donut + próximos eventos numa única tela. O scroll é longo e a prioridade não é clara.
- **Dashboard enterrado**: os KPIs mais importantes (eventos ativos, leads, estoque crítico) aparecem abaixo da lista de eventos — o usuário precisa rolar para chegar ao que provavelmente é o mais consultado.
- **Tab Leads subutilizada**: a tela é basicamente um formulário de exportação CSV. Não existe visão de leads, totais, tendências. O nome da tab promete mais do que entrega.
- **Monitor para o usuário de marketing, não para o técnico**: o feed de atividade é rico, mas a aba está ao lado de Check-in na navegação como se tivesse o mesmo peso. É uma aba de diagnóstico avançado tratada como aba primária.

#### Tipografia

- **10 tamanhos de fonte em uso** (10px, 11px, 12px, 13px, 14px, 15px, 16px, 18px, 22px, 26px+) sem escala formal definida.
- **Labels de formulário em 12px cinza** ficam abaixo do contraste mínimo recomendado em light mode.
- **`DM Mono` misturado com `DM Sans`** sem critério visual claro além de "é número" — em alguns cards o número em mono com fonte grande ao lado de texto em sans cria ritmo visual quebrado.

#### Consistência de Componentes

- **Dois padrões de modal**: `EventModal` e `MaterialModal` seguem a mesma estrutura, mas o padding interno e o espaçamento dos campos varia.
- **Formulários inline (VendedorApp) vs modais (MarketingApp)**: decisão arquitetural coerente, mas sem padronização visual — os inputs do inline têm estilos ligeiramente diferentes dos do modal.
- **Botões com 3 semânticas diferentes para "ação secundária"**: `.btn-ghost`, `.btn-check-devolucao` e links estilizados coexistem sem hierarquia clara.
- **Cards de evento, cards de vendedor e cards de material** têm bordas, sombras e radii ligeiramente diferentes sem justificativa semântica.

#### Mobile (Marketing)

- **Header com 6 abas em mobile** não aparece (substituído pelo bottom nav), mas o bottom nav mostra apenas 5 itens — Monitor e Check-in competem pelo último slot, e a solução atual some com um deles.
- **Tabelas não responsivas**: a tabela de leads no `EventDetail` e a tabela de seleção em `LeadsTab` requerem scroll horizontal em telas < 480px — sem indicação visual de que há conteúdo para o lado.
- **Modais em mobile**: `EventModal` em tela pequena não vira bottom sheet completamente — aparece com scroll interno, o que em iOS causa problemas com o teclado virtual.

#### Mobile (Vendedor)

- **Tab "Pacotes" ocupa slot permanente no bottom nav** com conteúdo hardcoded que o vendedor consulta raramente após o treinamento. Está tomando espaço de ação de uma aba que seria consultada em campo.
- **Campos de formulário em 14px** — em telas pequenas o toque em inputs adjacentes pode acionar o campo errado (área de toque < 44px recomendados).

#### Acessibilidade

- **`--rj-blue` (#f5c000) em `--bg` (#0f0f0f)** → contraste ~8.5:1 ✓ (excelente).
- **`--text-2` (#b0b0b0) em `--bg` (#0f0f0f)** → contraste ~5.9:1 ✓ (passa AA).
- **`--text-3` (#666666) em `--bg` (#0f0f0f)** → contraste ~3.0:1 ✗ (falha AA para texto normal < 18px). Usado em labels de tabela, placeholders e seções — problema real.
- **Light mode**: `--text-3` em light (`#999999` invertido) em fundo claro pode ficar ainda pior.
- **Cor como único indicador** em alguns pontos: o status dot do vendedor no Monitor usa apenas cor (verde/amarelo/cinza) sem label textual adjacente sempre visível.
- **`aria-label` ausente** em botões de ícone (fechar modal, clear do input de checkin, toggle de tema).

#### Dark Mode

- **`#0f0f0f` como fundo principal** é quase preto puro. Em displays OLED é ideal, mas em LCD escuro pode parecer "sujo" comparado a um `#111111` ou `#121212` (Material Design recomenda `#121212`).
- **Bordas `#2e2e2e`** sobre superfície `#1a1a1a` geram contraste de apenas ~1.3:1 — bordas quase invisíveis. Em alguns cards a estrutura é percebida apenas pela diferença de cor de fundo.
- **Estados de hover** nos cards de evento usam `border-color → --rj-blue` como único indicador — sutil demais em dark mode com periféricos de baixa qualidade.

#### Light Mode

- **Não há documentação de como o light mode foi projetado** — parece uma inversão automática das variáveis, não um design deliberado.
- **`--rj-blue` (#f5c000) em fundo branco** → contraste de texto sobre amarelo é problemático para qualquer texto escuro com menos de 18px.
- **`--surface` em light** fica branco/quase branco sobre fundo branco — cards se dissolvem sem elevação visual (sem sombra).

### Gargalos de Usabilidade

1. **Vendedor registrando lead durante evento movimentado**: 6+ interações obrigatórias antes de salvar (nome → telefone → serviço → temperatura → submit → toast).
2. **Marketing buscando KPIs rápidos**: precisa abrir o app → ver a lista de eventos → rolar para baixo → encontrar os KPIs.
3. **Marketing adicionando material a evento**: Eventos → selecionar evento → rolar até seção Materiais → preencher form inline de 3 campos → salvar.
4. **Tabela de leads no EventDetail**: sem paginação, sem busca, sem ordenação. Com 50+ leads fica inutilizável.

---

## Melhorias Priorizadas

Ordenadas por impacto/esforço:

| Prioridade | Melhoria | Impacto | Complexidade |
|-----------|----------|---------|--------------|
| 1 | Separar Dashboard como tab própria no marketing | Alto | Baixa |
| 2 | Padronizar escala tipográfica (5 sizes) | Alto | Baixa |
| 3 | Aumentar área de toque dos campos do vendedor (min 48px) | Alto | Baixa |
| 4 | Corrigir contraste de `--text-3` | Alto | Baixa |
| 5 | Substituir tab Pacotes por acesso via modal/dropdown | Médio | Baixa |
| 6 | Indicar scroll horizontal em tabelas | Médio | Baixa |
| 7 | Padronizar padding/radius dos cards | Médio | Baixa |
| 8 | Adicionar skeleton loading nos cards de evento | Médio | Média |
| 9 | Melhorar bottom nav mobile do marketing (reordenar) | Médio | Baixa |
| 10 | Refinar light mode com elevação via sombra | Médio | Média |
| 11 | Adicionar `aria-label` em botões de ícone | Alto | Baixíssima |
| 12 | Melhorar feedback visual de hover nos cards | Baixo | Baixa |

---

## Propostas por Tela

---

### Tela 1 — Login

#### Estado Atual
Card centralizado (380px), logo 90px, tag "Gestão de Eventos", email/senha, botão Entrar, link de recuperação, toggle de tema no canto inferior direito. MFA como estado adicional da mesma tela.

#### Problemas
- Toggle de tema no canto inferior direito é pouco descobrível.
- Tag "Gestão de Eventos" em texto puro, sem hierarquia visual com o logo.
- Após erro de login, o campo de senha fica preenchido — usuário precisa limpar manualmente.
- O estado de MFA aparece na mesma tela sem transição visual clara — pode confundir.

#### Proposta V2
- Mover toggle de tema para canto **superior direito** da tela (fora do card), sempre visível.
- Limpar campo senha automaticamente em erro de autenticação.
- Adicionar transição suave (fade/slide) entre estados do form (login → MFA → recuperação).
- Tag "Gestão de Eventos" com peso visual menor (12px, `--text-3`), mais como subtítulo do que heading.
- Logo levemente maior (100px) com mais espaço ao redor.
- Nenhuma mudança estrutural — mesmas informações, melhor hierarquia.

#### Impacto: Baixo | Complexidade: Baixa

---

### Tela 2 — Dashboard (Marketing) ← **nova tab separada**

#### Estado Atual
Não existe como tela independente. O Dashboard (KPIs + gráfico + próximos eventos) está embutido no rodapé da tab Eventos, acessado apenas via scroll.

#### Problema Central
O Dashboard é o conteúdo de maior valor para o usuário de marketing na abertura do app. Estar enterrado abaixo da lista de eventos significa que o usuário nunca o vê no workflow normal.

#### Proposta V2
Promover o Dashboard para **primeira tab da navegação**, renomeada para "Início" ou "Visão Geral".

**Layout da nova tab:**
```
[ Header: logo + nav ]

┌─────────────────────────────────────┐
│ Bom dia, [nome] · [data de hoje]    │
└─────────────────────────────────────┘

[ KPI Grid: 4 cards — Eventos Ativos / Total Leads / Materiais Críticos / Vendedores Ativos ]

[ Gráfico donut: Leads por Serviço ]   [ Próximos Eventos: lista top 3 ]

[ Alerta: se houver materiais críticos → card vermelho de atenção ]
```

**Mudanças:**
- Saudação contextual com nome do usuário e data — aumenta senso de pertencimento.
- KPIs no topo, visíveis imediatamente.
- Alerta de estoque crítico como card prominente, não apenas número no KPI.
- Sem scroll necessário para ver o conteúdo principal.

**Tab Eventos** continua existindo, mas agora contém **apenas** a lista de eventos com filtros e cards — sem o dashboard embutido.

#### Impacto: Alto | Complexidade: Baixa

---

### Tela 3 — Eventos (lista)

#### Estado Atual
Chips de filtro + grid de cards (2 col) + botão "+ Novo Evento". Após scroll: dashboard (proposto para remoção conforme Tela 2).

#### Problemas
- Cards de evento mostram avatares dos vendedores como círculos de iniciais — em eventos com 8+ vendedores o display transborda sem indicação do total.
- O botão "+ Novo Evento" fica no canto superior direito do page-head mas em mobile some abaixo dos chips de filtro.
- Sem estado vazio visual quando não há eventos no filtro ativo.

#### Proposta V2
- **Chips de filtro mantidos** — funcionam bem.
- **Cards de evento**: limitar avatares a 3 + contador "+N" quando há mais (ex: "+5").
- **Botão "Novo Evento"**: em mobile, transformar em FAB (floating action button) fixo no canto inferior direito da tela — sempre acessível.
- **Estado vazio**: ilustração simples + texto contextual por filtro (ex: "Nenhum evento ativo no momento").
- **Hover dos cards**: adicionar background sutil além da borda colorida — `--surface2` no hover torna a interatividade mais óbvia.

#### Impacto: Médio | Complexidade: Baixa

---

### Tela 4 — Detalhe do Evento

#### Estado Atual
Breadcrumb de volta + ações (Editar/Finalizar/Excluir) + hero com badges + layout 2 colunas (info | mini-stats) + seção Materiais + seção Leads com gráfico + tabela.

#### Problemas
- Botão "Excluir" em vermelho visível ao lado de "Editar" e "Finalizar" — alta chance de clique acidental em mobile.
- Form inline de adição de material (3 campos numa linha) fica estreito demais em 360px.
- Tabela de leads sem busca, sem ordenação, sem paginação — com 50+ leads torna-se inutilizável.
- Gráfico de barras por vendedor e tabela de leads coexistem duplicando a informação de "quem captou o quê".

#### Proposta V2
- **Botão Excluir**: mover para dentro de um menu de "⋯ mais ações" — reduz risco de clique acidental.
- **Form de material**: em mobile, empilhar os 3 campos verticalmente em vez de forçá-los em linha.
- **Tabela de leads**: adicionar campo de busca por nome no topo da seção e ordenação por clique no header.
- **Gráfico vs Tabela**: manter o gráfico como visão primária; tornar a tabela colapsável/expansível com um toggle "Ver todos os leads" — reduz a carga visual inicial.
- **Mini-stats** (leads, materiais): tornar clicáveis — clicar em "Leads: 12" rola a página até a seção de leads.

#### Impacto: Médio | Complexidade: Baixa–Média

---

### Tela 5 — Estoque

#### Estado Atual
3 KPIs + grupos por nível (CRÍTICO / ATENÇÃO / OK) com borda lateral colorida + rows com totais.

#### Problemas
- "Total Itens" e "Em Campo" nos KPIs têm semântica ambígua — "Em Campo" significa quantidade alocada a eventos, mas não é óbvio.
- Grupos CRÍTICO e ATENÇÃO não mostram "qual evento consumiu o quê" — o marketing não sabe onde está o material.
- Borda lateral colorida é o único indicador de nível — em light mode e em impressões pode se perder.

#### Proposta V2
- **KPI "Em Campo"**: renomear para "Alocado em Eventos" com tooltip/info icon explicativo.
- **Rows de material**: adicionar link discreto "Ver alocações" que expande uma lista dos eventos que têm aquele material — visibilidade sem mudar o layout principal.
- **Borda + ícone**: adicionar ícone de nível (⚠ para ATENÇÃO, 🚨 para CRÍTICO) além da borda colorida — redundância visual acessível.
- **Botão "Adicionar Material"**: em mobile, transformar em FAB consistente com o padrão da tab Eventos.

#### Impacto: Médio | Complexidade: Baixa

---

### Tela 6 — Leads (exportação)

#### Estado Atual
Dois botões de exportação + tabela de seleção de eventos (checkbox + nome + status + datas).

#### Problema Central
O nome "Leads" promete uma visão de leads. A tela entrega apenas exportação. Isso cria expectativa errada na navegação.

#### Proposta V2 — Opção A (conservadora, recomendada)
**Renomear a tab para "Exportar"** ou **"Relatórios"** — alinha o nome à função real. Nenhuma mudança de layout ou funcionalidade.

#### Proposta V2 — Opção B (mais valor, mais esforço)
Adicionar acima da tabela de seleção um bloco de **resumo rápido** (somente leitura):
- Total de leads capturados (todos os eventos)
- Distribuição por temperatura (4 badges com contagem)
- Serviço mais demandado

Esses dados já existem no estado global — é apenas apresentação. Sem nova lógica de negócio.

**Recomendação:** Opção A no curto prazo. Opção B como melhoria futura.

#### Impacto: Médio (Opção A) | Complexidade: Baixíssima (Opção A)

---

### Tela 7 — Equipe

#### Estado Atual
Dois modos: local (EquipeTab) com cards de vendedor + mini gráfico; Supabase (EquipeAuthTab) com seções Admin/Vendas + form de criação inline.

#### Problemas
- Mini gráfico de barras nos cards de vendedor (últimos 3 eventos) é muito pequeno para ser útil — ocupa espaço visual sem entregar informação clara.
- Form de criação inline no EquipeAuthTab fica no final da lista — em equipes maiores fica longe do topo da página.
- "Ativar/Desativar" e "Excluir" ficam no mesmo nível visual — ações de impactos muito diferentes.

#### Proposta V2
- **Mini gráfico**: substituir por números diretos "Últimos 3 eventos: 12 / 8 / 15 leads" em mono — mais legível, mesma informação.
- **Form de criação**: fixar no topo da seção (antes da lista) ou em um modal consistente com o restante do app.
- **Hierarquia de ações**: destacar "Desativar" como ação secundária e "Excluir" como ação destrutiva dentro do menu "⋯" — padrão já proposto para EventDetail.

#### Impacto: Baixo | Complexidade: Baixa

---

### Tela 8 — Check-in

#### Estado Atual
Card centralizado com select de evento + input de nome + botão buscar + resultados (3 estados: sem match / parcial / exato).

#### Problemas
- Não há indicação visual de que o evento selecionado precisa estar "ativo" para o check-in ser válido — usuários selecionam eventos encerrados e se confundem.
- O resultado "sem match" apenas mostra erro — não sugere ação (ex: "Este CPF não está cadastrado. Deseja adicionar como lead?").
- O campo é de "nome" mas a documentação menciona busca por CPF — há inconsistência entre o que a UI diz e o que o sistema documenta.

#### Proposta V2
- **Select de evento**: mostrar apenas eventos com status "ativo" por padrão, com toggle "ver todos" para o marketing que precise consultar eventos encerrados.
- **Resultado sem match**: adicionar CTA sugestivo "Cadastrar como lead no evento X?" — não cria nada automaticamente, apenas navega para o form de registro.
- **Label do campo**: clarificar "Buscar por nome ou CPF" — reflete a capacidade real do sistema.

#### Impacto: Médio | Complexidade: Baixa

---

### Tela 9 — Monitor

#### Estado Atual
Header com seletor de dia + stats + toolbar de sessão + cards de vendedores + feed filtrável com 9 tipos de eventos.

#### Problemas
- **É uma aba de diagnóstico técnico avançado** tratada com o mesmo peso visual de Eventos, Estoque, etc. No uso diário do marketing, é menos acessada.
- Feed com 9 tipos de eventos e múltiplos filtros exige aprendizado — usuário novo não sabe o que está vendo.
- Cards de vendedor duplicam algumas informações que já aparecem na tab Equipe.
- Toolbar de sessão (▶/■/Limpar) tem lógica condicional (só aparece hoje) que não é óbvia.

#### Proposta V2
- **Posição na nav**: mover Monitor para a **última posição** do bottom nav — indicar que é uma aba avançada/auxiliar, não uma ação primária do workflow. No desktop, pode permanecer na navegação mas com separador visual antes dela.
- **Tooltip/label "avançado"** no hover da tab: "Diagnóstico da operação" — define expectativa.
- **Feed**: adicionar texto explicativo fixo no topo quando filtro está em "Todos" e não há sessão ativa: "Inicie uma sessão para monitorar a operação em tempo real."
- **Cards de vendedor**: simplificar para nome + status dot + leads da sessão — remover duplicação com a tab Equipe.
- **Toolbar de sessão**: destacar visualmente quando não há sessão ativa (CTA mais proeminente) e reduzir quando sessão está rodando (botão ■ discreto).

#### Impacto: Médio | Complexidade: Baixa

---

### Tela 10 — Registrar Lead (Vendedor)

#### Estado Atual
Meta bar + modo rápido toggle + form (Nome, Telefone, CPF, Endereço) + segmented de serviços + temperature selector + chips de observação + botão salvar + toast.

#### Problema Central
Em campo, o vendedor aborda um cliente que tem 30 segundos de atenção. O sistema precisa ser operado com uma mão, em ambiente de barulho e luz solar. Cada campo extra é atrito.

**Pergunta da fase 3:** "O que poderia desaparecer desta tela sem prejudicar a operação?"
- **CPF**: opcional mesmo no form atual. Pode ir para edição posterior. ✓ pode sumir no modo rápido.
- **Endereço**: raramente crítico no momento da captura. ✓ pode sumir no modo rápido.
- **Chips de observação**: úteis mas não bloqueantes. ✓ podem sumir no modo rápido.
- **O que NÃO pode sumir**: Nome, Telefone, Serviço de interesse, Temperatura.

O modo rápido já existe — mas ainda mostra todos os campos com labels completos, áreas de toque pequenas e temperatura como grid de 4 botões com texto.

#### Proposta V2

**Modo Rápido V2 (padrão ao abrir a tab):**
```
┌─────────────────────────────────────────┐
│ 🥉 12 leads · Bronze · faltam 8        │  ← Meta bar simplificada (1 linha)
├─────────────────────────────────────────┤
│ Nome completo                           │  ← Input grande, 52px height
│ _____________________________________ │
│ Telefone                                │  ← Input grande com máscara
│ _____________________________________ │
│                                         │
│  📶 Fibra Casa  🏢 Fibra Emp  📱 Móvel │  ← 3 botões grandes (48px height)
│  📺 TV          📦 Outro               │  ← 2 botões grandes
│                                         │
│  ❄ Frio   🌡 Morno   🔥 Quente  ✅    │  ← 4 botões grandes (temperatura)
│                                         │
│ [ REGISTRAR LEAD ]                      │  ← Botão 56px, cor de destaque
└─────────────────────────────────────────┘
```

**Modo Completo** (acessado via toggle): adiciona CPF, Endereço, Observações.

**Mudanças específicas:**
- Input height: 48px → **52px** (área de toque segura).
- Botão de serviço: 40px → **48px** (toque seguro).
- Temperature buttons: adicionar emoji como reforço visual além da cor e texto.
- Meta bar: compactar para 1 linha sempre visível — não colapsar em mobile.
- Botão "REGISTRAR LEAD": **56px height**, fonte 16px bold, largura total — impossível de errar.
- Toast de confirmação: exibir nome do lead registrado ("Lead João Silva salvo ✓") — confirma que o dado certo foi gravado.

#### Impacto: Alto | Complexidade: Baixa

---

### Tela 11 — Meus Leads (Vendedor)

#### Estado Atual
Lista de cards com temperatura (clique para ciclar), botões de contato (ligar/WhatsApp), edição inline, delete em 2 passos.

#### Problemas
- Ciclar temperatura com tap único pode ser acionado acidentalmente ao rolar a lista.
- Botões "Ligar" e "WhatsApp" em azul e verde com texto "Ligar" e "WhatsApp" — funcionam, mas competem visualmente com o card.
- Sem busca ou filtro — em 50+ leads a lista é inutilizável sem scroll infinito.

#### Proposta V2
- **Ciclo de temperatura**: substituir tap único por **long press** (300ms) ou um botão explícito "alterar status" na edição inline — evita alteração acidental.
- **Alternativa mais simples**: manter tap único mas adicionar tooltip/mini confirmação ("Temperatura alterada para Quente ✓" inline por 1.5s).
- **Botões de contato**: reduzir para ícones apenas (📞 e 💬) com tamanho 44px — libera espaço horizontal.
- **Busca**: adicionar input de filtro por nome no topo da lista — simples, sem nova lógica, apenas `filter()` no array local.

#### Impacto: Médio | Complexidade: Baixa

---

### Tela 12 — Evento (Vendedor)

#### Estado Atual
Card de info do evento (nome, local, datas, tipo, totais) + link Maps + ranking com barras animadas + medalhas.

#### Problemas
- Esta tela é principalmente consulta — o vendedor abre para ver o ranking e volta. É funcional.
- Link Maps não tem indicação visual de que é externo/abre outro app.
- Ranking em barras pode não ser legível em telas pequenas para equipes com nomes longos.

#### Proposta V2
- **Link Maps**: adicionar ícone de "abrir externamente" (seta saindo de caixa) — expectativa correta.
- **Ranking**: truncar nomes longos com `text-overflow: ellipsis` e exibir nome completo no tap — sem perder informação.
- **Posição do usuário logado**: destacar o card da posição atual do vendedor com borda da cor de marca — "você está em 3º lugar" de forma imediata.
- Nenhuma mudança estrutural necessária.

#### Impacto: Baixo | Complexidade: Baixa

---

### Tela 13 — Pacotes (Vendedor)

#### Estado Atual
Tab permanente no bottom nav com tabela de preços hardcoded (Fibra / TV / Móvel / Apps).

#### Problema Central
Ocupa um dos 4 slots do bottom nav com conteúdo raramente consultado após o período de adaptação. Em campo, o vendedor precisa de velocidade — um slot do nav deveria ter uma ação de alto valor.

**Pergunta da fase 3:** "Se o usuário estivesse em um evento movimentado e precisasse agir em poucos segundos, o que poderia desaparecer desta tela?"
→ A tab inteira. O conteúdo pode ser acessado via um link/botão secundário na tab Registrar ou Evento.

#### Proposta V2
- **Remover do bottom nav principal**.
- **Acessar via**: botão "Ver preços" no card da tab Evento (onde o vendedor já consulta info do evento) que abre um modal ou expande uma seção de preços.
- **Bottom nav do Vendedor V2** (3 tabs + ação):

| Posição | Tab |
|---------|-----|
| 1 | Registrar |
| 2 | Meus Leads |
| 3 | Evento |
| (modal) | Pacotes — acessado via botão dentro de Evento |

Isso libera o nav para as 3 ações reais do fluxo de campo.

#### Impacto: Médio | Complexidade: Baixa

---

## Melhorias Mobile

### App de Marketing (mobile)
1. **FAB para criação** (Novo Evento / Adicionar Material) — substituir botão no header por floating action button fixo.
2. **Reordenar bottom nav**: Início / Eventos / Estoque / Equipe / [⋯ mais] — Check-in e Monitor acessíveis via menu "mais".
3. **Tabelas com indicador de scroll horizontal**: seta → ou gradiente nas bordas quando há overflow.
4. **Modais como bottom sheets em mobile** — deslizar de baixo para cima, height 85vh, handle bar no topo.

### App do Vendedor (mobile)
1. **Min-height 52px em todos os inputs** — área de toque segura, especialmente com luvas ou em campo.
2. **Bottom nav reduzido a 3 tabs** — Registrar / Meus Leads / Evento.
3. **Pacotes via modal** a partir da tab Evento.
4. **Toast de sucesso com nome do lead** — confirmação visual clara em ambiente de distração.
5. **Swipe-to-delete em Meus Leads** (com confirmação) — gesto natural em mobile, elimina tap duplo.

---

## Melhorias Desktop

### App de Marketing (desktop)
1. **Sidebar opcional como alternativa ao header nav** — em telas > 1200px, sidebar vertical economiza espaço horizontal e escala melhor com 6+ abas.
2. **Layout 3 colunas no Dashboard** — KPIs / Gráfico / Próximos Eventos na mesma linha, sem scroll.
3. **EventDetail com layout mais largo** — na tela cheia a coluna de info fica estreita demais; alargar para 3 colunas em > 1200px.
4. **Tabelas com mais linhas visíveis** — em desktop o max-height das tabelas pode ser maior (ou removido) sem prejudicar a experiência.

---

## Melhorias Dark Mode

### Problemas e correções

| Problema | Atual | Proposta V2 |
|---------|-------|-------------|
| Fundo principal quase preto | `#0f0f0f` | `#111111` — mais neutro, melhor em LCD |
| Bordas invisíveis | `#2e2e2e` sobre `#1a1a1a` | `#333333` sobre `#1a1a1a` — contraste 1.6:1 |
| `--text-3` falha AA | `#666666` | `#777777` — contraste 3.5:1 em `#111111` |
| Hover de card apenas borda | border-color yellow | border-color yellow + background `rgba(245,192,0,0.04)` |
| Estados de erro pouco visíveis | `#ef4444` texto | `#ef4444` texto + background `rgba(239,68,68,0.08)` |

### Manter
- Paleta geral dark — bem executada.
- `--rj-blue: #f5c000` como cor de ação — alto contraste, identidade forte.
- `--surface: #1a1a1a` e `--surface2: #222222` como camadas — hierarquia clara.

---

## Melhorias Light Mode

O light mode atual parece uma inversão automática das variáveis dark. Precisa de tratamento deliberado.

### Problemas e correções

| Elemento | Problema em Light | Proposta V2 |
|----------|------------------|-------------|
| Cards | Sem elevação visual (sem sombra) | `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` |
| `--rj-blue` (#f5c000) como background de botão | Texto sobre amarelo tem contraste ruim | Manter amarelo como borda/acento; background de botão primário em `#1a1a1a` com texto branco |
| Fundo de página | Branco puro `#ffffff` — cansa a vista | `#f7f7f7` — off-white mais descansado |
| Labels de form | `--text-3` pode falhar contraste | `#555555` mínimo em light |
| Tabela header | Quase invisível | `#ebebeb` como background do `th` |

### Design de botão primário em light mode
No dark mode, `btn-primary` tem background `--rj-blue` (#f5c000) com texto preto — funciona bem.
No light mode, o mesmo botão em amarelo sobre fundo claro perde força.

**Proposta:** Em light mode, `btn-primary` usa `background: #111111; color: #ffffff` — mais profissional e melhor contraste. O amarelo permanece como cor de **acento/hover/bordas**, não como fill principal em light.

---

## Evolução do Design System

### Escala Tipográfica (de 10 para 5 tamanhos)

| Nome | Tamanho | Uso |
|------|---------|-----|
| `text-xs` | 11px | Labels de tabela, captions, uppercase secundário |
| `text-sm` | 13px | Body secundário, badges, descrições |
| `text-base` | 15px | Body principal, inputs, botões |
| `text-lg` | 18px | Títulos de seção, card headings |
| `text-xl` | 22px | Títulos de página |
| `text-display` | 28px | KPIs, números grandes |

Eliminar: 10px, 12px, 14px, 16px, 26px como tamanhos independentes — absorver nos 5 definidos.

### Escala de Espaçamento Padronizada

Adotar múltiplos de 4:

| Token | Valor | Uso típico |
|-------|-------|-----------|
| `space-1` | 4px | Gaps internos apertados |
| `space-2` | 8px | Gaps padrão entre elementos inline |
| `space-3` | 12px | Padding de badges, chips |
| `space-4` | 16px | Padding de cards, gap de grid |
| `space-5` | 20px | Margens entre seções menores |
| `space-6` | 24px | Margens entre seções |
| `space-8` | 32px | Separação de blocos maiores |

### Padronização de Cards

**Card padrão V2:**
```css
border-radius: 12px;          /* mantido */
padding: 16px;                 /* padronizado — atual varia 12–20px */
border: 1px solid var(--border);
background: var(--surface);
```

**Card interativo** (clicável/hover):
```css
/* + */
cursor: pointer;
transition: border-color .15s ease, background .15s ease;
```
```css
/* hover: */
border-color: var(--rj-blue);
background: rgba(245,192,0,0.04); /* tint sutil */
```

### Hierarquia de Botões

| Hierarquia | Classe | Uso |
|-----------|--------|-----|
| Primário | `.btn-primary` | Ação principal da tela (1 por tela) |
| Secundário | `.btn-secondary` | Ações secundárias (cancelar, voltar) |
| Destrutivo | `.btn-danger` | Ações irreversíveis (excluir, finalizar) |
| Ghost | `.btn-ghost` | Ações terciárias, links de ação |

Eliminar `.btn-check-devolucao` como classe isolada — absorver em `.btn-secondary` com modificador de cor verde quando necessário.

### Menu de Ações "⋯"

Introduzir um padrão consistente de **"overflow menu"** para ações destrutivas ou raras:
- Aparece como botão `⋯` (3 pontos) no canto do card.
- Abre dropdown inline com as ações: Editar / Desativar / Excluir.
- Excluir sempre em vermelho com ícone de lixeira.
- Aplicar em: cards de evento, cards de vendedor, EventDetail.

---

## Componentes Reutilizados (sem alteração)

Os seguintes componentes funcionam bem e devem ser mantidos sem mudanças estruturais:

| Componente | Status V2 |
|-----------|-----------|
| `Icon` (sistema de ícones SVG) | Manter — extensível e consistente |
| `StatusBadge` / `TipoBadge` | Manter — bem executados |
| `SyncBadge` | Manter — funcional, discreto |
| `ChartView` (Chart.js wrapper) | Manter — não trocar por nova lib |
| Toast com Undo | Manter — padrão correto |
| Confirmação em 2 passos para delete | Manter — seguro e não-intrusivo |
| Máscaras de CPF/Telefone | Manter — funcionam bem |
| Retry com backoff | Não visível ao usuário, manter |

---

## Componentes Novos Necessários

| Componente | Descrição | Usado em |
|-----------|-----------|---------|
| `FAB` (Floating Action Button) | Botão de ação primária flutuante para mobile | Eventos, Estoque |
| `OverflowMenu` | Dropdown "⋯" para ações secundárias/destrutivas | Cards de evento, vendedor |
| `BottomSheet` | Modal que sobe de baixo em mobile (substitui modal centralizado) | EventModal, MaterialModal em mobile |
| `EmptyState` | Componente de estado vazio com ícone + mensagem contextual | EventosTab, LeadsTab, Meus Leads |
| `SearchInput` | Input de busca com ícone e botão clear — padronizado | Meus Leads, EventDetail leads |
| `TableScrollHint` | Indicador visual de scroll horizontal em tabelas | Todas as tabelas em mobile |

Todos são componentes simples de apresentação — sem lógica de negócio nova.

---

## Impacto x Esforço

```
ALTO IMPACTO
│
│  [1] Dashboard próprio    [10] Registrar V2
│  [4] Corrigir text-3     [11] Meus Leads busca
│  [11] aria-labels         [13] Remover Pacotes nav
│
│  [3] Área de toque 48px  [8] Skeleton loading
│  [6] Scroll hint tabelas  [9] Reordenar bottom nav
│  [5] Pacotes como modal   [2] Escala tipográfica
│
│  [7] Padding cards        [12] Hover cards
│  [login] Toggle tema      [12] EventDetail menu ⋯
│
BAIXO IMPACTO
└────────────────────────────────────────────────
   BAIXO ESFORÇO              ALTO ESFORÇO
```

**Zona de máximo retorno** (alto impacto + baixo esforço):
- [1] Dashboard como tab própria
- [4] Corrigir contraste text-3
- [11] aria-labels em botões de ícone
- [10] Registrar Lead com inputs maiores
- [13] Pacotes fora do bottom nav

---

## Roadmap de Implementação

Dividido em 3 fases ordenadas por valor entregue e reversibilidade:

### Fase A — Correções sem risco (1–2 dias)
> Mudanças CSS puras. Reversão: 1 linha de git revert.

1. Corrigir `--text-3` para `#777777` (dark) e `#555555` (light)
2. Ajustar fundo dark para `#111111`
3. Adicionar `box-shadow` leve nos cards em light mode
4. Padronizar padding de cards para `16px`
5. Adicionar `aria-label` nos botões de ícone (fechar, clear, toggle tema)
6. Aumentar min-height dos inputs do Vendedor para 52px
7. Mover toggle de tema do login para canto superior direito
8. Adicionar `text-overflow: ellipsis` no ranking do Vendedor

### Fase B — Reorganização visual (3–5 dias)
> Mudanças em JSX e CSS. Cada item é independente e reversível.

9. Promover Dashboard para primeira tab (mover componente, ajustar nav)
10. Remover Dashboard do rodapé do EventosTab
11. Substituir mini gráfico de vendedor por números diretos em EquipeTab
12. Adicionar FAB para "Novo Evento" e "Adicionar Material" em mobile
13. Implementar `EmptyState` nos tabs que ficam vazios
14. Adicionar busca por nome em Meus Leads
15. Reordenar bottom nav do marketing (Início primeiro)
16. Mover Pacotes para modal dentro da tab Evento

### Fase C — Novos componentes (1 semana)
> Implementação de componentes novos. Maior esforço, maior impacto.

17. `OverflowMenu` para ações destrutivas em cards
18. `BottomSheet` para modais em mobile
19. `SearchInput` padronizado (busca em EventDetail e Meus Leads)
20. `TableScrollHint` nas tabelas com overflow horizontal
21. Adicionar busca/filtro na tabela de leads do EventDetail
22. Destaque da posição do vendedor logado no ranking

---

## Plano de Rollback

Cada fase tem estratégia de rollback independente:

| Fase | Estratégia | Tempo de rollback |
|------|-----------|------------------|
| A | `git revert <commit>` — CSS puro | < 5 minutos |
| B | `git revert <commit(s)>` — componentes independentes | < 15 minutos |
| C | Feature flag por componente ou `git revert` por PR | < 30 minutos |

**Regra:** cada item do roadmap deve ter seu próprio commit atômico. Nenhum item deve depender de outro não mergeado para funcionar. Isso garante rollback cirúrgico.

**Baseline preservada:** `doc/ui/UI_VERSIONS.md` documenta a V1 completa. A qualquer momento é possível restaurar o estado exato da V1 via `git log`.

---

## Comparativo V1 vs V2

| Aspecto | V1 | V2 |
|---------|----|----|
| Tabs de marketing | 6 (Eventos, Estoque, Leads, Equipe, Check-in, Monitor) | 6 reorganizadas (Início, Eventos, Estoque, Leads/Relatórios, Equipe, [Monitor recuado]) |
| Tabs do vendedor | 4 (Registrar, Meus Leads, Evento, Pacotes) | 3 no nav + Pacotes em modal |
| Dashboard | Embutido em Eventos, acessado via scroll | Tab própria "Início", visível imediatamente |
| Tamanhos de fonte | 10 tamanhos sem escala formal | 5 tamanhos com escala definida |
| Área de toque (Vendedor) | ~40px | 52px mínimo |
| Contraste text-3 | 3.0:1 (falha AA) | 3.5:1 (margem de segurança) |
| Cards em light mode | Sem elevação visual | Sombra sutil 1px |
| Ações destrutivas | Visíveis no card principal | Dentro de menu ⋯ |
| Pacotes (Vendedor) | Tab permanente no nav | Modal acessado via tab Evento |
| Estado vazio | Ausente | Componente `EmptyState` contextual |
| Scroll em tabelas | Sem indicação visual | `TableScrollHint` com gradiente |
| `aria-label` em ícones | Ausente | Presente em todos os botões de ícone |

---

## Recomendação Final

**Implementar a V2 em fases, começando pela Fase A.**

A Fase A entrega o maior custo-benefício: corrige os problemas de contraste, aumenta a acessibilidade, melhora a experiência do vendedor em campo e refina o dark mode — tudo em mudanças CSS reversíveis em minutos.

A Fase B entrega a reorganização de maior impacto estratégico: o Dashboard como tab própria. É a mudança que muda a percepção do produto — de uma ferramenta de lista de eventos para um painel de operação.

A Fase C entrega polish e completude — importante, mas pode aguardar validação das fases anteriores.

**O que NÃO fazer:**
- Não trocar a biblioteca de gráficos (Chart.js está funcionando, D3 seria regressão de valor).
- Não adicionar animações complexas (Spring, Framer Motion) — o app roda em campo, em redes lentas, em dispositivos modestos.
- Não refatorar a arquitetura de estado — os problemas são visuais, não de dados.
- Não mudar fluxos de negócio — o que o sistema faz está correto; como mostra que precisa melhorar.

**Princípio guia da V2:**
> Cada mudança deve ou reduzir o tempo de uma ação comum, ou aumentar a clareza de uma informação importante, ou reduzir o risco de um erro. Se não faz nenhum dos três, não entra na V2.

---

*Documento gerado em 2026-06-18. Nenhum código foi alterado. Aguardando aprovação para iniciar `UX_UI_V2_IMPLEMENTATION_PLAN.md`.*
