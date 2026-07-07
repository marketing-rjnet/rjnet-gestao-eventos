# Boas Práticas e Dicas do Sistema

> Guia de referência para trabalhar com segurança no projeto RJNet Gestão de Eventos.
> Atualizado conforme novas práticas são adotadas.

---

## 1. Fluxo de Desenvolvimento Seguro

### O ciclo correto para qualquer mudança

```
1. Desenvolver na branch de trabalho (nunca direto na main)
        ↓
2. Abrir um Pull Request no GitHub
        ↓
3. A Vercel gera automaticamente uma URL de preview
        ↓
4. Testar na URL de preview (sem afetar produção)
        ↓
5. Aprovar → fazer merge na main
        ↓
6. Vercel faz deploy automático em produção
        ↓
7. Se algo der errado → git revert + push (produção volta em < 2min)
```

### Por que não commitar direto na main?

- Qualquer erro vai direto para produção sem chance de testar antes.
- Sem PR, a Vercel não gera URL de preview.
- Sem PR, não há registro visual das mudanças para revisão posterior.

---

## 2. URL de Preview (Vercel)

A Vercel gera uma URL de preview automaticamente quando um **Pull Request é aberto**.

### Como funciona

- PR aberto → Vercel faz build → posta a URL nos comentários do PR.
- A cada novo commit na branch, a URL de preview **atualiza automaticamente**.
- A URL de preview é independente da produção — você pode testar à vontade.
- Quando o PR é mergeado na main → deploy automático em produção.

### Formato da URL de preview

```
https://<projeto>-git-<branch-slug>-<team>.vercel.app
```

### O que testar na preview

Sempre verificar:
- [ ] Dark mode funcionando
- [ ] Light mode funcionando (toggle no canto superior direito do login)
- [ ] Responsivo: testar em mobile (DevTools → modo responsivo)
- [ ] Ação principal da tela funciona (criar evento, registrar lead, etc.)
- [ ] Nenhuma tela em branco ou erro de JS no console
- [ ] Login e fluxo principal testados nos três papéis quando a mudança pode afetá-los: `marketing`, `comercial` e `vendedor` (o `comercial` tem shell próprio, `ComercialApp.jsx`, sem estoque/equipe/monitor — D-059)
- [ ] Se a mudança tocar o Form Builder ou o formulário público: testar `/f/:slug` sem login (aba anônima), incluindo o bloqueio de link em texto livre e a mensagem de rate limit (D-067)

---

## 3. Git — Comandos Essenciais de Segurança

### Ver o histórico de commits

```bash
git log --oneline
```

### Desfazer o último commit (mantém o histórico)

```bash
git revert HEAD --no-edit && git push
```

### Desfazer um commit específico pelo hash

```bash
git revert <hash> --no-edit && git push
```

### Ver o que um commit alterou antes de reverter

```bash
git show <hash> --stat
```

### Ver como um arquivo estava em um commit passado

```bash
git show <hash>:src/index.css
```

### Desfazer vários commits em sequência (ex: uma fase inteira)

```bash
# Reverte do commit mais novo até o mais antigo do intervalo
git revert <hash-mais-novo>..<hash-mais-antigo> --no-edit
git push
```

### Voltar ao estado de produção estável (opção segura)

```bash
# Substitua o hash pelo ponto de restauração desejado (ver doc/ui/historico/UX_UI_V2_CHANGELOG.md)
git revert <hash-inicio-das-mudancas>..HEAD --no-edit
git push
```

### ⚠️ Opção destrutiva (usar só em emergência, em branch de teste)

```bash
git reset --hard <hash>
git push --force
# CUIDADO: apaga commits do histórico. Preferir sempre o git revert.
```

---

## 4. Pontos de Restauração

Consulte `doc/ui/UI_VERSIONS.md` para o catálogo vigente de versões (V3 é a versão atual em produção); `doc/ui/historico/UX_UI_V2_CHANGELOG.md` para a lista histórica detalhada da V2 (22/22 etapas concluídas, superada pela V3 no mesmo dia).

| Nome | Descrição |
|------|-----------|
| **V1 produção estável** | Estado antes de qualquer mudança de UI/UX V2 |
| **Início da V2** | Após cor `#ffcb00` e plano de implementação |
| **V3 produção estável** | Redesign visual completo (2026-06-18) — versão vigente; evoluções incrementais desde então (papel comercial, Form Builder/QR Code, navegação "Mais" agrupada) estão documentadas em `doc/ui/UI_VERSIONS.md` § "O que mudou depois do lançamento da V3" |

---

## 5. Commits Atômicos

### O que é um commit atômico?

Um commit que faz **uma única coisa** e pode ser revertido sem afetar outras mudanças.

**Bom:**
```
fix(ui): aumenta contraste --text-3 de #666 para #777
```

**Ruim:**
```
várias mudanças de CSS + novo componente + correção de bug
```

### Por que importa?

Se você não gostou do hover amarelo nos cards (A-05), mas gostou de tudo mais, é possível reverter **só o A-05** sem perder os outros 11 itens da Fase A — porque cada um tem seu próprio commit.

Se tudo estivesse num commit só, você perderia tudo ou não reverteria nada.

### Convenção de mensagem de commit

```
<tipo>(<escopo>): <descrição no imperativo> [D-XXX]
```

| Tipo | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug ou comportamento incorreto |
| `docs` | Só documentação, sem mudança de código |
| `refactor` | Reorganização de código sem mudar comportamento |
| `perf` | Melhoria de performance mensurável |

O escopo é o domínio afetado (`ofertas`, `vendedor`, `estoque`, `monitor`, etc.). Quando o commit implementa ou fecha uma decisão registrada em `DECISIONS.md`, referenciar o ID no final (`(D-057)`) — facilita rastrear no `git log` qual commit corresponde a qual decisão.

**Exemplos reais do projeto:**
```
feat(ofertas): baixar imagem via blob em vez de abrir em nova aba (D-057)
fix(vendedor): move editar/excluir lead pra ícones discretos no topo do card
docs: fecha lacunas de documentação da sessão de Ofertas (D-057)
```

### Onde registrar cada tipo de mudança

Nem toda mudança precisa dos quatro documentos — regra prática:

| Mudança | Registrar em |
|---------|--------------|
| Decisão arquitetural, de padrão ou "por que escolhemos X e não Y" | `doc/architecture/DECISIONS.md` (novo D-XXX) |
| Qualquer mudança que afete o comportamento do sistema em produção | `doc/CHANGELOG.md` (nova versão) |
| Mudança na estrutura de pastas, fluxo de dados ou regra técnica vigente | `doc/architecture/SYSTEM_MAP.md` (e `CLAUDE.md` se afetar a árvore de diretórios) |
| Mudança de schema, RLS ou migração no Supabase | `doc/architecture/SUPABASE.md` |
| Mudança que envolve coleta/armazenamento de dado pessoal | `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` + `doc/lgpd/PLANO_DE_ACAO_LGPD.md` |
| Ajuste pontual de UI sem mudar fluxo (cor, espaçamento, texto) | Só o commit já basta — não precisa de entrada em doc |

Uma feature típica (como D-057/D-058) toca DECISIONS + CHANGELOG + SYSTEM_MAP + SUPABASE no mesmo PR. Um `fix` de UI isolado normalmente não precisa de nenhum.

---

## 6. Documentação Obrigatória por Fase

Antes de implementar qualquer mudança de interface, ler `doc/ui/UI_VERSIONS.md` — é o catálogo **vigente** (paleta, navegação, telas, componentes por versão; V3 é a versão atual em produção). Depois de implementar, atualizar essa mesma seção do arquivo com o que mudou.

Os três documentos abaixo são o **histórico da V2** (22/22 etapas concluídas em 2026-06-18, superada pela V3 no mesmo dia) — mantidos como referência de processo e de diagnóstico de UX, não como leitura obrigatória para novas mudanças:

| Documento | Conteúdo histórico |
|-----------|-----------|
| `doc/ui/historico/UX_UI_V2_PROPOSAL.md` | Auditoria e proposta que originaram a V2 |
| `doc/ui/historico/UX_UI_V2_IMPLEMENTATION_PLAN.md` | Plano detalhado por etapa da V2 |
| `doc/ui/historico/UX_UI_V2_CHANGELOG.md` | O que foi feito na V2, hashes e status |

Os equivalentes da V3 (`doc/ui/UX_UI_V3_PROPOSAL.md`, `UX_UI_V3_IMPLEMENTATION_PLAN.md`, `UX_UI_V3_CHANGELOG.md`) seguem o mesmo padrão para a versão atual.

---

## 7. Hierarquia de Aprovação

Modelo de processo usado nos redesigns V2 e V3 — reaplicar em qualquer redesign visual futuro (proposta → plano → implementação por fase → validação em preview → merge):

```
Proposta (doc/ui/UX_UI_VN_PROPOSAL.md)
    ↓ aprovação explícita necessária
Plano de implementação (UX_UI_VN_IMPLEMENTATION_PLAN.md)
    ↓ aprovação explícita necessária
Implementação por fase
    ↓ validação em preview antes do merge
Merge na main → produção
```

**Nunca pular etapas.** A versão de produção vigente (hoje V3) é sempre o baseline de segurança. Mudanças incrementais que não são um redesign completo (ex.: papel comercial, Form Builder) não precisam desse ciclo completo — só registrar em `DECISIONS.md`/`SYSTEM_MAP.md`/`UI_VERSIONS.md` conforme a tabela da seção 5.

---

## 8. Testar Interface em Mobile (sem celular)

No navegador, abrir DevTools (F12) e ativar o modo responsivo:

- **Chrome/Edge:** DevTools → ícone de celular (Ctrl+Shift+M)
- **Firefox:** DevTools → ícone de responsivo

Tamanhos importantes para testar:

| Dispositivo | Largura |
|-------------|---------|
| iPhone SE | 375px |
| iPhone 14 | 390px |
| Android médio | 412px |
| Tablet | 768px |
| Desktop | 1280px |

O app do Vendedor e a página pública do formulário (`/f/:slug`, `FormularioPublico.jsx`) foram projetados para **375–480px** — sempre testar nessa faixa. `MarketingApp` e `ComercialApp` (D-059) são shells desktop-first, mas ambos têm bottom nav mobile (72px) — testar os dois em pelo menos um tamanho de mobile também.

---

## 9. Princípios de UX adotados no projeto

Decisões de design tomadas na V2 e por quê:

| Princípio | Aplicação no projeto |
|-----------|---------------------|
| **Ação principal sempre acessível** | Botão "Registrar Lead" com 56px — impossível de errar em campo |
| **Hierarquia por posição** | Dashboard como primeira tab — o mais consultado aparece primeiro |
| **Não destruir sem confirmar** | Excluir sempre em 2 passos (botão ⋯ → confirmar) |
| **Feedback imediato** | Toast com nome do lead registrado confirma que o dado certo foi salvo |
| **Contexto determina layout** | Vendedor em campo: mobile-first, inputs grandes, menos campos visíveis |
| **Cor não é único indicador** | Badges sempre têm texto além da cor (acessibilidade) |
| **Simplicidade > beleza** | Entre solução mais bonita e mais simples, escolher a mais simples |

---

## 10. Quando NÃO implementar

Situações que exigem parar e consultar antes de prosseguir:

- Qualquer mudança que altere **fluxo de negócio** (como captura de lead funciona, etc.)
- Qualquer mudança no **banco de dados** (schema, RLS, migrations)
- Qualquer mudança que afete **autenticação** ou permissões de usuário
- Implementar algo da V2 **sem aprovação prévia** da proposta/plano
- Fazer merge de uma fase **sem testar na URL de preview primeiro**
