# RIPD — Relatório de Impacto à Proteção de Dados Pessoais

> **Versão:** 1.0  
> **Data:** 2026-06-16  
> **PA-17/LGPD** — Elaborado como parte do Plano de Ação LGPD da RJNet.  
> **Controlador:** RJNet Telecomunicações Ltda.  
> **Sistema avaliado:** RJNet Gestão de Eventos  
> **Status:** ⚠️ Pendente aprovação pelo DPO (PA-19 — nomeação em andamento)

---

## 1. Descrição do Tratamento

### 1.1 Contexto

O sistema **RJNet Gestão de Eventos** é uma SPA (Single Page Application) utilizada internamente pela RJNet para gerenciar eventos de campo, capturar leads e acompanhar o desempenho da equipe comercial. O tratamento de dados pessoais ocorre exclusivamente no contexto de captação de potenciais clientes em eventos presenciais.

### 1.2 Operações de tratamento avaliadas

| Operação | Descrição |
|----------|-----------|
| **Coleta** | Dados coletados presencialmente por vendedores em campo |
| **Armazenamento** | Banco de dados PostgreSQL (Supabase Inc., EUA) |
| **Acesso** | Equipe interna: marketing (todos os leads) e vendedor (próprios leads) |
| **Exportação** | CSV de leads por usuários marketing, com log de auditoria |
| **Exclusão** | Soft delete pelo vendedor + hard delete automático por retenção |
| **Transferência internacional** | Supabase Inc. — EUA |

### 1.3 Fluxo de dados

```
Titular (evento presencial)
  ↓ consentimento + coleta pelo vendedor
VendedorApp (dispositivo móvel)
  ↓ fila offline criptografada (AES-GCM 256)
Supabase PostgreSQL (EUA)
  ↓ acesso restrito por RLS
Equipe marketing (exportação CSV com log)
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

---

> Próxima revisão obrigatória: após nomeação do DPO (PA-19) ou em caso de mudança significativa no tratamento de dados.  
> Referência: `doc/lgpd/PLANO_DE_ACAO_LGPD.md` — PA-17.
