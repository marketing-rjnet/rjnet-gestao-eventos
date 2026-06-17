# Plano de Resposta a Incidentes de Dados Pessoais

> **Versão:** 1.0  
> **Data:** 2026-06-16  
> **PA-20/LGPD** — Elaborado como parte do Plano de Ação LGPD da RJNet.  
> **Controlador:** RJNet Telecomunicações Ltda.  
> **Status:** ⚠️ Pendente aprovação pelo DPO (PA-19 — nomeação em andamento)

---

## 1. O que é um Incidente de Dados

Um incidente de dados pessoais é qualquer evento que cause ou possa causar:

- **Acesso não autorizado** a dados pessoais
- **Vazamento** de dados para terceiros não autorizados
- **Destruição, perda ou alteração** não intencional de dados
- **Indisponibilidade** de dados que cause prejuízo aos titulares

### Exemplos práticos

| Exemplo | Categoria |
|---------|-----------|
| Banco de dados exposto publicamente (RLS desativado) | Acesso não autorizado |
| CSV de leads enviado para destinatário errado | Vazamento |
| Exclusão acidental de dados sem backup | Perda/destruição |
| Supabase fora do ar por mais de 24h | Indisponibilidade |
| Vendedor acessa leads de outro vendedor | Acesso não autorizado |
| Dispositivo do vendedor perdido/roubado com dados offline | Risco de acesso não autorizado |

---

## 2. Classificação de Severidade

| Nível | Critério | Prazo de ação |
|-------|---------|--------------|
| **CRÍTICO** | Dados de muitos titulares expostos; CPF/telefone vazados; acesso externo confirmado | Imediato — até 2h |
| **ALTO** | Dados acessados por usuário interno não autorizado; CSV enviado para destino errado | Até 24h |
| **MÉDIO** | Suspeita de acesso indevido sem confirmação; dispositivo perdido | Até 72h |
| **BAIXO** | Tentativa de acesso bloqueada; anomalia nos logs | Até 5 dias úteis |

---

## 3. Procedimento de Resposta

### 3.1 Fase 1 — Detecção e Notificação Interna (0–2h)

1. **Identificar** o tipo e escopo do incidente
2. **Notificar imediatamente** o responsável técnico e o DPO (quando nomeado)
3. **Registrar** o incidente com data/hora, descrição, sistema afetado e descobridor
4. **Não apagar** evidências — preservar logs de auditoria (`audit_log`, `audit_exportacoes`)

### 3.2 Fase 2 — Contenção Imediata (0–4h)

Executar conforme o tipo de incidente:

**Acesso não autorizado ao banco:**
```sql
-- Verificar políticas RLS ativas
SELECT tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname = 'public';

-- Se RLS desabilitado, reativar imediatamente:
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
```

**Sessão comprometida de usuário:**
```sql
-- Revogar todas as sessões do usuário afetado no Supabase Dashboard
-- Authentication → Users → [usuário] → Sign out all sessions
```

**Dispositivo perdido com dados offline:**
- Revogar sessão do vendedor no Supabase Dashboard → Authentication → Users
- Os dados offline criptografados (AES-GCM) são inacessíveis sem a chave da sessão revogada

**Exportação CSV para destino errado:**
- Solicitar exclusão imediata do arquivo ao destinatário
- Registrar o incidente e os dados expostos

### 3.3 Fase 3 — Avaliação de Impacto (até 24h)

1. **Quais dados foram expostos?** (nome, telefone, CPF, endereço)
2. **Quantos titulares afetados?**
3. **Houve intenção maliciosa ou foi acidental?**
4. **Os dados já foram usados indevidamente?**
5. **O incidente ainda está ativo?**

Consultar o `audit_log` para rastrear o histórico:
```sql
-- Verificar acessos recentes suspeitos
SELECT usuario_nome, acao, tabela, criado_em
FROM public.audit_log
WHERE criado_em > now() - INTERVAL '48 hours'
ORDER BY criado_em DESC;

-- Verificar exportações recentes
SELECT usuario_nome, filtros, total_registros, exportado_em
FROM public.audit_exportacoes
ORDER BY exportado_em DESC
LIMIT 20;
```

### 3.4 Fase 4 — Notificação (conforme severidade)

**Notificação à ANPD (art. 48 LGPD):**

Obrigatória quando o incidente **pode acarretar risco ou dano relevante** aos titulares. Prazo: **até 72h** após a ciência do incidente.

Canais: portal da ANPD (gov.br/anpd) — notificação eletrônica.

Informações obrigatórias na notificação:
- Data e hora do incidente (ou estimativa)
- Natureza dos dados afetados
- Número de titulares afetados (ou estimativa)
- Medidas de contenção adotadas
- Riscos para os titulares
- Contato do DPO

**Notificação aos titulares:**

Obrigatória quando o incidente pode causar risco ou dano significativo. Deve ser feita em linguagem clara e acessível, informando:
- O que aconteceu
- Quais dados foram afetados
- O que a RJNet está fazendo
- O que o titular pode fazer para se proteger

### 3.5 Fase 5 — Correção e Recuperação

1. Aplicar as correções técnicas necessárias
2. Restaurar backups se houver perda de dados
3. Reforçar controles para evitar recorrência
4. Documentar as medidas adotadas

### 3.6 Fase 6 — Registro e Lições Aprendidas

Preencher o **Registro de Incidente** (seção 5) e realizar reunião de lições aprendidas com:
- O que falhou
- O que funcionou
- O que mudar nos controles, processos ou documentação

---

## 4. Contatos de Emergência

| Papel | Nome | Contato |
|-------|------|---------|
| **Responsável técnico** | _a preencher_ | _a preencher_ |
| **DPO** | _a nomear (PA-19)_ | privacidade@rjnet.com.br _(pendente)_ |
| **ANPD** | Autoridade Nacional de Proteção de Dados | gov.br/anpd |
| **Supabase (incidente no fornecedor)** | Security | security@supabase.io |

---

## 5. Registro de Incidentes

| Campo | Descrição |
|-------|-----------|
| **ID do incidente** | INC-YYYY-NNN |
| **Data de detecção** | |
| **Data de contenção** | |
| **Severidade** | CRÍTICO / ALTO / MÉDIO / BAIXO |
| **Descrição** | |
| **Dados expostos** | |
| **Titulares afetados** | |
| **Causa raiz** | |
| **Medidas de contenção** | |
| **Notificação ANPD** | Sim / Não / N/A — data: |
| **Notificação titulares** | Sim / Não / N/A — data: |
| **Responsável** | |
| **Resolução** | |
| **Lições aprendidas** | |

---

## 6. Histórico de Revisões

| Versão | Data | Autor | Alterações |
|--------|------|-------|-----------|
| 1.0 | 2026-06-16 | Equipe técnica RJNet | Versão inicial — PA-20/LGPD |

---

> Simular um exercício tabletop anualmente para validar o plano.  
> Referência: `doc/lgpd/PLANO_DE_ACAO_LGPD.md` — PA-20.
