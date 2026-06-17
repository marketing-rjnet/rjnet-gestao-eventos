# Testes de Carga — RJNet Gestão de Eventos

> **ATENÇÃO: Não executar sem aprovação explícita do responsável técnico.**  
> Todos os cenários usam dados fictícios e ambiente de homologação separado do produção.

## Pré-requisitos

```bash
# 1. Instalar k6
# Linux:
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS:
brew install k6

# 2. Configurar variáveis de ambiente (projeto Supabase de HOMOLOGAÇÃO)
export TEST_SUPABASE_URL="https://[projeto-homolog].supabase.co"
export TEST_SUPABASE_ANON_KEY="[anon-key-homolog]"
export TEST_SUPABASE_SERVICE_KEY="[service-role-key-homolog]"  # apenas para cleanup
export TEST_MARKETING_EMAIL="test.marketing@rjnet.invalid"
export TEST_MARKETING_PASS="TestMarketing@2026!"
export TEST_VENDEDOR_PASS="TestVendedor@2026!"

# 3. Aplicar migrações no banco de homologação (ver LOAD_TEST_PLAN.md seção 3)
# 4. Criar usuários de teste no Supabase Dashboard de homologação
```

## Execução por Cenário

```bash
# Cenário A — Operação Normal (seguro para executar primeiro)
k6 run tests/load/scenario-a-normal.js

# Cenário B — Pico Operacional
k6 run tests/load/scenario-b-pico.js

# Cenário C — Evento Crítico (requer monitoramento ativo do Supabase Dashboard)
k6 run tests/load/scenario-c-evento-critico.js

# Cenário D — Estresse (somente após aprovação adicional)
k6 run tests/load/scenario-d-estresse.js
```

## Saída com Relatório HTML

```bash
k6 run --out json=results/scenario-a.json tests/load/scenario-a-normal.js
# Depois converter para HTML com k6-to-html ou grafana/k6-reporter
```

## Cleanup (OBRIGATÓRIO após cada execução)

```bash
export TEST_EVENTO_ID="[uuid retornado no setup do cenário]"
k6 run tests/load/cleanup.js
```

## Estrutura dos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `config.js` | Configuração compartilhada (URLs, usuários, dados fictícios) |
| `helpers.js` | Funções reutilizáveis (login, saveLead, fetchAll, etc.) |
| `scenario-a-normal.js` | Cenário A — 5 vendedores + 1 marketing, 10 min |
| `scenario-b-pico.js` | Cenário B — 15 vendedores + 2 marketing, 18 min |
| `scenario-c-evento-critico.js` | Cenário C — 20 vendedores + flush offline, 8 min |
| `scenario-d-estresse.js` | Cenário D — ramp-up até 100 VUs, 12 min |
| `cleanup.js` | Remove todos os dados de teste do ambiente de homologação |

## Documentação Relacionada

- `doc/performance/ARCHITECTURE_TEST_SUMMARY.md` — análise arquitetural e fluxos críticos
- `doc/performance/LOAD_TEST_COST_ESTIMATE.md` — estimativa de impacto e custo
- `doc/performance/LOAD_TEST_PLAN.md` — plano detalhado de execução
- `doc/performance/LOAD_TEST_REPORT.md` — template de relatório (preencher após execução)
- `doc/performance/PERFORMANCE_AUDIT.md` — auditoria de gargalos identificados
- `doc/performance/PERFORMANCE_HISTORY.md` — histórico de execuções

## Critérios de Aprovação

| Métrica | Limite (Cenários A/B/C) |
|---------|------------------------|
| Taxa de erro | < 1% |
| Tempo médio | < 500ms |
| P95 | < 1000ms |
| P99 | < 2000ms |
| Perda de dados | 0 |
| Duplicatas | 0 |
