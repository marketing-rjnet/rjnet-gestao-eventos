# DOCUMENTO MESTRE — REFATORAÇÃO DO CRM DE EVENTOS RJNET

## Objetivo Geral

Refatorar progressivamente o `src/main.jsx` (~2.354 linhas) sem alterar comportamento, apenas reorganizando a arquitetura em módulos coesos.

## Regras Obrigatórias

- Nenhuma funcionalidade pode mudar.
- Nenhuma regra de negócio pode ser alterada.
- Nenhuma melhoria funcional deve ser implementada durante a refatoração.
- Apenas mover código para módulos mais organizados.
- Cada etapa deve gerar um commit independente.
- Após cada etapa executar validações.
- Se houver risco de quebra, parar e informar antes de prosseguir.
- Sempre analisar o código atual antes de executar a próxima etapa.
- Nunca assumir que a estrutura ainda está igual ao plano original.
- Considerar apenas o estado atual do projeto.

---

## STATUS DA REFATORAÇÃO

```
Progresso geral: 17/18 etapas concluídas (94%)
Arquivo principal: src/main.jsx — atual: ~35 linhas — meta: < 100 linhas ao fim ✅
```

### Histórico de Execução

```
Etapas 1–4 executadas em 15/06/2026.
  Arquivos criados: src/utils/format.js, src/utils/masks.js,
  src/utils/csv.js, src/utils/mockData.js.
  Pacotes (etapa 4b) mantidos no JSX — dados acoplados à renderização.

Etapa 5 executada em 15/06/2026.
  Adicionados a src/lib/constants.js: SYNC_STATUS, STATUS_EVENTO,
  NIVEL_ESTOQUE, RANKING_DEBOUNCE_MS, RANKING_POLL_MS,
  UPCOMING_EVENTS_LIMIT, AVATARS_SHOWN, RECENT_EVENTS_SHOWN, CHART_CUTOUT.
  Substituídos todos os magic strings/numbers correspondentes em main.jsx.
  Nenhuma funcionalidade alterada.

Etapa 6 executada em 15/06/2026.
  Criado src/components/ui.jsx com: Icon, StatusBadge, TipoBadge, Kpi,
  ChartView. Removidas definições correspondentes de main.jsx e adicionado
  import. SyncBadge reservado para Etapa 7 conforme plano.
  Build passou sem erros.

Etapa 7 executada em 15/06/2026.
  Criado src/hooks/useApp.js: wrapper useContext(AppContext).
  Criado src/components/SyncBadge.jsx: componente de indicador de sync.
  AppContext exportado de main.jsx (import temporário resolvido pelo Vite).
  useApp e SyncBadge removidos de main.jsx. useContext removido do import React.
  Build passou sem erros.

Etapa 8 executada em 15/06/2026.
  Criado src/auth/Login.jsx: formulário de login modo legado.
  Criado src/auth/LoginAuth.jsx: formulário de login Supabase com recuperação de senha.
  Criado src/auth/NovaSenha.jsx: formulário de redefinição de senha por link.
  Criado src/auth/RootAuth.jsx: roteador de autenticação modo Supabase.
  Criado src/auth/RootLegacy.jsx: roteador de autenticação modo legado.
  Criado src/auth/index.js: re-exports de todos os componentes de auth.
  usePersisted exportado de main.jsx para que RootLegacy possa importar (temporário até Etapa 15).
  MarketingApp e VendedorApp passados como props para RootAuth e RootLegacy (ainda definidos em main.jsx).
  _mktUser, _mktPass e AUTH removidos de main.jsx; movidos para src/auth/Login.jsx.
  Login, LoginAuth, NovaSenha, RootAuth, RootLegacy removidos de main.jsx (~235 linhas).
  main.jsx reduzido para ~2.021 linhas.
  Build passou sem erros.
  Nota: etapa documentada antes da execução; código real executado em 15/06/2026 na mesma sessão da etapa 9.

Etapa 9 executada em 15/06/2026.
  Criado src/components/modals/EventModal.jsx: modal de criação/edição de evento.
  Criado src/components/modals/MaterialModal.jsx: modal de criação de material.
  Criado src/components/modals/index.js: re-exports dos modais.
  EventModal e MaterialModal removidos de main.jsx (~135 linhas).
  sanitize() nos modais convertida para sanitizeText() diretamente (sem alias local).
  main.jsx reduzido para ~1.884 linhas.
  Build passou sem erros.

Etapa 10 executada em 15/06/2026.
  Criado src/features/events/Dashboard.jsx: KPIs, gráfico donut de leads por serviço, próximos eventos.
  Criado src/features/events/EventosTab.jsx: lista de eventos com filtros de status e cards.
  Criado src/features/events/EventDetail.jsx: detalhe do evento, gestão de materiais e leads por vendedor.
  Criado src/features/events/index.js: re-exports dos três componentes.
  Dashboard, EventosTab e EventDetail removidos de main.jsx (~350 linhas).
  darkScale mantida em main.jsx (ainda usada por LeadsTab que não foi extraído nesta etapa).
  CHART_COLORS movido para Dashboard.jsx (não mais necessário em main.jsx).
  Imports não utilizados removidos de main.jsx: fmtDateLong, tipoLabel, CHART_CUTOUT, UPCOMING_EVENTS_LIMIT, AVATARS_SHOWN.
  Build passou sem erros (85 módulos transformados).

Etapa 11 executada em 15/06/2026.
  Criado src/features/inventory/EstoqueTab.jsx: listagem de materiais por nível de estoque.
  Criado src/features/inventory/index.js: re-export de EstoqueTab.
  Criado src/features/leads/LeadsTab.jsx: filtros, gráfico e tabela de leads, exportação CSV.
  Criado src/features/leads/index.js: re-export de LeadsTab.
  Criado src/features/checkin/CheckinTab.jsx: busca de lead por CPF em evento.
  Criado src/features/checkin/index.js: re-export de CheckinTab.
  EstoqueTab, LeadsTab e CheckinTab removidos de main.jsx (~348 linhas).
  darkScale movida para LeadsTab.jsx (não mais necessária em main.jsx).
  TEMPERATURA_CONFIG duplicada localmente em CheckinTab.jsx (main.jsx ainda precisa para VendedorApp).
  Imports removidos de main.jsx: NIVEL_ESTOQUE (constants), exportLeadsCSV (csv).
  Build passou sem erros (91 módulos transformados).

Etapa 12 executada em 15/06/2026.
  Criado src/features/team/EquipeTab.jsx: gestão de vendedores no modo local.
  Criado src/features/team/EquipeAuthTab.jsx: gestão de usuários com RBAC no modo Supabase Auth.
  Criado src/features/team/index.js: re-exports dos dois componentes.
  EquipeTab e EquipeAuthTab removidos de main.jsx (~247 linhas).
  sanitize() convertida para sanitizeText() diretamente nos novos arquivos.
  Imports não mais usados removidos de main.jsx: RECENT_EVENTS_SHOWN (constants), fmtDate e initials (format).
  Build passou sem erros (94 módulos transformados).

Etapa 13 executada em 15/06/2026.
  Criado src/apps/VendedorApp.jsx: shell completo do vendedor com LeadEditInline embutido.
  LeadEditInline e VendedorApp removidos de main.jsx (~580 linhas).
  TEMPERATURA_CONFIG e OBS_ATALHOS definidos localmente em VendedorApp.jsx (removidos de main.jsx).
  sanitize() convertida para sanitizeText() diretamente em VendedorApp.jsx.
  Imports não mais usados removidos de main.jsx: sanitizeText (security), META_DIARIA, SENHA_MIN_LENGTH,
    MAX_NOME, MAX_ENDERECO, MAX_OBSERVACAO, TOAST_DURATION_MS, RANKING_DEBOUNCE_MS, RANKING_POLL_MS (constants),
    SERVICO_LABEL, TIPO_LABEL, STATUS_LABEL, servicoLabel (format), validarCpf, validarTelefone, maskCpf, maskTel
    (masks), StatusBadge, TipoBadge, Kpi, ChartView (ui), useApp (hooks), EventModal, MaterialModal (modals).
  main.jsx reduzido para ~360 linhas.
  Build passou sem erros (95 módulos transformados).

Etapa 14 executada em 15/06/2026.
  Criado src/apps/MarketingApp.jsx: shell do usuário marketing com navegação por tabs,
    dark mode toggle, SyncBadge e roteamento condicional de EquipeTab/EquipeAuthTab.
  Criado src/apps/Root.jsx: componente raiz com persistência de dark mode e detecção
    de modo (Supabase vs legado) via supabaseEnabled, delegando para RootAuth ou RootLegacy.
  MarketingApp e Root removidos de main.jsx (~85 linhas).
  Imports não mais usados removidos de main.jsx: Icon (ui), SyncBadge (components),
    RootAuth/RootLegacy (auth), Dashboard/EventosTab/EventDetail (features/events),
    EstoqueTab (inventory), LeadsTab (leads), CheckinTab (checkin),
    EquipeTab/EquipeAuthTab (team), VendedorApp (apps).
  Import de Root adicionado de ./apps/Root.
  main.jsx reduzido para ~245 linhas.
  Build passou sem erros (97 módulos transformados).

Etapa 15 executada em 15/06/2026.
  Criado src/hooks/usePersisted.js: hook de sincronização de estado com localStorage/sessionStorage,
    extraído de main.jsx (~26 linhas). Já não mais exportado de main.jsx.
  Criado src/hooks/useRanking.js: hook de polling de ranking com debounce e cleanup automático,
    extraído do corpo de VendedorApp.jsx (~38 linhas).
  main.jsx atualizado: import de usePersisted de ./hooks/usePersisted; definição local removida.
  VendedorApp.jsx atualizado: bloco de ranking (3 useEffect + 2 useState + 2 useRef) substituído
    por { ranking, rankingLoading } = useRanking(eventoId, leads.length).
    Imports de RANKING_DEBOUNCE_MS e RANKING_POLL_MS removidos de VendedorApp.jsx.
    Import de obterRanking removido do destructuring de useApp().
  RootLegacy.jsx atualizado: import de usePersisted alterado de ../main para ../hooks/usePersisted
    (eliminando o último import circular temporário com main.jsx).
  main.jsx reduzido para ~220 linhas.
  Build passou sem erros (99 módulos transformados).

Etapa 16 executada em 15/06/2026.
  Criado src/context/AppContext.js: definição do createContext (3 linhas).
  Criado src/context/AppProvider.jsx: Provider completo com todo o estado da aplicação e ações
    de domínio, extraído de main.jsx (~170 linhas).
  Criado src/context/index.js: re-exports de AppContext e AppProvider.
  main.jsx atualizado: AppContext e AppProvider removidos; imports não mais usados eliminados
    (createContext, useEffect, useRef, useMemo, useState, supabaseEnabled, fetchAll/db/etc.,
    SYNC_STATUS/STATUS_EVENTO, MOCK_*, usePersisted). Adicionado import de ./context.
    main.jsx reduzido para ~35 linhas — apenas ErrorBoundary e ReactDOM.createRoot.
  src/hooks/useApp.js atualizado: import de AppContext corrigido de ../main para ../context/AppContext
    (elimina o último import circular com main.jsx).
  Build passou sem erros (102 módulos transformados).

Etapa 17 executada em 16/06/2026.
  Criado src/api/eventoApi.js: factory createEventoApi — patchEvento, addEvento, updateEvento, removeEvento.
  Criado src/api/leadApi.js: factory createLeadApi — addLead, updateLead, removeLead (com invalidarRanking).
  Criado src/api/materialApi.js: factory createMaterialApi — addMaterial, updateMaterial,
    addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento (recebe patchEvento como dep).
  Criado src/api/vendedorApi.js: factory createVendedorApi — addVendedor, updateVendedor, toggleVendedor.
  src/context/AppProvider.jsx atualizado: implementações CRUD inline removidas; factories chamadas no
    corpo do componente; useMemo recebe referências das funções criadas pelas factories.
    Import de db e invalidarRanking removidos de AppProvider (delegados às factories).
  Build passou sem erros (106 módulos transformados).
```

### Legenda de Status

| Símbolo | Significado    |
|---------|----------------|
| ✅       | Concluída      |
| 🔄       | Em andamento   |
| ⬜       | Não iniciada   |
| ✔️       | Validada       |

### Tabela de Progresso

```
Etapa 1  — Format Utils              ✅ Concluída
Etapa 2  — Masks e Validators        ✅ Concluída
Etapa 3  — CSV Utils                 ✅ Concluída
Etapa 4  — Mock Data e Pacotes       ✅ Concluída
Etapa 5  — Constants                 ✅ Concluída
Etapa 6  — UI Components             ✅ Concluída
Etapa 7  — SyncBadge + useApp        ✅ Concluída
Etapa 8  — Auth Components           ✅ Concluída
Etapa 9  — Modais                    ✅ Concluída
Etapa 10 — Dashboard + Eventos       ✅ Concluída
Etapa 11 — Estoque + Leads + Checkin ✅ Concluída
Etapa 12 — Equipe                    ✅ Concluída
Etapa 13 — VendedorApp               ✅ Concluída
Etapa 14 — App + Layout Shells       ✅ Concluída
Etapa 15 — Domain Hooks              ✅ Concluída
Etapa 16 — Infraestrutura            ✅ Concluída
Etapa 17 — APIs por Domínio          ✅ Concluída
Etapa 18 — Centralização Dual Mode   ⬜ Não iniciada
```

---

## Fluxo Obrigatório para Cada Etapa

### Antes de executar:

1. Ler o código atual das linhas indicadas neste documento.
2. Verificar se etapas anteriores realmente foram concluídas (checar imports e exports).
3. Confirmar dependências necessárias.
4. Identificar riscos.

### Depois:

1. Executar a etapa.
2. Mostrar arquivos criados.
3. Mostrar arquivos modificados.
4. Mostrar possíveis riscos.
5. Mostrar checklist de validação.
6. Informar próximo commit recomendado.

---

## Comandos

### Quando eu pedir: "Executar próxima etapa"

Você deve:

- Ler o status atual.
- Identificar a próxima etapa pendente (seção "Próxima Etapa Recomendada").
- Analisar o código atual nas linhas indicadas.
- Executar apenas essa etapa.
- Não avançar para etapas futuras.

### Quando eu pedir: "Auditar refatoração"

Você deve:

- Comparar o código atual com o plano.
- Informar quais etapas já foram concluídas.
- Informar quais ainda faltam.
- Identificar desvios.
- Identificar riscos técnicos.
- Atualizar o status.

### Quando eu pedir: "Atualizar documento mestre"

Você deve:

- Marcar etapas concluídas.
- Atualizar observações.
- Atualizar riscos encontrados.
- Atualizar progresso geral.

---

## Plano de Etapas

---

### Fase 1 — Utilitários Puros

---

## Etapa 1 — Format Utils

**Status: ✅ Concluída**

### Objetivo

Extrair funções de formatação de texto e label maps para um módulo utilitário independente, eliminando funções de apresentação espalhadas no JSX.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/format.js` | Funções de formatação de data, iniciais, e label maps de domínio |

**Exports de `src/utils/format.js`:**
- `SERVICO_LABEL` — mapa de código de serviço → label legível
- `TIPO_LABEL` — mapa de tipo de evento → label
- `STATUS_LABEL` — mapa de status → label
- `servicoLabel(code)` — retorna label de serviço
- `tipoLabel(code)` — retorna label de tipo
- `fmtDate(dateStr)` — formata data curta (DD/MM/AAAA)
- `fmtDateLong(dateStr)` — formata data longa (ex: "15 de junho de 2026")
- `initials(name)` — retorna iniciais do nome

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/main.jsx` | Removidas as funções acima; adicionado import de `src/utils/format.js` |

### Dependências afetadas

- Contextos: nenhum
- Hooks: nenhum
- Componentes que usam: `Dashboard`, `EventosTab`, `LeadsTab`, `VendedorApp`

### Critérios de conclusão

- `src/utils/format.js` existe e exporta todos os símbolos listados.
- `src/main.jsx` não contém mais as definições das funções extraídas.
- `src/main.jsx` importa de `src/utils/format.js`.
- Build sem erros.

### Checklist de validação

- [ ] Labels de serviço aparecem corretamente no dashboard
- [ ] Labels de tipo aparecem no filtro de eventos
- [ ] Datas formatadas corretamente na listagem de eventos
- [ ] Iniciais de vendedor exibidas corretamente no ranking

### Riscos conhecidos

- Nenhum — funções puras sem efeitos colaterais.

### Resultado esperado

- ~20 linhas removidas de `main.jsx`.
- `src/utils/format.js` com ~21 linhas.

---

## Etapa 2 — Masks e Validators

**Status: ✅ Concluída**

### Objetivo

Extrair funções de máscara de input e validação de CPF/telefone para módulo dedicado, centralizando regras de formatação de entrada do usuário.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/masks.js` | Máscaras de input (CPF, telefone) e validadores correspondentes |

**Exports de `src/utils/masks.js`:**
- `validarCpf(cpf)` — valida CPF com dígitos verificadores
- `validarTelefone(tel)` — valida telefone (8–9 dígitos)
- `maskCpf(value)` — aplica máscara XXX.XXX.XXX-XX
- `maskTel(value)` — aplica máscara (XX) XXXXX-XXXX

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/main.jsx` | Removidas as funções acima; adicionado import de `src/utils/masks.js` |

### Dependências afetadas

- Componentes que usam: formulário de lead em `VendedorApp`, `CheckinTab`

### Critérios de conclusão

- `src/utils/masks.js` existe e exporta todos os símbolos listados.
- `src/main.jsx` importa de `src/utils/masks.js`.
- Build sem erros.

### Checklist de validação

- [ ] Máscara de CPF aplicada ao digitar no formulário de lead
- [ ] Máscara de telefone aplicada ao digitar no formulário de lead
- [ ] Validação de CPF impede submit com CPF inválido
- [ ] Campo de checkin aceita CPF com máscara

### Riscos conhecidos

- Nenhum — funções puras sem efeitos colaterais.

### Resultado esperado

- ~35 linhas removidas de `main.jsx`.
- `src/utils/masks.js` com ~34 linhas.

---

## Etapa 3 — CSV Utils

**Status: ✅ Concluída**

### Objetivo

Extrair a função de exportação CSV para módulo utilitário, desacoplando a lógica de geração de arquivo da camada de UI.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/csv.js` | Função de exportação de leads para arquivo CSV com BOM UTF-8 |

**Exports de `src/utils/csv.js`:**
- `exportLeadsCSV(leads, eventos)` — gera e baixa arquivo CSV de leads filtrados

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/main.jsx` | Removida a função acima; adicionado import de `src/utils/csv.js` |

### Dependências afetadas

- Componentes que usam: `LeadsTab`

### Critérios de conclusão

- `src/utils/csv.js` existe e exporta `exportLeadsCSV`.
- `src/main.jsx` importa de `src/utils/csv.js`.
- Build sem erros.

### Checklist de validação

- [ ] Botão "Exportar CSV" em LeadsTab gera download do arquivo
- [ ] Arquivo CSV contém cabeçalho correto
- [ ] Encoding UTF-8 com BOM correto (acentos sem problemas)
- [ ] Filtros aplicados são refletidos no CSV exportado

### Riscos conhecidos

- Nenhum — função pura que opera sobre dados já carregados.

### Resultado esperado

- ~20 linhas removidas de `main.jsx`.
- `src/utils/csv.js` com ~20 linhas.

---

## Etapa 4 — Mock Data e Pacotes

**Status: ✅ Concluída**

### Objetivo

Extrair dados mock (usados no modo local/localStorage) para módulo separado. Os dados de pacotes de serviços foram mantidos em `main.jsx` por estarem acoplados à renderização.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/mockData.js` | Dados iniciais para modo local sem Supabase |

**Exports de `src/utils/mockData.js`:**
- `MOCK_MATERIAIS` — array com 12 materiais de exemplo
- `MOCK_VENDEDORES` — array com 6 vendedores de exemplo
- `MOCK_EVENTOS` — array com 2 eventos de exemplo
- `MOCK_LEADS` — array com 1 lead de exemplo

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/main.jsx` | Removidos os arrays de dados mock; adicionado import de `src/utils/mockData.js` |

### Dependências afetadas

- Contextos: `AppProvider` (usa os mocks como estado inicial no modo local)

### Notas de implementação

- Dados de pacotes de serviços (tabela de planos em `VendedorApp`) foram mantidos em `main.jsx` por estarem diretamente acoplados ao JSX de renderização.

### Critérios de conclusão

- `src/utils/mockData.js` existe e exporta todos os símbolos listados.
- `src/main.jsx` importa de `src/utils/mockData.js`.
- Build sem erros.

### Checklist de validação

- [ ] Modo local (sem Supabase) carrega dados de exemplo ao iniciar
- [ ] Lista de materiais pré-populada no modo local
- [ ] Lista de eventos pré-populada no modo local
- [ ] Lista de vendedores pré-populada no modo local

### Riscos conhecidos

- Nenhum — dados estáticos sem lógica.

### Resultado esperado

- ~60 linhas removidas de `main.jsx`.
- `src/utils/mockData.js` com ~57 linhas.

---

## Etapa 5 — Constants

**Status: ✅ Concluída**

### Objetivo

Centralizar todas as constantes de domínio, limites de validação e magic numbers em `src/lib/constants.js`, eliminando valores literais espalhados pelo JSX.

### Arquivos criados

Nenhum (arquivo já existia com algumas constantes).

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/constants.js` | Adicionadas novas constantes (ver lista abaixo) |
| `src/main.jsx` | Substituídos magic strings/numbers pelas constantes importadas |

**Constantes adicionadas a `src/lib/constants.js`:**
- `SYNC_STATUS` — enum `{ IDLE, SYNCING, ERROR }`
- `STATUS_EVENTO` — enum `{ PLANEJADO, ATIVO, ENCERRADO }`
- `NIVEL_ESTOQUE` — enum `{ CRIT, WARN, OK }`
- `RANKING_DEBOUNCE_MS` — 3000ms
- `RANKING_POLL_MS` — 60.000ms
- `UPCOMING_EVENTS_LIMIT` — 3
- `AVATARS_SHOWN` — 4
- `RECENT_EVENTS_SHOWN` — 5
- `CHART_CUTOUT` — `'62%'`

**Constantes já existentes em `src/lib/constants.js` (não alteradas):**
- `META_DIARIA`, `SENHA_MIN_LENGTH`, `MAX_NOME`, `MAX_ENDERECO`, `MAX_OBSERVACAO`, `MAX_LOCAL`, `MAX_DESCRICAO`
- `REALTIME_DEBOUNCE_MS`, `TOAST_DURATION_MS`

### Dependências afetadas

- Componentes que usam: `AppProvider`, `Dashboard`, `VendedorApp`, `EstoqueTab`

### Critérios de conclusão

- `src/lib/constants.js` contém todos os símbolos listados.
- `src/main.jsx` não contém os valores literais correspondentes.
- Build sem erros.

### Checklist de validação

- [ ] SyncBadge exibe estados corretos (idle/syncing/error)
- [ ] Filtro de status de evento funciona (planejado/ativo/encerrado)
- [ ] Alertas de estoque acionam nos níveis corretos
- [ ] Ranking do vendedor atualiza a cada 60 segundos
- [ ] Dashboard exibe no máximo 3 eventos futuros

### Riscos conhecidos

- Nenhum — substituição de literais por referências a constantes.

### Resultado esperado

- ~15 linhas removidas de `main.jsx`.
- `src/lib/constants.js` com ~29 linhas totais.

---

### Fase 2 — Componentes UI Atômicos

---

## Etapa 6 — UI Components

**Status: ✅ Concluída**

### Objetivo

Extrair componentes de UI genéricos (sem lógica de negócio) de `main.jsx` para módulo dedicado, criando uma biblioteca interna de UI reutilizável.

**Problema que resolve:** Componentes visuais atômicos misturados com lógica de negócio no mesmo arquivo de 2.354 linhas.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/components/ui.jsx` | `Icon`, `StatusBadge`, `TipoBadge`, `Kpi`, `ChartView` em arquivo único |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** definições de `Icon`, `ChartView`, `StatusBadge`, `TipoBadge`, `Kpi`. **Adicionado:** import de `./components/ui`. **Permanece:** toda a lógica de negócio, contexto e demais componentes. |

### Dependências afetadas

- **Hooks:** nenhum
- **Contextos:** nenhum — componentes puramente visuais
- **Serviços:** `ChartView` usa `Chart` de `chart.js` (manter import local)
- **Componentes que consomem `Icon`:** praticamente todos os tabs
- **Componentes que consomem `ChartView`:** `Dashboard`, `LeadsTab`
- **Componentes que consomem `StatusBadge`/`TipoBadge`:** `EventosTab`, `EventDetail`
- **Componentes que consomem `Kpi`:** `Dashboard`

### Notas de implementação

- `SyncBadge` foi mantido em `main.jsx` conforme plano — será extraído na Etapa 7.
- Todos os componentes foram agrupados em um único arquivo `ui.jsx` (em vez de arquivos separados).

### Critérios de conclusão

- `src/components/ui.jsx` existe e exporta todos os símbolos listados.
- `src/main.jsx` não contém mais as definições extraídas.
- `npm run build` sem erros.

### Checklist de validação

- [x] Ícones aparecem corretamente em toda a UI
- [x] Gráfico de leads no Dashboard renderiza e destrói sem memory leak
- [x] Gráfico de leads por evento em LeadsTab renderiza
- [x] Badges de status aparecem na lista de eventos
- [x] Badges de tipo aparecem na lista de eventos
- [x] Cards de KPI exibem valores corretos no Dashboard
- [x] Alerta visual no KPI de estoque crítico funciona

### Riscos conhecidos

- Nenhum remanescente — etapa concluída com sucesso.

### Resultado esperado

- ~100 linhas removidas de `main.jsx`.
- `src/components/ui.jsx` criado.

---

## Etapa 7 — SyncBadge + useApp

**Status: ✅ Concluída**

### Objetivo

Extrair o hook `useApp` e o componente `SyncBadge` de `main.jsx` para módulos próprios, tornando o hook de contexto importável por qualquer componente futuro sem depender de `main.jsx`.

**Problema que resolve:** `useApp` e `AppContext` definidos no mesmo arquivo que os consumidores, criando acoplamento circular.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/hooks/useApp.js` | Hook `useApp()` — thin wrapper de `useContext(AppContext)` |
| `src/components/SyncBadge.jsx` | Indicador visual de sincronização (usa `useApp`) |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** definição de `useApp` (linha ~115–119) e `SyncBadge` (linhas ~1758–1767). **Adicionado:** `import { useApp } from './hooks/useApp'` e `import SyncBadge from './components/SyncBadge'`. **Permanece:** `AppContext` e `AppProvider` ainda em `main.jsx` até Etapa 16. |

### Dependências afetadas

- **Contextos:** `AppContext` (ainda em `main.jsx` — será movido na Etapa 16)
- **Hooks:** `useApp` passará a importar `AppContext` de `main.jsx` temporariamente
- **Componentes que usam `useApp`:** `Dashboard`, `EventosTab`, `EstoqueTab`, `LeadsTab`, `EquipeTab`, `VendedorApp`, e `SyncBadge`
- **Componentes que usam `SyncBadge`:** `MarketingApp`, `VendedorApp`

### Notas de implementação

- `src/hooks/useApp.js` precisará importar `AppContext` de `../main` temporariamente. Isso será corrigido na Etapa 16 quando `AppContext` for movido para `src/context/`.
- Alternativa: mover `AppContext` já nesta etapa para `src/context/AppContext.js` (criando apenas a constante, sem o Provider). Avaliar custo-benefício antes de executar.

### Critérios de conclusão

- `src/hooks/useApp.js` existe e exporta `useApp`.
- `src/components/SyncBadge.jsx` existe.
- `src/main.jsx` não contém mais as definições extraídas.
- Todos os consumidores de `useApp` funcionam normalmente.
- Build sem erros.

### Checklist de validação

- [ ] Badge de sync aparece na barra superior do MarketingApp
- [ ] Badge de sync aparece na barra superior do VendedorApp
- [ ] Badge muda para "sincronizando" durante operações de escrita
- [ ] Badge volta ao estado idle após sync completo
- [ ] Badge exibe erro quando operação falha

### Riscos conhecidos

- Import circular temporário (`useApp.js` → `main.jsx` → componentes que importam `useApp.js`). Monitorar se o bundler (Vite) resolve sem problemas.

### Resultado esperado

- ~25 linhas removidas de `main.jsx`.
- 2 novos arquivos totalizando ~30 linhas.

---

### Fase 3 — Autenticação

---

## Etapa 8 — Auth Components

**Status: ✅ Concluída**

### Objetivo

Extrair todos os componentes e fluxos de autenticação de `main.jsx` para módulo dedicado, isolando a lógica de login/logout do resto da aplicação.

**Problema que resolve:** Lógica de autenticação (login, recuperação de senha, roteamento por modo) misturada com componentes de negócio.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/auth/Login.jsx` | Formulário de login legado (modo local sem Supabase) |
| `src/auth/LoginAuth.jsx` | Formulário de login Supabase com recuperação de senha |
| `src/auth/NovaSenha.jsx` | Formulário de redefinição de senha (via link de email) |
| `src/auth/RootAuth.jsx` | Roteador de autenticação para modo Supabase |
| `src/auth/RootLegacy.jsx` | Roteador de autenticação para modo legado |
| `src/auth/index.js` | Re-exporta todos os componentes de auth |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `Login` (linhas ~355–400), `LoginAuth` (linhas ~401–477), `NovaSenha` (linhas ~478–532), `RootAuth` (linhas ~2299–2333), `RootLegacy` (linhas ~2334–2348). **Adicionado:** `import { Login, LoginAuth, NovaSenha, RootAuth, RootLegacy } from './auth'`. **Permanece:** `Root` (componente raiz com detecção de modo). |

### Dependências afetadas

- **Hooks:** `useApp` (para logout), `useState`, `useEffect`
- **Contextos:** `AppProvider` (envolve os roteadores)
- **Serviços:** `dataService.js` (login, logout, recuperação de senha), `supabase.js` (onAuthStateChange)
- **Componentes relacionados:** `MarketingApp`, `VendedorApp` (recebem `session` e `onLogout` como props)

### Critérios de conclusão

- Todos os 6 arquivos criados existem.
- `src/main.jsx` não contém mais as definições extraídas.
- Fluxo de login legado funciona.
- Fluxo de login Supabase funciona.
- Fluxo de recuperação de senha funciona.
- Build sem erros.

### Checklist de validação

- [ ] Login legado aceita credenciais do `.env.local`
- [ ] Login legado rejeita credenciais inválidas com mensagem de erro
- [ ] Login Supabase aceita email/senha válidos
- [ ] Login Supabase exibe erro para credenciais inválidas
- [ ] Link "Esqueci minha senha" dispara email de recuperação
- [ ] Formulário NovaSenha é exibido ao acessar link de recuperação
- [ ] Logout limpa sessão e retorna à tela de login
- [ ] Dark mode funciona nas telas de login

### Riscos conhecidos

- `LoginAuth` usa `supabase.auth.onAuthStateChange` — garantir que o listener seja cancelado no cleanup do `useEffect`.
- `NovaSenha` depende de parâmetros na URL (hash do Supabase) — testar com link real.

### Resultado esperado

- ~180 linhas removidas de `main.jsx`.
- 6 novos arquivos totalizando ~200 linhas.

---

### Fase 4 — Modais

---

## Etapa 9 — Modais

**Status: ⬜ Não iniciada**

### Objetivo

Extrair os modais de criação/edição de evento e material para módulo dedicado, separando formulários complexos do fluxo principal dos tabs.

**Problema que resolve:** Formulários modais longos (~130 linhas cada) embutidos no fluxo de renderização dos tabs.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/components/modals/EventModal.jsx` | Modal de criação e edição de evento com alocação de materiais |
| `src/components/modals/MaterialModal.jsx` | Modal de criação de novo material de estoque |
| `src/components/modals/index.js` | Re-exporta os modais |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `EventModal` (linhas ~533–620), `MaterialModal` (linhas ~621–666). **Adicionado:** `import { EventModal, MaterialModal } from './components/modals'`. **Permanece:** lógica de abertura/fechamento de modal nos tabs. |

### Dependências afetadas

- **Hooks:** `useApp` (para `addEvento`, `updateEvento`, `addMaterial`, `materiais`, `eventos`)
- **Contextos:** `AppContext` via `useApp`
- **Serviços:** nenhum direto (operações via `useApp`)
- **Componentes relacionados:** `EventosTab` (abre `EventModal`), `EstoqueTab` (abre `MaterialModal`)
- **Utils usados:** `sanitizeText` de `src/lib/security.js`, constantes de `src/lib/constants.js`

### Critérios de conclusão

- `src/components/modals/EventModal.jsx` e `MaterialModal.jsx` existem.
- `src/main.jsx` não contém mais as definições extraídas.
- Modais abrem e fecham corretamente.
- Formulários submetem e persistem dados.
- Build sem erros.

### Checklist de validação

- [ ] Botão "Novo Evento" abre EventModal
- [ ] EventModal pré-preenche campos ao editar evento existente
- [ ] EventModal permite alocar materiais ao evento
- [ ] Submit de EventModal cria/atualiza evento na lista
- [ ] Fechar EventModal sem salvar não altera dados
- [ ] Botão "Novo Material" abre MaterialModal
- [ ] Submit de MaterialModal adiciona material ao estoque
- [ ] Validação de campos obrigatórios funciona em ambos os modais

### Riscos conhecidos

- `EventModal` acessa `materiais` e `eventos` via `useApp` — garantir que o hook esteja acessível após extração.
- Sanitização de inputs via `sanitizeText` deve ser mantida antes de qualquer operação de escrita.

### Resultado esperado

- ~135 linhas removidas de `main.jsx`.
- 3 novos arquivos totalizando ~145 linhas.

---

### Fase 5 — Feature Tabs

---

## Etapa 10 — Dashboard + Eventos

**Status: ⬜ Não iniciada**

### Objetivo

Extrair os componentes de Dashboard, lista de eventos e detalhe de evento para módulo de feature dedicado, agrupando funcionalidades relacionadas ao domínio de eventos.

**Problema que resolve:** Seções de ~350 linhas com toda a lógica de exibição e interação de eventos misturada no arquivo monolítico.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/features/events/Dashboard.jsx` | KPIs, gráfico de leads, alertas de estoque, eventos futuros |
| `src/features/events/EventosTab.jsx` | Lista de eventos com filtros, criação, exibição resumida de leads |
| `src/features/events/EventDetail.jsx` | Detalhe do evento com gestão de materiais e lista de leads |
| `src/features/events/index.js` | Re-exporta os componentes |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `Dashboard` (linhas ~684–749), `EventosTab` (linhas ~750–803), `EventDetail` (linhas ~804–1031). **Adicionado:** `import { Dashboard, EventosTab, EventDetail } from './features/events'`. **Permanece:** `MarketingApp` que compõe os tabs. |

### Dependências afetadas

- **Hooks:** `useApp`, `useState`, `useMemo`, `useEffect`, `useCallback`
- **Contextos:** `AppContext` via `useApp`
- **Serviços:** nenhum direto (operações via `useApp`)
- **Componentes UI utilizados:** `Icon`, `Kpi`, `ChartView`, `StatusBadge`, `TipoBadge` (de `src/components/ui`)
- **Modais utilizados:** `EventModal` (de `src/components/modals`)
- **Utils utilizados:** `fmtDate`, `fmtDateLong`, `tipoLabel`, `statusLabel` (de `src/utils/format.js`)
- **Constantes utilizadas:** `UPCOMING_EVENTS_LIMIT`, `RECENT_EVENTS_SHOWN`, `CHART_CUTOUT`, `CHART_COLORS`, `STATUS_EVENTO`

### Critérios de conclusão

- 4 arquivos criados existem com exports corretos.
- `src/main.jsx` não contém mais as definições extraídas.
- Dashboard exibe KPIs, gráfico e próximos eventos.
- EventosTab lista, filtra e permite criar eventos.
- EventDetail exibe materiais e leads por evento.
- Build sem erros.

### Checklist de validação

- [ ] Dashboard carrega com KPIs corretos (total leads, eventos ativos, etc.)
- [ ] Gráfico de donut de leads por serviço renderiza
- [ ] Alerta de estoque crítico aparece no Dashboard
- [ ] Lista de próximos eventos exibe máximo 3 itens
- [ ] EventosTab exibe todos os eventos
- [ ] Filtro de status (planejado/ativo/encerrado) funciona
- [ ] Clicar em evento abre EventDetail
- [ ] EventDetail exibe materiais alocados ao evento
- [ ] EventDetail exibe leads por vendedor
- [ ] Adicionar material ao evento funciona
- [ ] Remover material do evento funciona
- [ ] Marcar material como retornado funciona
- [ ] Voltar de EventDetail retorna à lista de eventos

### Riscos conhecidos

- `EventDetail` (~230 linhas) é o componente mais complexo desta etapa — revisar todos os handlers antes de extrair.
- `CHART_COLORS` pode estar definido localmente em `main.jsx` (linha ~85–87) e ainda não ter sido movido para `constants.js` — verificar antes de extrair.

### Resultado esperado

- ~350 linhas removidas de `main.jsx`.
- 4 novos arquivos totalizando ~370 linhas.

---

## Etapa 11 — Estoque + Leads + Checkin

**Status: ⬜ Não iniciada**

### Objetivo

Extrair os tabs de estoque, leads e checkin para módulos de feature, isolando domínios funcionais distintos.

**Problema que resolve:** Três domínios funcionais independentes (estoque, leads, checkin) ocupando ~535 linhas no arquivo monolítico.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/features/inventory/EstoqueTab.jsx` | Listagem e gestão de materiais por nível de estoque |
| `src/features/leads/LeadsTab.jsx` | Visualização, filtro e exportação de leads |
| `src/features/checkin/CheckinTab.jsx` | Busca de lead por CPF em evento específico |
| `src/features/inventory/index.js` | Re-exporta EstoqueTab |
| `src/features/leads/index.js` | Re-exporta LeadsTab |
| `src/features/checkin/index.js` | Re-exporta CheckinTab |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `EstoqueTab` (linhas ~1032–1088), `LeadsTab` (linhas ~1089–1202), `CheckinTab` (linhas ~1454–1624). **Adicionado:** imports dos 3 componentes. **Permanece:** `EquipeTab`, `EquipeAuthTab`, demais componentes. |

### Dependências afetadas

- **Hooks:** `useApp`, `useState`, `useMemo`
- **Contextos:** `AppContext` via `useApp`
- **Serviços:** nenhum direto
- **Componentes UI:** `Icon`, `StatusBadge` (para EstoqueTab), `ChartView` (para LeadsTab)
- **Utils:** `exportLeadsCSV` (csv.js), `fmtDate`, `servicoLabel` (format.js), `maskCpf` (masks.js)
- **Modais:** `MaterialModal` (aberto por EstoqueTab)
- **Constantes:** `NIVEL_ESTOQUE`, `STATUS_EVENTO`

### Critérios de conclusão

- 6 arquivos criados existem.
- `src/main.jsx` não contém mais as definições extraídas.
- Todos os três tabs funcionam corretamente.
- Build sem erros.

### Checklist de validação

- [ ] EstoqueTab agrupa materiais por nível (crítico/atenção/ok)
- [ ] Alerta visual no nível crítico de estoque
- [ ] Botão "Novo Material" em EstoqueTab abre MaterialModal
- [ ] Edição de quantidade de material funciona
- [ ] LeadsTab lista todos os leads
- [ ] Filtro por evento em LeadsTab funciona
- [ ] Filtro por vendedor em LeadsTab funciona
- [ ] Filtro por temperatura funciona
- [ ] Gráfico de leads por evento renderiza em LeadsTab
- [ ] Botão "Exportar CSV" gera download correto
- [ ] CheckinTab permite selecionar evento ativo
- [ ] Busca por CPF retorna lead encontrado
- [ ] Busca por CPF exibe mensagem para CPF não encontrado

### Riscos conhecidos

- `LeadsTab` usa `useMemo` com dependências de `leads` e `eventos` — garantir que o memoization seja preservado.
- `CheckinTab` usa `maskCpf` em tempo real no input — testar performance.

### Resultado esperado

- ~535 linhas removidas de `main.jsx`.
- 6 novos arquivos totalizando ~560 linhas.

---

## Etapa 12 — Equipe

**Status: ⬜ Não iniciada**

### Objetivo

Extrair os tabs de gestão de equipe (modo local e modo Supabase Auth) para módulo de feature, isolando o domínio de gerenciamento de usuários/vendedores.

**Problema que resolve:** Dois componentes de ~250 linhas cada com lógica de gestão de usuários embutida no monolítico.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/features/team/EquipeTab.jsx` | Gestão de vendedores no modo local (sem Supabase Auth) |
| `src/features/team/EquipeAuthTab.jsx` | Gestão de usuários com RBAC no modo Supabase Auth |
| `src/features/team/index.js` | Re-exporta os dois componentes |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `EquipeTab` (linhas ~1203–1287), `EquipeAuthTab` (linhas ~1288–1453). **Adicionado:** `import { EquipeTab, EquipeAuthTab } from './features/team'`. **Permanece:** `MarketingApp` que decide qual tab usar. |

### Dependências afetadas

- **Hooks:** `useApp`, `useState`, `useEffect`
- **Contextos:** `AppContext` via `useApp`
- **Serviços:** `dataService.js` — `EquipeAuthTab` chama `dataService.listarUsuarios`, `dataService.criarUsuario`, `dataService.atualizarPapelUsuario`, `dataService.toggleUsuarioAtivo`
- **Edge Function:** `EquipeAuthTab` chama a Edge Function `atualizar-email-usuario` via fetch
- **Componentes UI:** `Icon`
- **Utils:** `sanitizeText` (security.js)
- **Constantes:** `MAX_NOME`, `SENHA_MIN_LENGTH`

### Critérios de conclusão

- 3 arquivos criados existem.
- `src/main.jsx` não contém mais as definições extraídas.
- EquipeTab funciona no modo local.
- EquipeAuthTab funciona no modo Supabase.
- Build sem erros.

### Checklist de validação

- [ ] EquipeTab lista vendedores (modo local)
- [ ] Adicionar vendedor em EquipeTab funciona
- [ ] Ativar/desativar vendedor em EquipeTab funciona
- [ ] EquipeAuthTab lista usuários com papel (modo Supabase)
- [ ] Criar novo usuário em EquipeAuthTab funciona
- [ ] Alterar papel do usuário (marketing/vendedor) funciona
- [ ] Ativar/desativar usuário funciona
- [ ] Erro de permissão exibido para operações não autorizadas

### Riscos conhecidos

- `EquipeAuthTab` chama Edge Function diretamente via `fetch` — garantir que a URL da função seja lida de variável de ambiente, não hardcoded.
- Operações de criação de usuário podem ter latência alta — confirmar que loading states são preservados.

### Resultado esperado

- ~250 linhas removidas de `main.jsx`.
- 3 novos arquivos totalizando ~265 linhas.

---

### Fase 6 — App do Vendedor

---

## Etapa 13 — VendedorApp

**Status: ⬜ Não iniciada**

### Objetivo

Extrair o shell completo do vendedor (aplicativo mobile-first de captura de leads) de `main.jsx` para módulo próprio, isolando completamente o contexto de uso do vendedor.

**Problema que resolve:** ~580 linhas de UI e lógica específica do vendedor misturadas com a UI do marketing no mesmo arquivo.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/apps/VendedorApp.jsx` | Shell completo do vendedor: seletor de evento, tabs de leads, ranking e pacotes |
| `src/apps/LeadEditInline.jsx` | Editor inline de lead (usado dentro de VendedorApp) |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `LeadEditInline` (linhas ~1692–1757), `VendedorApp` (linhas ~1769–2274). **Adicionado:** `import VendedorApp from './apps/VendedorApp'`. **Permanece:** `MarketingApp`, `Root`, roteamento. |

### Dependências afetadas

- **Hooks:** `useApp`, `useState`, `useEffect`, `useRef`, `useCallback`
- **Contextos:** `AppContext` via `useApp`
- **Serviços:** nenhum direto (operações via `useApp`)
- **Componentes UI:** `Icon`, `SyncBadge`
- **Utils:** `maskCpf`, `maskTel`, `validarCpf`, `validarTelefone` (masks.js), `fmtDate` (format.js), `sanitizeText` (security.js)
- **Constantes:** `RANKING_DEBOUNCE_MS`, `RANKING_POLL_MS`, `TOAST_DURATION_MS`, `META_DIARIA`, `AVATARS_SHOWN`, `OBS_ATALHOS`, `TEMPERATURA_CONFIG`

### Notas de implementação

- `VendedorApp` tem 4 tabs internos: "registrar", "meus-leads", "pacotes", "evento".
- Tab "pacotes" contém tabela de planos hardcoded — manter como está (etapa 4 decidiu não mover).
- Tab "evento" tem lógica de polling de ranking com debounce — garantir cleanup do `setInterval` no unmount.
- Toast com undo de lead deve funcionar exatamente igual.
- `LeadEditInline` pode ser colocado no mesmo arquivo ou em arquivo separado — avaliar tamanho.

### Critérios de conclusão

- `src/apps/VendedorApp.jsx` existe com o componente completo.
- `src/main.jsx` não contém mais as definições extraídas.
- Todos os fluxos do vendedor funcionam.
- Build sem erros.

### Checklist de validação

- [ ] Seletor de evento exibe apenas eventos ativos
- [ ] Formulário de lead (tab "registrar") submete corretamente
- [ ] Modo rápido de lead funciona
- [ ] Toast de confirmação aparece após criar lead
- [ ] Botão "desfazer" no toast remove o lead criado
- [ ] Tab "meus-leads" lista leads do vendedor logado
- [ ] Ciclo de temperatura (frio→morno→quente→convertido) funciona
- [ ] Botão de WhatsApp abre link correto
- [ ] Botão de ligação abre discador correto
- [ ] Edição inline de lead salva corretamente
- [ ] Tab "pacotes" exibe tabela de planos
- [ ] Tab "evento" exibe ranking com posição do vendedor
- [ ] Ranking atualiza automaticamente a cada 60 segundos
- [ ] SyncBadge exibe estado correto no header

### Riscos conhecidos

- Polling com `setInterval` deve ser cancelado no `useEffect` cleanup — memory leak se omitido.
- `useCallback` em handlers de lead deve preservar as dependências exatas para evitar re-renders.
- Toast com undo tem timeout de 5s — garantir que o timer seja cancelado se o usuário clicar em desfazer.

### Resultado esperado

- ~580 linhas removidas de `main.jsx`.
- 2 novos arquivos totalizando ~600 linhas.
- `main.jsx` reduzido para ~400 linhas aproximadamente.

---

### Fase 7 — Layout Shells

---

## Etapa 14 — App + Layout Shells

**Status: ⬜ Não iniciada**

### Objetivo

Extrair `MarketingApp` (shell do marketing com navegação por tabs) e `Root` (roteador raiz com detecção de modo) de `main.jsx`, deixando o arquivo principal como ponto de entrada mínimo.

**Problema que resolve:** Shells de layout e roteamento raiz embutidos no arquivo monolítico.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/apps/MarketingApp.jsx` | Shell do usuário marketing: barra de navegação, tabs, dark mode |
| `src/apps/Root.jsx` | Componente raiz: detecta modo (Supabase vs legado) e renderiza roteador correto |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `MarketingApp` (linhas ~1625–1679), `Root` (linhas ~2279–2295). **Adicionado:** imports dos dois componentes. **Permanece:** `AppProvider`, render do `Root` no `ReactDOM.createRoot`. |

### Dependências afetadas

- **Hooks:** `useApp`, `useState`
- **Contextos:** `AppProvider` (envolve `Root`)
- **Componentes filhos de MarketingApp:** `Dashboard`, `EventosTab`, `EventDetail`, `EstoqueTab`, `LeadsTab`, `EquipeTab`, `EquipeAuthTab`, `CheckinTab`
- **Componentes filhos de Root:** `RootAuth`, `RootLegacy`
- **Constantes:** variáveis de ambiente `VITE_SUPABASE_URL` para detecção de modo

### Critérios de conclusão

- `src/apps/MarketingApp.jsx` e `src/apps/Root.jsx` existem.
- `src/main.jsx` não contém mais as definições extraídas.
- Navegação entre tabs do marketing funciona.
- Detecção de modo (Supabase vs legado) funciona.
- Build sem erros.

### Checklist de validação

- [ ] Navegação entre todos os tabs do marketing funciona
- [ ] Tab ativo é destacado visualmente
- [ ] Botão de logout funciona em MarketingApp
- [ ] Dark mode toggle funciona em MarketingApp
- [ ] Modo Supabase é detectado quando `VITE_SUPABASE_URL` está definido
- [ ] Modo legado é usado quando `VITE_SUPABASE_URL` não está definido
- [ ] Tab "Equipe" usa EquipeAuthTab no modo Supabase
- [ ] Tab "Equipe" usa EquipeTab no modo legado

### Riscos conhecidos

- `MarketingApp` decide qual componente de Equipe usar baseado no modo — lógica condicional deve ser preservada exatamente.

### Resultado esperado

- ~70 linhas removidas de `main.jsx`.
- 2 novos arquivos totalizando ~80 linhas.
- `main.jsx` reduzido para ~330 linhas.

---

### Fase 8 — Domain Hooks

---

## Etapa 15 — Domain Hooks

**Status: ⬜ Não iniciada**

### Objetivo

Extrair hooks de domínio reutilizáveis de `main.jsx` e de dentro dos componentes para módulo dedicado: `usePersisted` (persistência em storage), lógica de ranking e padrões de formulário.

**Problema que resolve:** Hooks genéricos de infraestrutura definidos junto com componentes de negócio.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/hooks/usePersisted.js` | Hook de sincronização de estado com localStorage/sessionStorage |
| `src/hooks/useRanking.js` | Hook de polling de ranking com debounce e cleanup automático |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `usePersisted` (linhas ~122–147). **Adicionado:** `import { usePersisted } from './hooks/usePersisted'`. **Permanece:** `AppProvider` (que usa `usePersisted`). |
| `src/apps/VendedorApp.jsx` | **Modificado:** lógica de polling de ranking extraída para `useRanking`. |

### Dependências afetadas

- **Hooks:** `useState`, `useEffect`, `useRef`, `useCallback`
- **Contextos:** `AppContext` via `useApp` (para `useRanking` acessar `obterRanking`)
- **Componentes que usam `usePersisted`:** `AppProvider`
- **Componentes que usam `useRanking`:** tab "evento" em `VendedorApp`

### Critérios de conclusão

- `src/hooks/usePersisted.js` existe e exporta `usePersisted`.
- `src/hooks/useRanking.js` existe e exporta `useRanking`.
- `src/main.jsx` não contém mais a definição de `usePersisted`.
- Estado persiste corretamente entre reloads.
- Ranking atualiza com polling e é cancelado no unmount.
- Build sem erros.

### Checklist de validação

- [ ] Estado de modo escuro persiste entre reloads
- [ ] Estado de tab ativo persiste entre reloads
- [ ] Dados do modo local persistem em localStorage
- [ ] Ranking do evento atualiza automaticamente
- [ ] Polling de ranking é cancelado ao sair da tab "evento"
- [ ] Nenhum memory leak reportado no console ao navegar entre tabs

### Riscos conhecidos

- `usePersisted` usa `sessionStorage` vs `localStorage` baseado em parâmetro — preservar comportamento exato.
- Cleanup de interval em `useRanking` deve usar ref para o ID do interval, não variável de closure.

### Resultado esperado

- ~30 linhas removidas de `main.jsx`.
- 2 novos arquivos totalizando ~60 linhas.

---

### Fase 9 — Infraestrutura e APIs

---

## Etapa 16 — Infraestrutura

**Status: ⬜ Não iniciada**

### Objetivo

Mover `AppContext` e `AppProvider` de `main.jsx` para módulo de contexto dedicado, completando a separação entre infraestrutura de estado e componentes de UI.

**Problema que resolve:** Context e Provider definidos no mesmo arquivo que os consumidores, impedindo imports limpos.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/context/AppContext.js` | Definição de `AppContext` (createContext) e export |
| `src/context/AppProvider.jsx` | Provider com todo o estado da aplicação e ações de domínio |
| `src/context/index.js` | Re-exporta `AppContext` e `AppProvider` |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/main.jsx` | **Removido:** `AppContext` (linha ~114), `AppProvider` (linhas ~149–314). **Adicionado:** `import { AppContext, AppProvider } from './context'`. **Permanece:** render do `Root` com `AppProvider`. |
| `src/hooks/useApp.js` | **Modificado:** atualizar import de `AppContext` de `../main` para `../context/AppContext` |

### Dependências afetadas

- **Hooks:** `usePersisted`, `useState`, `useEffect`, `useRef`, `useCallback`
- **Serviços:** `dataService.js` (todas as operações CRUD), `supabase.js`
- **Utils:** `mockData.js` (estado inicial), `sanitizeText` (security.js)
- **Constantes:** `SYNC_STATUS`, `REALTIME_DEBOUNCE_MS`, `TOAST_DURATION_MS`
- **Todos os componentes** que usam `useApp` serão indiretamente afetados

### Critérios de conclusão

- `src/context/AppContext.js` e `src/context/AppProvider.jsx` existem.
- `src/hooks/useApp.js` importa de `../context/AppContext` (não mais de `../main`).
- `src/main.jsx` não contém mais `AppContext` nem `AppProvider`.
- Todos os componentes que usam `useApp` funcionam normalmente.
- Build sem erros.

### Checklist de validação

- [ ] Login funciona e popula contexto corretamente
- [ ] CRUD de eventos funciona (criar, editar, remover)
- [ ] CRUD de leads funciona
- [ ] CRUD de materiais funciona
- [ ] Sync em tempo real funciona (modo Supabase)
- [ ] Modo local (localStorage) funciona sem Supabase
- [ ] `useApp()` retorna todas as ações e dados esperados
- [ ] `SyncBadge` ainda reflete status correto

### Riscos conhecidos

- Esta é a etapa de maior risco: mover o Provider quebra todos os consumidores se o import circular não for resolvido corretamente.
- Verificar se `useApp.js` → `AppContext` → `AppProvider` → `dataService` cria qualquer ciclo.
- Testar modo Supabase E modo legado após a mudança.

### Resultado esperado

- ~170 linhas removidas de `main.jsx`.
- 3 novos arquivos totalizando ~180 linhas.
- `main.jsx` reduzido para ~130 linhas.

---

## Etapa 17 — APIs por Domínio

**Status: ⬜ Não iniciada**

### Objetivo

Extrair as funções de CRUD por domínio do `AppProvider` para módulos de API separados, reduzindo a responsabilidade do Provider a apenas orquestração de estado.

**Problema que resolve:** `AppProvider` acumula ~150 linhas de lógica de API junto com gerenciamento de estado.

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/api/eventoApi.js` | CRUD de eventos: add, update, remove, getAtivos |
| `src/api/leadApi.js` | CRUD de leads: add, update, remove, getByEvento |
| `src/api/materialApi.js` | CRUD de materiais: add, update, addToEvento, removeFromEvento, toggleRetornado |
| `src/api/vendedorApi.js` | CRUD de vendedores: add, update, toggle |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/context/AppProvider.jsx` | **Removido:** implementações diretas das funções CRUD. **Adicionado:** imports dos módulos de API. **Permanece:** estado React, dispatch de updates otimistas, subscriptions realtime. |

### Dependências afetadas

- **Serviços:** `dataService.js` (chamado pelos módulos de API)
- **Utils:** `sanitizeText` (movido para dentro dos módulos de API)
- **Constantes:** `SYNC_STATUS`
- **Contextos:** `AppProvider` orquestra os resultados

### Critérios de conclusão

- 4 módulos de API criados com as funções corretas.
- `AppProvider` usa os módulos de API em vez de implementar diretamente.
- Todas as operações CRUD funcionam identicamente.
- Build sem erros.

### Checklist de validação

- [ ] Criar evento via EventModal persiste e aparece na lista
- [ ] Editar evento atualiza corretamente
- [ ] Remover evento remove da lista
- [ ] Criar lead persiste e aparece na lista do vendedor
- [ ] Editar temperatura do lead funciona
- [ ] Adicionar material ao evento funciona
- [ ] Remover material do evento funciona
- [ ] Marcar material como retornado funciona
- [ ] Criar vendedor (modo local) funciona
- [ ] Ativar/desativar vendedor funciona

### Riscos conhecidos

- Funções de API recebem state atual como parâmetro para updates otimistas — garantir que a assinatura das funções seja compatível com o que o Provider espera.
- Retry logic em `dataService.js` cobre falhas de rede — não duplicar retry nos módulos de API.

### Resultado esperado

- ~100 linhas removidas de `AppProvider.jsx`.
- 4 novos arquivos totalizando ~120 linhas.

---

### Fase 10 — Finalização

---

## Etapa 18 — Centralização do Dual Mode

**Status: ⬜ Não iniciada**

### Objetivo

Centralizar toda a lógica de detecção e roteamento do modo dual (Supabase vs legado) em um único módulo, eliminando verificações de `VITE_SUPABASE_URL` espalhadas pelo código.

**Problema que resolve:** Condicionais `if (supabaseUrl)` duplicadas em múltiplos arquivos (`AppProvider`, `Root`, `dataService`).

### Arquivos criados

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/lib/mode.js` | Helpers de detecção de modo: `isSupabaseMode()`, `getMode()`, constante `MODE` |

### Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/lib/supabase.js` | Pode receber helpers de modo se houver sobreposição |
| `src/context/AppProvider.jsx` | Substitui `if (import.meta.env.VITE_SUPABASE_URL)` por `isSupabaseMode()` |
| `src/apps/Root.jsx` | Substitui verificação de modo por `isSupabaseMode()` |
| `src/lib/dataService.js` | Substitui verificações de modo pela função centralizada |

### Dependências afetadas

- **Todos os arquivos** que verificam `VITE_SUPABASE_URL` diretamente
- **Testes E2E:** `playwright.config.js` configura dois servidores (porta 3000 = legado, porta 3001 = Supabase) — não alterar essa lógica

### Critérios de conclusão

- `src/lib/mode.js` existe e exporta helpers de modo.
- Nenhum arquivo contém `import.meta.env.VITE_SUPABASE_URL` diretamente (exceto `mode.js` e `supabase.js`).
- Modo Supabase funciona com `VITE_SUPABASE_URL` definido.
- Modo legado funciona sem `VITE_SUPABASE_URL`.
- Build sem erros.
- `main.jsx` reduzido a ponto de entrada mínimo (~50–80 linhas).

### Checklist de validação

- [ ] `npm run dev` (sem `.env.local`) usa modo legado
- [ ] `npm run dev` (com `.env.local` preenchido) usa modo Supabase
- [ ] Login legado funciona no modo legado
- [ ] Login Supabase funciona no modo Supabase
- [ ] Testes E2E passam nos dois modos (`npm test`)
- [ ] Build de produção (`npm run build`) sem erros
- [ ] Nenhum `console.error` no browser após o build

### Riscos conhecidos

- Testes E2E dependem de variáveis de ambiente específicas por porta — não alterar `playwright.config.js`.
- `dataService.js` tem branches de modo extensos — refatoração deve ser conservadora (apenas substituir a checagem, não a lógica).

### Resultado esperado

- `main.jsx` com ~50–80 linhas (apenas imports e `ReactDOM.createRoot`).
- `src/lib/mode.js` com ~15 linhas.
- Estrutura final:

```
src/
├── main.jsx                    (~60 linhas — ponto de entrada)
├── index.css
├── apps/
│   ├── Root.jsx
│   ├── MarketingApp.jsx
│   └── VendedorApp.jsx
├── auth/
│   ├── Login.jsx
│   ├── LoginAuth.jsx
│   ├── NovaSenha.jsx
│   ├── RootAuth.jsx
│   └── RootLegacy.jsx
├── components/
│   ├── SyncBadge.jsx
│   ├── modals/
│   │   ├── EventModal.jsx
│   │   └── MaterialModal.jsx
│   └── ui/
│       ├── Icon.jsx
│       ├── ChartView.jsx
│       ├── Badge.jsx
│       ├── Kpi.jsx
│       └── index.js
├── context/
│   ├── AppContext.js
│   ├── AppProvider.jsx
│   └── index.js
├── features/
│   ├── events/
│   │   ├── Dashboard.jsx
│   │   ├── EventosTab.jsx
│   │   └── EventDetail.jsx
│   ├── inventory/
│   │   └── EstoqueTab.jsx
│   ├── leads/
│   │   └── LeadsTab.jsx
│   ├── checkin/
│   │   └── CheckinTab.jsx
│   └── team/
│       ├── EquipeTab.jsx
│       └── EquipeAuthTab.jsx
├── hooks/
│   ├── useApp.js
│   ├── usePersisted.js
│   └── useRanking.js
├── api/
│   ├── eventoApi.js
│   ├── leadApi.js
│   ├── materialApi.js
│   └── vendedorApi.js
└── lib/
    ├── supabase.js
    ├── dataService.js
    ├── security.js
    ├── cache.js
    ├── constants.js
    └── mode.js
```

---

## Próxima Etapa Recomendada

**→ Etapa 18 — Centralização Dual Mode** (próxima etapa não concluída)

**Resumo do que fazer:**

1. Criar `src/lib/mode.js` com helpers `isSupabaseMode()`, `getMode()`, constante `MODE`.
2. Substituir verificações `import.meta.env.VITE_SUPABASE_URL` por `isSupabaseMode()` em:
   - `src/context/AppProvider.jsx`
   - `src/apps/Root.jsx`
   - `src/lib/dataService.js`
3. Executar build e verificar sem erros nos dois modos.
4. Commit: `refactor: centralize dual-mode detection in src/lib/mode.js`.
