# UX/UI V3 — Changelog de Implementação

> Registro oficial de cada etapa implementada com hashes git, arquivos e rollback.
> Nunca apagar entradas — apenas adicionar.

---

## Ponto de Restauração V3

| Nome | Hash | Data | Descrição |
|------|------|------|-----------|
| **Início V3** | — | 2026-06-18 | Estado após merge da V2. Ponto de partida da V3. |

---

## Fase D — Design System

### D-01 — Nova paleta de cores e variáveis CSS
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `f6794d4` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/index.css` |
| **Rollback** | `git revert f6794d4 --no-edit && git push` |

---

### D-02 — Cards com profundidade e sombra
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `08ccc2c` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/index.css` |
| **Rollback** | `git revert 08ccc2c --no-edit && git push` |

---

### D-03 — Tipografia com escala e hierarquia
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `448d54a` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/index.css` |
| **Rollback** | `git revert 448d54a --no-edit && git push` |

---

### D-04 — Micro-interações CSS
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `348e5ae` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/index.css` |
| **Rollback** | `git revert 348e5ae --no-edit && git push` |

---

## Fase E — Navegação

### E-01 — Bottom nav do Marketing (mobile)
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `176ab94` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/apps/MarketingApp.jsx`, `src/index.css` |
| **Rollback** | `git revert 176ab94 --no-edit && git push` |

---

### E-02 — Redesign visual dos bottom navs
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `7b4441a` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/index.css` |
| **Rollback** | `git revert 7b4441a --no-edit && git push` |

---

### E-03 — Cards de evento com borda colorida por status
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `3cb0048` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/features/events/EventosTab.jsx`, `src/index.css` |
| **Rollback** | `git revert 3cb0048 --no-edit && git push` |

---

## Fase F — Telas Principais

### F-01 — Dashboard redesenhado
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `8c55665` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/features/events/Dashboard.jsx`, `src/index.css` |
| **Rollback** | `git revert 8c55665 --no-edit && git push` |

---

### F-02 — Wizard etapa 1 (Nome + Telefone)
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `da35758` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/apps/VendedorApp.jsx`, `src/index.css` |
| **Rollback** | `git revert da35758 --no-edit && git push` |

---

### F-03 — Wizard etapa 2 (Serviço visual)
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `da35758` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/apps/VendedorApp.jsx`, `src/index.css` |
| **Rollback** | `git revert da35758 --no-edit && git push` |

---

### F-04 — Wizard etapa 3 (Temperatura + opcionais)
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `da35758` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/apps/VendedorApp.jsx`, `src/index.css` |
| **Rollback** | `git revert da35758 --no-edit && git push` |

---

### F-05 — Animação da barra de meta
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `f04a3f9` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/index.css` |
| **Rollback** | `git revert f04a3f9 --no-edit && git push` |

---

### F-06 — Toast redesenhado
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `409bc28` |
| **Data** | 2026-06-18 |
| **Arquivos** | `src/index.css` |
| **Rollback** | `git revert 409bc28 --no-edit && git push` |

---

## Testes E2E — Pós-V3

### T-01 — Atualização dos testes E2E para V3
| Campo | Valor |
|-------|-------|
| **Status** | ✅ CONCLUÍDO |
| **Hash** | `1ebec43` (squash → `d98e85f`) |
| **Data** | 2026-06-18 |
| **PR** | #47 |
| **Arquivos** | `tests/helpers/auth.js`, `tests/comercial.test.js`, `tests/navegacao.test.js`, `tests/formularios.test.js` |
| **Rollback** | `git revert d98e85f --no-edit && git push` |

**Mudanças:**
- `loginComercial` adicionado ao helper de auth (era importado mas não existia)
- `comercial.test.js`: reescrito para wizard 3 etapas; 13 testes cobrindo modo rápido, voltar, validação, ranking, eventos sem ativo
- `navegacao.test.js`: 7 tabs desktop, "Início" como padrão, hero card, vendedor bottom nav 3 botões
- `formularios.test.js`: botão Próximo disabled etapa 1, tab "Relatórios", wizard no fluxo lead→marketing

---

## Checklist Geral

### Fase D
- [x] D-01 — Nova paleta
- [x] D-02 — Sombras nos cards
- [x] D-03 — Tipografia
- [x] D-04 — Micro-interações

### Fase E
- [x] E-01 — Bottom nav Marketing
- [x] E-02 — Redesign bottom navs
- [x] E-03 — Cards por status

### Fase F
- [x] F-01 — Dashboard
- [x] F-02 — Wizard etapa 1
- [x] F-03 — Wizard etapa 2
- [x] F-04 — Wizard etapa 3
- [x] F-05 — Barra de meta
- [x] F-06 — Toast

### Testes E2E
- [x] T-01 — Testes E2E atualizados para V3 (#47)
