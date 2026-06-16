# CHANGELOG — RJNet Gestão de Eventos

Histórico de mudanças relevantes. Mais recente no topo.

---

## [v1.6] — Auditoria e plano de conformidade LGPD (D-031)
**Data:** 2026-06-16

**O que mudou**
- **Docs:** criado `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — auditoria completa de LGPD, segurança, governança e Supabase (1.200+ linhas, 11 seções + seção de fases de implementação)
- **Docs:** criado `doc/PLANO_DE_ACAO_LGPD.md` — plano de ação executável com 21 ações organizadas em 4 fases, com responsáveis, prazos, queries SQL prontas e checklists de evidência
- **Docs:** `CLAUDE.md` atualizado — tabela de referência agora inclui os dois novos documentos de conformidade
- **Docs:** `doc/DECISIONS.md` atualizado — registrada decisão D-031 sobre a auditoria

**Principais não conformidades documentadas**
- Ausência total de consentimento LGPD para leads captados em eventos (CRÍTICO)
- Senha de marketing exposta no bundle JavaScript público (CRÍTICO)
- Policies anônimas no `schema.sql` sem garantia de migração aplicada (CRÍTICO)
- CORS aberto na Edge Function administrativa (ALTO)
- Sem log de exportações CSV com dados pessoais (ALTO)
- CPF em texto plano sem criptografia (ALTO)
- Sem política de retenção de dados (ALTO)

**Nota de conformidade obtida:** 4,2 / 10 (meta: 8,7 após Fase 4)

**Impacto**
- Nenhum código de produção alterado nesta versão — apenas documentação
- Base documental criada para execução do plano de conformidade

---

## [v1.5] — Correções arquiteturais pós-auditoria (D-030)
**Data:** 2026-06-16

**O que mudou**
- **C-1 (segurança):** `salvarEdicao` em `VendedorApp.jsx` agora sanitiza `nome`, `cpf`, `endereco` e `observacao` via `sanitizeText()` antes de chamar `updateLead` — eliminando vetor de XSS armazenado no fluxo de edição de lead
- **C-6 (documentação):** `doc/SYSTEM_MAP.md` corrigido — seção "Detecção de Modo" agora descreve corretamente que `src/lib/mode.js` existe e que `isSupabaseMode()` é a abstração obrigatória
- **C-5 (refatoração):** `genId` extraído do `AppProvider` para `src/utils/ids.js`; as 4 factories de API importam diretamente de `utils/ids` e deixam de receber `genId` como parâmetro
- **C-3 (refatoração):** `obterRanking` movida do `AppProvider` para `createLeadApi` em `src/api/leadApi.js`; o Provider apenas desestrutura e expõe via contexto
- **C-4 (refatoração):** `createLeadApi.addLead` retorna o objeto criado com o ID canônico; `VendedorApp.submit` removeu a pré-geração local de ID e usa o retorno da factory
- **C-2 (arquitetural):** novo `src/api/equipeApi.js` com `createEquipeApi` expondo `criarUsuario`, `atualizarPerfil` e `excluirUsuario`; `EquipeAuthTab` removeu import direto de `dataService` e consome via `useApp()`

**Por que mudou**
- Auditoria pós-refatoração identificou 6 desvios remanescentes, documentados em `doc/ARCHITECTURE_FIX_PLAN.md`

**Impacto**
- Nenhum componente de feature (`src/features/`) ou app (`src/apps/`) acessa `src/lib/dataService` diretamente
- Todos os caminhos de escrita de lead (criação e edição) aplicam sanitização
- `AppProvider` é orquestrador puro sem lógica de domínio

---

## [v1.4] — Sim/Não para "já é cliente" e exclusão de lead pelo vendedor
**Data:** 2026-06-16

**O que mudou**
- Campo "Já é cliente RJNet?" migrado de checkbox para controle segmentado **Não / Sim** em `VendedorApp.jsx` — tanto no formulário de novo lead quanto no `LeadEditInline`
- Botão **"Excluir lead"** adicionado em cada card na aba "Meus Leads", com confirmação inline em dois passos para evitar exclusões acidentais
- Novos estilos `.lm-del-btn`, `.lm-del-confirm`, `.lm-del-confirm-yes`, `.lm-del-confirm-no` adicionados a `index.css`

**Por que mudou**
- Checkbox binário não deixava claro qual era o estado padrão ("desmarcado" pode ser confundido com "não respondido")
- Vendedores precisavam de uma forma de corrigir leads cadastrados por engano sem depender do marketing

**Impacto**
- UX mais clara para o campo "já é cliente": o estado sempre é explícito (Não ou Sim)
- Vendedor pode excluir próprios leads; a exclusão usa o soft delete já existente (`deletado = true` no banco)

---

## [v1.3] — Organização da documentação em `doc/`
**Data:** 2026-06-16

**O que mudou**
- Diretório `doc/` criado; `CHANGELOG.md`, `DECISIONS.md`, `REFATORAÇÃO.md`, `SUPABASE.md` e `SYSTEM_MAP.md` movidos para ele
- `CLAUDE.md` permanece na raiz (convenção Claude Code)
- `@doc/SYSTEM_MAP.md` adicionado ao `CLAUDE.md` — garante carregamento automático da arquitetura viva a cada sessão
- Tabela de Documentação de Referência no `CLAUDE.md` atualizada com novos caminhos e coluna "Quando ler"
- Decisão [D-028] registrada em `doc/DECISIONS.md`

**Por que mudou**
- Raiz com 6 `.md` soltos dificultava distinguir código de documentação
- `@import` do `SYSTEM_MAP.md` garante contexto arquitetural completo em toda sessão sem depender de decisão do Claude

**Impacto**
- Sem impacto funcional no app
- Novas docs especializadas entram em `doc/` sem poluir a raiz
- Arquitetura viva carregada automaticamente a cada sessão Claude

---

## [v1.2] — Multi-seleção de serviços e meta em 3 níveis
**Data:** 2026-06-16

**O que mudou**
- `servicoInteresse` agora suporta múltiplos valores (array) por lead; seleção de serviços no formulário do vendedor é multi-select (toggle de botões independentes)
- `servicoLabel()` em `format.js` atualizado para formatar arrays como lista separada por vírgula
- Backward-compatible: dados legados (string simples no banco) são automaticamente normalizados para array na leitura (`leadFromDb`); escrita sempre serializa JSON string
- Filtros de serviço em `LeadsTab` e contagem no gráfico de `Dashboard` tratam tanto array quanto string legada
- Meta diária única substituída por 3 níveis progressivos: 🥉 Bronze (20) / 🥈 Prata (40) / 🥇 Ouro (60)
- Barra de progresso exibe 3 marcadores com cores distintas por nível atingido (amarelo → bronze → prata → verde)
- Ranking da equipe (Placar) exibe medalha ao lado do total de cada vendedor
- `META_BRONZE`, `META_PRATA`, `META_OURO` adicionados a `constants.js`; `META_DIARIA` mantido como alias de `META_OURO` para backward-compat

**Por que mudou**
- Vendedores precisavam registrar interesse em mais de um serviço por lead (ex: Internet + RJNET Móvel)
- Meta única (15 leads) não refletia progressão real; 3 níveis dão motivação contínua ao longo do evento

**Impacto**
- Leads podem ter múltiplos serviços de interesse registrados
- Filtros e gráficos do marketing tratam os arrays corretamente
- Dados existentes continuam funcionando sem migração de banco

---

## [v1.1] — Refatoração: etapa 18 — centralização do dual mode
**Data:** 2026-06-16

**O que mudou**
- Criado `src/lib/mode.js` com `isSupabaseMode()`, `getMode()` e constante `MODE`
- `AppProvider.jsx`, `Root.jsx`, `MarketingApp.jsx`, `SyncBadge.jsx` e `dataService.js` migrados para importar de `mode.js`
- Nenhum arquivo fora de `supabase.js` e `mode.js` acessa `supabaseEnabled` ou `VITE_SUPABASE_URL` diretamente

**Por que mudou**
- A verificação de modo (Supabase vs local) estava duplicada em 5 arquivos
- Qualquer mudança na lógica de detecção exigia editar múltiplos pontos

**Impacto**
- Detecção de modo centralizada em único lugar — mudar a lógica é editar apenas `mode.js`
- Refatoração de 18 etapas concluída 100%
- Build sem erros — nenhum comportamento alterado

---

## [v1.0] — Refatoração: modularização completa (etapas 1–17)
**Data:** 2026-06-15 / 2026-06-16

**O que mudou**
- `src/main.jsx` reduzido de ~2.354 linhas para ~35 linhas
- Código extraído para 25+ módulos em `src/utils/`, `src/lib/`, `src/components/`, `src/features/`, `src/auth/`, `src/hooks/`, `src/api/`, `src/context/`, `src/apps/`
- Etapa 1: `format.js` — formatação de datas e labels
- Etapa 2: `masks.js` — máscaras e validadores CPF/telefone
- Etapa 3: `csv.js` — exportação CSV de leads
- Etapa 4: `mockData.js` — dados mock para modo local
- Etapa 5: `constants.js` — centralização de magic strings/numbers
- Etapa 6: `ui.jsx` — componentes atômicos (Icon, StatusBadge, Kpi, ChartView…)
- Etapa 7: `useApp.js` + `SyncBadge.jsx`
- Etapa 8: módulo `src/auth/` (Login, LoginAuth, NovaSenha, RootAuth, RootLegacy)
- Etapa 9: módulo `src/components/modals/` (EventModal, MaterialModal)
- Etapa 10: módulo `src/features/events/` (Dashboard, EventosTab, EventDetail)
- Etapa 11: módulo `src/features/` (EstoqueTab, LeadsTab, CheckinTab)
- Etapa 12: módulo `src/features/team/` (EquipeTab, EquipeAuthTab)
- Etapa 13: `VendedorApp.jsx` extraído para `src/apps/`
- Etapa 14: `MarketingApp.jsx` + `Root.jsx` extraídos para `src/apps/`
- Etapa 15: `usePersisted.js` + `useRanking.js` extraídos para `src/hooks/`
- Etapa 16: `AppContext.js` + `AppProvider.jsx` extraídos para `src/context/`
- Etapa 17: factories de API (`eventoApi`, `leadApi`, `materialApi`, `vendedorApi`) extraídas para `src/api/`

**Por que mudou**
- `main.jsx` com +2.300 linhas tornava qualquer edição arriscada e lenta
- Sem estrutura de pastas, era impossível localizar código ou dividir trabalho

**Impacto**
- Manutenção drasticamente mais simples — cada módulo tem responsabilidade única
- Nenhum comportamento alterado, zero risco funcional
- Base pronta para crescimento sem acúmulo em um arquivo único

---

## [v0.8] — Simplificação de papéis: remove papel comercial
**Data:** 2026-06-12

**O que mudou**
- Papel `comercial` removido do sistema
- Sistema unificado em apenas dois papéis: `marketing` e `vendedor`

**Por que mudou**
- O papel comercial estava sobreposto ao marketing sem distinção real
- Gerava confusão nas RLS policies e no roteamento de auth

**Impacto**
- Modelo de permissões mais simples e claro
- RLS policies com menos casos de borda

---

## [v0.7] — Sync offline de leads + logo RJNet
**Data:** 2026-06-09

**O que mudou**
- Fila persistente de sync offline para leads capturados sem internet
- Logo SVG da RJNet adicionado ao app

**Por que mudou**
- Eventos ocorrem em locais com sinal instável; leads eram perdidos ao fechar o app
- Identidade visual da empresa ausente

**Impacto**
- Leads capturados offline são sincronizados automaticamente ao voltar online
- App representa a marca corretamente em campo

---

## [v0.6] — Migração de Babel/CDN para Vite
**Data:** 2026-06-09

**O que mudou**
- Build migrado de Babel (CDN) para Vite
- CSP ajustada para remover `unsafe-eval` (não mais necessário com Vite)

**Por que mudou**
- App exibia tela preta no Vercel com Babel/CDN
- CSP bloqueava carregamento em alguns browsers

**Impacto**
- Deploy estável no Vercel
- Build mais rápido e bundle otimizado
- Sem dependência de CDN externo para funcionar

---

## [v0.5] — Check-in por CPF, exportação CSV e exclusão de evento
**Data:** 2026-06-09

**O que mudou**
- Check-in de lead por CPF em evento ativo
- Exportação de leads em CSV por evento
- Exclusão de evento pelo marketing
- Persistência de estado entre sessões (localStorage)
- CPF adicionado ao formulário de lead e aos cadastros de vendedor

**Por que mudou**
- Marketing precisava controlar presença em eventos sem depender de planilha externa
- Leads acumulados no app sem forma de exportar para CRM/planilha
- Estado do app se perdia ao recarregar a página

**Impacto**
- Fluxo de evento completo: criar → capturar leads → fazer check-in → exportar
- Vendedores identificados por CPF para evitar duplicatas

---

## [v0.4] — Melhorias de usabilidade do vendedor
**Data:** 2026-06-09

**O que mudou**
- Campo de temperatura do lead (frio / morno / quente / convertido)
- Meta diária de leads com indicador visual de progresso
- Modo rápido de cadastro de lead (formulário reduzido)
- Campo "já é cliente RJNet" no formulário
- Serviços de interesse atualizados na tela comercial

**Por que mudou**
- Vendedores em campo precisam cadastrar leads rápido, sem campos desnecessários
- Marketing precisava de qualificação básica do lead já na captura

**Impacto**
- Tempo de cadastro de lead reduzido
- Lead chega ao CRM com temperatura e flag de cliente existente

---

## [v0.3] — Gestão de materiais e ajustes de layout
**Data:** 2026-06-09

**O que mudou**
- Controle completo de materiais por evento (alocar, devolver, rastrear estoque)
- Eventos listados primeiro no dashboard, indicadores abaixo
- Botão Sair alinhado à direita do header
- Ícones SVG geométricos substituindo emojis

**Por que mudou**
- Marketing não conseguia rastrear quais materiais estavam em cada evento
- Layout inicial priorizava KPIs mas o foco real é a lista de eventos

**Impacto**
- Estoque de materiais controlado por evento, com alertas de nível baixo
- Interface mais limpa e profissional sem emojis

---

## [v0.2] — Identidade visual, segurança e responsividade
**Data:** 2026-06-09

**O que mudou**
- Redesign completo: tema escuro com preto e amarelo
- Gráficos Chart.js (leads por serviço, distribuição de eventos)
- Layout mobile responsivo
- Toggle dark/light mode
- Sanitização de inputs e headers CSP no Vercel
- Testes E2E com Playwright + testes unitários

**Por que mudou**
- Protótipo inicial sem identidade visual definida
- Sem proteção contra XSS ou injeção nos campos de formulário
- App inutilizável em smartphones usados pelos vendedores em campo

**Impacto**
- App usável em campo (mobile)
- Dados de lead protegidos contra inputs maliciosos
- Base de testes para prevenir regressões

---

## [v0.1] — Lançamento inicial
**Data:** 2026-06-05

**O que mudou**
- Upload inicial do projeto
- Correção do 404 no Vercel (faltava `index.html` na raiz)

**Por que mudou**
- Primeiro deploy do sistema

**Impacto**
- App acessível via Vercel pela primeira vez
