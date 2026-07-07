# RIPD — Relatório de Impacto à Proteção de Dados Pessoais

> **Versão:** 1.1  
> **Data:** 2026-07-07  
> **PA-17/LGPD** — Elaborado como parte do Plano de Ação LGPD da RJNet.  
> **Controlador:** RJNet Telecomunicações Ltda.  
> **Sistema avaliado:** RJNet Gestão de Eventos  
> **Status:** ⚠️ Pendente aprovação pelo DPO (PA-19 — nomeação em andamento)
>
> **Gatilho da revisão 1.1:** entre 2026-07-06 e 2026-07-07 (D-061 a D-067) o sistema abriu um **segundo canal de tratamento**, estruturalmente diferente do original — captação pública via formulário dinâmico (Form Builder) e QR Code, sem mediação de vendedor e sem sessão autenticada. É exatamente a "mudança significativa no tratamento de dados" que a seção 7 deste documento já previa como gatilho de revisão obrigatória.

---

## 1. Descrição do Tratamento

### 1.1 Contexto

O sistema **RJNet Gestão de Eventos** é uma SPA (Single Page Application) utilizada pela RJNet para gerenciar eventos de campo, capturar leads e acompanhar o desempenho da equipe comercial. O tratamento de dados pessoais ocorre em **dois contextos estruturalmente distintos** (revisão 1.1, D-061–D-067):

1. **Captação mediada** (original): potenciais clientes abordados presencialmente em eventos de campo ou no dia a dia comercial (D-058), com um vendedor da RJNet coletando os dados em nome do titular.
2. **Captação pública auto-submetida** (novo, D-062/D-063): o próprio titular preenche e envia um formulário dinâmico (Form Builder) via link ou QR Code, sem mediação de vendedor e sem sessão autenticada — primeiro caminho de escrita não-autenticado do sistema.

### 1.2 Operações de tratamento avaliadas

| Operação | Descrição |
|----------|-----------|
| **Coleta (mediada)** | Dados coletados presencialmente por vendedores em campo ou no dia a dia comercial |
| **Coleta (pública, D-062)** | Auto-submissão pelo próprio titular via `/f/:slug` (`FormularioPublico.jsx`), sem sessão, processada pela Edge Function pública `submeter-formulario` com `service_role` |
| **Armazenamento** | Banco de dados PostgreSQL (Supabase Inc., EUA) — mesma tabela `leads` para ambos os canais |
| **Acesso** | Equipe interna: marketing/comercial (todos os leads, D-059) e vendedor (próprios leads); leads da captação pública ficam sem `vendedor_id` até distribuição manual pelo marketing/comercial |
| **Leitura anônima (D-062)** | Tabelas `formularios`/`campos_personalizados` têm policy `anon` de leitura, restrita a `ativo=true` — expõem só metadado do formulário (nome, campos habilitados), nunca dado de titular |
| **Exportação** | CSV de leads por usuários marketing, com log de auditoria |
| **Exclusão** | Soft delete pelo vendedor (leads mediados) ou pela fila de distribuição (leads públicos) + hard delete automático por retenção |
| **Moderação (D-067)** | Bloqueio de link em texto livre, captura de IP de origem (`origem_ip`) e rate limit de 5 submissões/10min por IP na captação pública, para mitigar abuso de um endpoint de escrita não-autenticado |
| **Transferência internacional** | Supabase Inc. — EUA |

### 1.3 Fluxo de dados

**Fluxo 1 — captação mediada (original):**
```
Titular (evento presencial / dia a dia)
  ↓ consentimento + coleta pelo vendedor
VendedorApp (dispositivo móvel)
  ↓ fila offline criptografada (AES-GCM 256)
Supabase PostgreSQL (EUA)
  ↓ acesso restrito por RLS
Equipe marketing/comercial (exportação CSV com log)
```

**Fluxo 2 — captação pública sem sessão (D-062, D-067):**
```
Titular (visitante público, sem sessão)
  ↓ consentimento direto + auto-submissão
FormularioPublico.jsx (/f/:slug, sem AppProvider)
  ↓ fetch() direto — sem anon key para escrita
Edge Function submeter-formulario (service_role)
  ↓ valida catálogo fixo + bloqueia link + rate limit 5/10min por IP
  ↓ captura origem_ip (sem retenção própria)
Supabase PostgreSQL (EUA) — mesma tabela leads, vendedor_id nulo
  ↓ fila "Leads sem vendedor" (LeadsTab.jsx)
Equipe marketing/comercial (distribuição manual a um vendedor)
```

---

## 2. Necessidade e Proporcionalidade

### 2.1 Avaliação de necessidade por dado

| Dado | Finalidade declarada | Necessário? | Proporcional? |
|------|---------------------|-------------|---------------|
| Nome | Identificação do lead para contato | ✅ Sim | ✅ Sim |
| Telefone | Canal de contato principal | ✅ Sim | ✅ Sim |
| CPF | Visita técnica e contrato | ✅ Sim (opcional) | ✅ Sim — coletado somente quando declarado |
| Endereço | Verificação de cobertura de rede | ⚠️ Parcial — avaliar se pode ser coletado somente na fase de contrato | Pendente revisão (PA-21) |
| Serviço de interesse | Personalização da abordagem | ✅ Sim | ✅ Sim |
| Temperatura | Priorização interna | ✅ Sim — dado interno, não compartilhado | ✅ Sim |
| Observações | Contexto para follow-up | ⚠️ Campo livre — risco de captura excessiva | Pendente revisão (PA-21) |
| Bairro (D-062) | Segmentação geográfica de campanhas de captação | ✅ Sim | ✅ Sim — granularidade de bairro, não endereço completo |
| Campos personalizados / `campos_extras` (D-063) | Definidos ad hoc pelo marketing por formulário — finalidade varia por campo | ⚠️ Sem catálogo fixo de tipos — mesmo risco de coleta excessiva do campo "observações" | Pendente revisão (PA-21) |
| Origem/IP (`origem_ip`, D-067) | Rate limit e investigação de abuso no formulário público (endpoint não-autenticado) | ✅ Sim — finalidade de segurança, não comercial | ✅ Sim — sem retenção própria, apagado junto do lead |

### 2.2 Base legal de cada tratamento

| Operação | Base legal (LGPD) |
|----------|------------------|
| Coleta e armazenamento | Consentimento (art. 7°, I) |
| Priorização interna (temperatura) | Legítimo interesse (art. 7°, IX) |
| Exportação e uso comercial | Consentimento (art. 7°, I) |
| Auditoria interna | Legítimo interesse / cumprimento de obrigação legal |

---

## 3. Avaliação de Riscos

### 3.1 Riscos identificados

| ID | Risco | Probabilidade | Impacto | Nível |
|----|-------|--------------|---------|-------|
| R-01 | Vazamento de dados por falha no Supabase (terceiro) | Baixa | Alto | **Médio** |
| R-02 | Acesso indevido por ex-vendedor com sessão ativa | Baixa | Médio | **Baixo** |
| R-03 | Exportação CSV não autorizada por usuário marketing | Baixa | Alto | **Médio** |
| R-04 | Perda de dados offline antes da sincronização | Baixa | Baixo | **Baixo** |
| R-05 | Captura excessiva via campo "observações" (dado livre) | Média | Médio | **Médio** |
| R-06 | Transferência internacional sem DPA formal (Free Plan) | Alta | Médio | **Alto** |
| R-07 | Ausência de DPO formal para responder incidentes | Média | Alto | **Alto** |
| R-08 | Titular sem canal de contato ativo (e-mail pendente) | Alta | Médio | **Alto** |
| R-09 | Abuso do endpoint público não-autenticado (`submeter-formulario`) — spam, coleta de dados de terceiros sem consentimento, conteúdo ilegal em texto livre (D-062) | Média | Médio | **Médio** |
| R-10 | Captura excessiva via `campos_extras` (D-063) — texto livre sem catálogo fixo de tipos, definido pela própria equipe sem revisão de proporcionalidade caso a caso | Média | Médio | **Médio** |
| R-11 | Falso positivo no rate limit por IP — usuários atrás de CGNAT/rede compartilhada podem ser bloqueados indevidamente (D-067) | Média | Baixo | **Baixo** |

### 3.2 Riscos residuais elevados

Os riscos **R-06**, **R-07** e **R-08** são classificados como **Alto** e dependem de ações externas:

- **R-06:** mitigado com upgrade para Supabase Pro Plan e assinatura de DPA (PA-14)
- **R-07:** mitigado com nomeação de DPO (PA-19)
- **R-08:** mitigado com criação do canal privacidade@rjnet.com.br (PA-15)

---

## 4. Medidas de Mitigação Adotadas

| Risco | Medida implementada | PA | Status |
|-------|--------------------|----|--------|
| R-01 | SOC 2 / ISO 27001 Supabase; RLS no banco | PA-02 | 🟢 |
| R-02 | Revogação de sessão no logout; RLS por `auth.uid()` | PA-11 | 🟢 |
| R-03 | Log de exportações com usuário, filtros e quantidade | PA-06 | 🟢 |
| R-04 | Fila offline criptografada com AES-GCM 256 | PA-05 | 🟢 |
| R-05 | Campo observações sem validação de conteúdo — pendente revisão | PA-21 | 🔴 |
| R-06 | DPA pendente assinatura (requer upgrade Pro Plan) | PA-14 | 🟡 |
| R-07 | DPO em processo de nomeação | PA-19 | 🔴 |
| R-08 | Canal privacidade@rjnet.com.br pendente criação | PA-15 | 🟡 |
| R-09 | Três camadas técnicas: bloqueio de link em texto livre (client + Edge Function), rate limit 5 submissões/10min por IP, honeypot antispam; processo de remoção/denúncia documentado em `doc/SEGURANCA_MODERACAO.md` | PA-22 | 🟢 |
| R-10 | `campos_extras` ainda não incluído formalmente na revisão de proporcionalidade do PA-21 (mesma pendência do campo "observações") | PA-21 | 🔴 |
| R-11 | Sem mitigação técnica adicional — risco aceito, conhecido e documentado em D-067 (`doc/architecture/DECISIONS.md`); rate limit por IP prioriza conter abuso sobre eliminar falso positivo | — | 🟡 |

---

## 5. Consulta aos Titulares

O titular é consultado por meio do consentimento explícito coletado no momento da captação do lead (PA-04). Não foi realizada consulta formal ampla com titulares para esta versão do RIPD — recomendável para tratamentos de maior escala ou sensibilidade.

---

## 6. Parecer do DPO

> ⚠️ **Pendente** — DPO ainda não foi nomeado formalmente (PA-19). Este RIPD deve ser revisado e aprovado pelo DPO após a nomeação.

| Campo | Valor |
|-------|-------|
| **DPO** | _a nomear_ |
| **Data do parecer** | _pendente_ |
| **Conclusão** | _pendente_ |
| **Assinatura** | _pendente_ |

---

## 7. Histórico de Revisões

| Versão | Data | Autor | Alterações |
|--------|------|-------|-----------|
| 1.0 | 2026-06-16 | Equipe técnica RJNet | Versão inicial — PA-17/LGPD |
| 1.1 | 2026-07-07 | Equipe técnica RJNet | Incorpora o novo canal de captação pública/QR Code sem sessão (D-061–D-067): 2º fluxo de dados, novas categorias de dado (bairro, `campos_extras`, `origem_ip`), riscos R-09/R-10/R-11 e mitigações correspondentes (PA-22) |

---

> Próxima revisão obrigatória: após nomeação do DPO (PA-19) ou em caso de mudança significativa no tratamento de dados.  
> Referência: `doc/lgpd/PLANO_DE_ACAO_LGPD.md` — PA-17.
