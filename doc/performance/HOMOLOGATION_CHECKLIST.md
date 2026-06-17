# HOMOLOGATION_CHECKLIST.md
# Checklist de Preparação do Ambiente de Homologação

> Gerado em: 2026-06-17  
> **Nenhum teste deve utilizar o ambiente de produção.**  
> Este documento é o guia completo para provisionar o ambiente de homologação antes da execução do Cenário A.

---

## Status Atual

| Item | Status |
|------|--------|
| Ambiente de produção configurado | ✅ (Vercel + Supabase) |
| Migrations QW-001 e QW-002 aplicadas em produção | ✅ Aplicado em 2026-06-17 |
| Ambiente de homologação separado | ❌ Não existe — criar conforme este documento |
| Scripts de teste k6 prontos | ✅ (`tests/load/`) |
| Scripts de cleanup prontos | ✅ (`tests/load/cleanup.js`) |

---

## Seção 1 — Banco de Dados Separado

### 1.1 Criar projeto Supabase de homologação

- [ ] Acessar https://supabase.com → New Project
- [ ] Nome sugerido: `rjnet-homolog` (ou `rjnet-test`)
- [ ] Região: mesma do projeto de produção (reduz latência nos testes)
- [ ] Anotar: **Project URL** e **anon key** e **service_role key**
- [ ] **Nunca usar as credenciais de produção aqui**

### 1.2 Aplicar migrações (ordem obrigatória)

Execute cada script no **SQL Editor** do projeto de homologação:

| Ordem | Arquivo | Status |
|-------|---------|--------|
| 1 | `supabase/schema.sql` | ⬜ Pendente |
| 2 | `supabase/migracao-auth.sql` | ⬜ Pendente |
| 3 | `supabase/protecao-dados.sql` | ⬜ Pendente |
| 4 | `supabase/migracao-consentimento.sql` | ⬜ Pendente |
| 5 | `supabase/migracao-audit-exportacoes.sql` | ⬜ Pendente |
| 6 | `supabase/migracao-soft-delete-audit.sql` | ⬜ Pendente |
| 7 | `supabase/migracao-readd-cpf.sql` | ⬜ Pendente |
| 8 | **`supabase/fix-ranking-deletado.sql`** (QW-001) | ✅ Aplicado em produção (2026-06-17) |
| 9 | **`supabase/perf-indices-compostos.sql`** (QW-002) | ✅ Aplicado em produção (2026-06-17) |

### 1.3 Verificar estado do banco

Execute `supabase/verificar-migracao-auth.sql` e confirme:

- [ ] Políticas anônimas: **0 linhas** (acesso anônimo bloqueado)
- [ ] Tabela `perfis`: **existe**
- [ ] Coluna `deletado` em `leads`: **existe**
- [ ] Coluna `vendedor_id` em `leads`: **existe**
- [ ] Função `papel_atual()`: **existe**
- [ ] Função `ranking_evento()`: **existe** (com o fix do QW-001 aplicado)
- [ ] Policies por papel: **≥ 8 linhas** com `authenticated`

### 1.4 Confirmar índices criados

Execute no SQL Editor:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'leads' AND schemaname = 'public'
ORDER BY indexname;
```

Resultado esperado (9 índices):
- `idx_leads_ativos_criado_em` (QW-002)
- `idx_leads_criado_em` (schema.sql)
- `idx_leads_deletado` (protecao-dados.sql)
- `idx_leads_evento` (schema.sql)
- `idx_leads_evento_deletado` (QW-002)
- `idx_leads_ranking` (QW-002)
- `idx_leads_vendedor` (migracao-auth.sql)
- `leads_pkey`
- (qualquer índice adicional das migrações de audit)

---

## Seção 2 — Variáveis de Ambiente Separadas

### 2.1 Arquivo `.env.homolog` (não commitar)

Criar localmente (não adicionar ao git):
```bash
# Ambiente de homologação — NUNCA usar credenciais de produção aqui
VITE_SUPABASE_URL=https://[projeto-homolog].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key-homolog]

# Para os scripts k6
TEST_SUPABASE_URL=https://[projeto-homolog].supabase.co
TEST_SUPABASE_ANON_KEY=[anon-key-homolog]
TEST_SUPABASE_SERVICE_KEY=[service-role-key-homolog]
TEST_MARKETING_EMAIL=test.marketing@rjnet.invalid
TEST_MARKETING_PASS=TestMarketing@2026!
TEST_VENDEDOR_PASS=TestVendedor@2026!
```

### 2.2 Verificar isolamento

- [ ] `TEST_SUPABASE_URL` aponta para URL diferente do projeto de produção
- [ ] `TEST_SUPABASE_ANON_KEY` é diferente da anon key de produção
- [ ] `.env.homolog` está no `.gitignore`

---

## Seção 3 — Usuários de Teste com Dados Fictícios

### 3.1 Criar usuário marketing de teste

No Supabase Dashboard de homologação → Authentication → Users → Add user:
- E-mail: `test.marketing@rjnet.invalid`
- Senha: `TestMarketing@2026!`
- Marcar: Auto Confirm User

Ativar no SQL Editor:
```sql
UPDATE public.perfis
SET papel = 'marketing', ativo = true
WHERE email = 'test.marketing@rjnet.invalid';
```

### 3.2 Criar vendedores de teste (20 usuários)

Para cada N de 1 a 20, criar via Dashboard ou script:
- E-mail: `test.vendedor{N}@rjnet.invalid`
- Senha: `TestVendedor@2026!`
- Marcar: Auto Confirm User

Ativar todos:
```sql
UPDATE public.perfis
SET papel = 'vendedor', ativo = true
WHERE email LIKE 'test.vendedor%@rjnet.invalid';
```

### 3.3 Confirmar criação

- [ ] 1 usuário marketing criado e ativo
- [ ] 20 usuários vendedor criados e ativos
- [ ] Teste de login manual para 1 marketing e 1 vendedor
- [ ] Todos os e-mails terminam em `.invalid` (domínio não existente — sem risco de envio real)

---

## Seção 4 — Dados Fictícios

Todos os dados gerados pelos testes k6 devem:

- [ ] Usar CPF: `null` ou `000.000.000-00` (inválido)
- [ ] Usar telefone: `(00) 00000-0000` (inválido)
- [ ] Usar e-mails: `@rjnet.invalid` ou `@test.invalid`
- [ ] Usar observação: `Lead gerado automaticamente por teste de carga k6` (marcador para cleanup)
- [ ] Evento de teste com observação: `[REMOVER] Criado por teste de carga k6`

**Verificação pós-teste:**
```sql
-- Confirmar que NENHUM dado real foi inserido
SELECT COUNT(*) FROM leads
WHERE telefone NOT IN ('(00) 00000-0000', NULL)
  AND observacao != 'Lead gerado automaticamente por teste de carga k6';
-- Resultado esperado: 0 (apenas dados de teste)
```

---

## Seção 5 — Logs e Monitoramento

### 5.1 Supabase Dashboard

Habilitar e monitorar durante os testes:

- [ ] **Database → Query Performance** — ver queries lentas em tempo real
- [ ] **Database → Usage** — conexões, transferência, storage
- [ ] **API → Usage** — requests por segundo
- [ ] **Realtime → Realtime** — conexões WebSocket ativas

### 5.2 Alertas a configurar

Antes de executar o Cenário C ou D:
- [ ] Abrir Supabase Dashboard em segundo monitor
- [ ] Manter `Database → Query Performance` visível
- [ ] Anotar baseline: número de conexões, requests/min antes do teste

### 5.3 Métricas a registrar manualmente

| Momento | Database Connections | API req/min | Realtime conns |
|---------|---------------------|-------------|----------------|
| Antes (baseline) | | | |
| Durante pico | | | |
| Após (recovery) | | | |

---

## Seção 6 — Processo de Cleanup

### 6.1 Após cada sessão de testes

```bash
# Obter o evento_id criado no setup do cenário (exibido no output do k6)
export TEST_EVENTO_ID="[uuid]"
k6 run tests/load/cleanup.js
```

### 6.2 Verificação pós-cleanup

```sql
-- Deve retornar 0 após cleanup bem-sucedido
SELECT COUNT(*) FROM leads
WHERE observacao = 'Lead gerado automaticamente por teste de carga k6';

SELECT COUNT(*) FROM eventos
WHERE observacoes LIKE '%[REMOVER]%';
```

- [ ] Leads de teste removidos: 0
- [ ] Eventos de teste removidos: 0

---

## Seção 7 — Checklist Final de Aprovação

Marcar todos antes de executar qualquer cenário:

### Banco
- [ ] Projeto Supabase de homologação criado (URL diferente da produção)
- [ ] Todas as 9 migrações aplicadas (incluindo QW-001 e QW-002)
- [ ] Estado do banco verificado via `verificar-migracao-auth.sql`
- [ ] Índices compostos confirmados (9 índices em `leads`)

### Ambiente
- [ ] Variáveis `.env.homolog` configuradas e testadas
- [ ] `.env.homolog` no `.gitignore`
- [ ] App rodando em modo Supabase com o projeto de homologação (`npm run dev`)
- [ ] Login manual funcionando para marketing e vendedor de teste

### Usuários e Dados
- [ ] 1 usuário marketing ativo
- [ ] ≥ 5 usuários vendedor ativos (mínimo para Cenário A)
- [ ] Sem dados reais no banco de homologação

### Scripts de Teste
- [ ] k6 instalado: `k6 version` retorna ≥ 0.50.0
- [ ] Variáveis de ambiente do k6 exportadas
- [ ] `cleanup.js` testado com um evento dummy

### Aprovação
- [ ] Responsável técnico aprovou a execução
- [ ] Data e hora definidas para o teste
- [ ] Supabase Dashboard aberto para monitoramento

---

## Notas de Segurança

1. **Nunca compartilhar** a `service_role key` do ambiente de homologação em repositórios, chats ou e-mails
2. **Limitar acesso** ao projeto de homologação no Supabase para o time de testes
3. **Não reutilizar senhas** de exemplo (`TestMarketing@2026!`) em produção
4. **Deletar** o projeto de homologação após o ciclo de testes se não for mais necessário (evita custo e riscos)
