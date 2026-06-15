# DOCUMENTO MESTRE — REFATORAÇÃO DO CRM DE EVENTOS RJNET

## Objetivo Geral

Refatorar progressivamente o projeto sem alterar comportamento, apenas reorganizando a arquitetura.

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

## Estrutura da Refatoração

O plano possui 18 etapas.

---

## STATUS ATUAL

Atualize esta seção ao iniciar cada novo chat.

```
Progresso geral: 2/18 etapas concluídas (11%)
```

```
Observações:


```

```
Etapa 1  - ✅ Concluída
Etapa 2  - ✅ Concluída
Etapa 3  - ⬜ Não iniciada
Etapa 4  - ⬜ Não iniciada
Etapa 5  - ⬜ Não iniciada
Etapa 6  - ⬜ Não iniciada
Etapa 7  - ⬜ Não iniciada
Etapa 8  - ⬜ Não iniciada
Etapa 9  - ⬜ Não iniciada
Etapa 10 - ⬜ Não iniciada
Etapa 11 - ⬜ Não iniciada
Etapa 12 - ⬜ Não iniciada
Etapa 13 - ⬜ Não iniciada
Etapa 14 - ⬜ Não iniciada
Etapa 15 - ⬜ Não iniciada
Etapa 16 - ⬜ Não iniciada
Etapa 17 - ⬜ Não iniciada
Etapa 18 - ⬜ Não iniciada
```

---

## Fluxo Obrigatório para Cada Etapa

### Antes de executar:

1. Ler o código atual.
2. Verificar se etapas anteriores realmente foram concluídas.
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
- Identificar a próxima etapa pendente.
- Analisar o código enviado.
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

### Fase 1

- Etapa 1 — Format Utils
- Etapa 2 — Masks e Validators
- Etapa 3 — CSV Utils
- Etapa 4 — Mock Data e Pacotes
- Etapa 5 — Constants

### Fase 2

- Etapa 6 — UI Components
- Etapa 7 — SyncBadge + useApp

### Fase 3

- Etapa 8 — Auth Components

### Fase 4

- Etapa 9 — Modais

### Fase 5

- Etapa 10 — Dashboard + Eventos
- Etapa 11 — Estoque + Leads + Checkin
- Etapa 12 — Equipe

### Fase 6

- Etapa 13 — VendedorApp

### Fase 7

- Etapa 14 — App + Layout Shells

### Fase 8

- Etapa 15 — Domain Hooks

### Fase 9

- Etapa 16 — Infraestrutura
- Etapa 17 — APIs por Domínio

### Fase 10

- Etapa 18 — Centralização do Dual Mode

---

## Instrução Final para o Claude

Sempre considere este documento como a fonte da verdade.
Nunca avance etapas sozinho.
Nunca pule validações.
Sempre trabalhe sobre o estado atual do código.
Se houver divergência entre o plano e o código atual, informe antes de modificar qualquer arquivo.
Ao final de cada etapa, atualize o progresso percentual da refatoração.
