# UX/UI V3 — Proposta de Redesign Visual

> **Status:** APROVADO pelo usuário — implementação autorizada em fases.
> **Data:** 2026-06-18
> **Contexto:** V2 entregou refinamentos técnicos corretos mas sem impacto visual perceptível.
> V3 é um redesign visual real — mantém toda a lógica de negócio, altera profundamente a aparência e usabilidade.
> **Princípio central:** 100% mobile-first. Marketing e Vendedor usam o sistema no celular.

---

## 1. Diagnóstico da V2

| Problema | Impacto |
|----------|---------|
| Superfícies flat sem profundidade | Interface parece sem vida |
| Tipografia sem escala — tudo parece igual | Hierarquia visual inexistente |
| Amarelo RJNet usado só em botões | Identidade da marca desperdiçada |
| Navegação do marketing em abas horizontais pequenas | Difícil de tocar em mobile |
| Formulário do Vendedor em lista rolável | Cansativo, parece formulário de papel |
| Cards de evento neutros, sem personalidade | Tudo parece igual, sem destaque |
| Nenhuma micro-interação ou animação | Interface parece estática, anos 2010 |

---

## 2. Direção Visual

### Identidade
**Preto profundo + Amarelo RJNet como protagonista.**

O amarelo `#ffcb00` deixa de ser detalhe e vira o fio condutor da interface:
- Indica o que está ativo
- Destaca os números mais importantes
- Marca o progresso e conquistas
- Aparece como gradiente suave nos elementos de destaque

### Paleta atualizada

```css
/* Fundos — hierarquia de profundidade */
--bg:        #090909;   /* fundo base — mais escuro, mais profundo */
--surface:   #111111;   /* cards */
--surface2:  #1a1a1a;   /* elementos dentro do card */
--surface3:  #222222;   /* hover, selecionado */

/* Bordas — mais sutis */
--border:    #2a2a2a;
--border-2:  #333333;   /* bordas mais visíveis quando necessário */

/* Amarelo RJNet */
--yellow:         #ffcb00;
--yellow-dim:     rgba(255, 203, 0, 0.10);
--yellow-glow:    rgba(255, 203, 0, 0.20);

/* Tipografia */
--text:      #f4f4f4;
--text-2:    #aaaaaa;
--text-3:    #666666;

/* Status */
--green:     #22c55e;
--red:       #ef4444;
--blue:      #60a5fa;
--orange:    #fb923c;
```

### Sombras e Elevação

```css
--shadow-card:  0 1px 3px rgba(0,0,0,.4), 0 4px 16px rgba(0,0,0,.3);
--shadow-float: 0 8px 32px rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.4);
--shadow-glow:  0 0 0 1px var(--border), 0 4px 16px rgba(0,0,0,.3);
```

### Raios e Espaçamento

```css
--radius:    14px;   /* cards (era 10px) */
--radius-sm: 8px;    /* elementos internos */
--radius-lg: 20px;   /* modais, sheets */
```

---

## 3. Navegação — Mobile First

### Marketing (você)
Hoje: abas horizontais no topo, pequenas, difíceis de tocar.
V3: **bottom nav** igual ao Vendedor — 5 itens principais.

```
[ Início ] [ Eventos ] [ Equipe ] [ Check-in ] [ Mais ⋯ ]
```

O "Mais ⋯" abre um bottom sheet com: Estoque, Relatórios, Monitor.
Desta forma apenas as 4 telas mais usadas ficam no nav principal.

### Vendedor
Já tem 3 botões após a V2. V3 melhora o visual:
- Ícone **preenchido** quando ativo (não só cor diferente)
- **Pill amarela** embaixo do item ativo
- Altura maior (72px), toque mais fácil

---

## 4. Dashboard (primeira tela)

### Antes
KPIs em grid pequeno + gráfico donut genérico.

### Depois
**Hero card** no topo com evento ativo atual:
```
┌─────────────────────────────────┐
│  EVENTO ATIVO                   │
│  Nome do Evento Grande          │
│  📍 Local · 18 jun → 20 jun    │
│                                 │
│  [ 127 leads ]  [ 8 vendedores ]│
└─────────────────────────────────┘
```

Abaixo: KPIs com número grande (48px) e label pequena embaixo.
Substituir donut por **barras horizontais** de serviços — mais legível em mobile.

---

## 5. Cards de Evento

### Antes
Retângulos neutros, todos iguais.

### Depois
Borda esquerda grossa colorida por status:
- 🟡 Amarelo = Ativo
- ⚪ Cinza = Planejado
- ⬛ Escuro = Encerrado

Tipografia com hierarquia:
```
│█ Nome do Evento                    [Ativo] │
│  📍 Angra dos Reis · 18–20 jun            │
│  ─────────────────────────────────────    │
│  127 leads          [A] [B] [C] +4        │
```

---

## 6. Formulário do Vendedor — Wizard 3 Etapas

### Por que wizard?
O formulário atual tem 8 campos numa lista. Em campo, com sol, pressa e celular na mão, é desgastante. O wizard divide em 3 telas limpas, cada uma com 1-2 campos, cabendo sem rolar.

### Estrutura

```
[●──────────] Etapa 1 de 3

  Nome completo *
  ┌─────────────────────────┐
  │ João da Silva           │
  └─────────────────────────┘

  Telefone *
  ┌─────────────────────────┐
  │ (24) 99999-9999         │
  └─────────────────────────┘

        [ Próximo → ]
```

```
[●●─────────] Etapa 2 de 3

  Serviço de interesse *

  ┌──────────────┐ ┌──────────────┐
  │  🌐          │ │  📶          │
  │  Internet    │ │  Móvel       │
  │  Residencial │ │              │
  └──────────────┘ └──────────────┘
  ┌──────────────┐ ┌──────────────┐
  │  💼          │ │  📦          │
  │  Empresarial │ │  Outro       │
  └──────────────┘ └──────────────┘

  [ ← Voltar ]       [ Próximo → ]
```

```
[●●●────────] Etapa 3 de 3

  Temperatura

  [ Frio ] [ Morno ] [ Quente ] [ Convertido ]

  Observação (opcional)
  ┌─────────────────────────┐
  │                         │
  └─────────────────────────┘

  [ ← Voltar ]    [ ✓ Registrar ]
```

Modo rápido: pula etapa 3 direto para o submit após etapa 2.

---

## 7. Micro-interações

| Elemento | Interação |
|----------|-----------|
| Cards | `transform: translateY(-2px)` no hover/focus |
| Botão primário | Ripple effect ao clicar |
| Toast | Slide from bottom + fade out |
| Troca de aba | Fade 150ms |
| Wizard | Slide horizontal entre etapas |
| Barra de meta | Preenchimento animado ao carregar |
| Bottom nav ativo | Pill amarela com spring animation |

---

## 8. Checklist de Garantias

Antes de cada commit:
- [ ] Nenhuma função de negócio alterada (addLead, updateLead, etc.)
- [ ] Nenhum dado removido ou reorganizado
- [ ] Rollback possível com `git revert <hash>`
- [ ] Funciona em 375px (iPhone SE)
- [ ] Dark mode sem quebras (light mode secundário)
- [ ] Sem novo JS para animações — apenas CSS transitions

---

## 9. O que NÃO muda

- Toda a lógica de `useApp`, `dataService`, `AppProvider`
- Schema do banco e RLS do Supabase
- Fluxo de autenticação
- Exportação de CSV
- Monitor de diagnóstico
- Nenhum campo de formulário removido (apenas reorganizados no wizard)

---

## 10. Referências de estilo

O resultado final deve lembrar:
- **Linear.app** — dark, limpo, tipografia forte
- **Vercel dashboard** — preto profundo, hierarquia clara
- **Raycast** — amarelo/accent como fio condutor
- Com a identidade **RJNet**: preto e amarelo, direto ao ponto

---

*Proposta aprovada verbalmente em 2026-06-18. Implementar conforme plano em doc/ui/UX_UI_V3_IMPLEMENTATION_PLAN.md.*
