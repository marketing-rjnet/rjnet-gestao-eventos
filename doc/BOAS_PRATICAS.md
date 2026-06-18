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
# Substitua o hash pelo ponto de restauração desejado (ver doc/ui/UX_UI_V2_CHANGELOG.md)
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

Consulte `doc/ui/UX_UI_V2_CHANGELOG.md` para a lista completa e atualizada.

| Nome | Descrição |
|------|-----------|
| **V1 produção estável** | Estado antes de qualquer mudança de UI/UX V2 |
| **Início da V2** | Após cor `#ffcb00` e plano de implementação |

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

---

## 6. Documentação Obrigatória por Fase

Antes de implementar qualquer mudança de interface:

| Documento | Quando ler |
|-----------|-----------|
| `doc/ui/UI_VERSIONS.md` | Entender o estado atual da interface (V1 baseline) |
| `doc/ui/UX_UI_V2_PROPOSAL.md` | Entender o que foi proposto e aprovado |
| `doc/ui/UX_UI_V2_IMPLEMENTATION_PLAN.md` | Ver o plano detalhado por etapa |
| `doc/ui/UX_UI_V2_CHANGELOG.md` | Ver o que já foi feito, hashes e status |

Após implementar qualquer mudança:
- Atualizar o `UX_UI_V2_CHANGELOG.md` com o hash, data e status.

---

## 7. Hierarquia de Aprovação

```
Proposta (doc/ui/UX_UI_V2_PROPOSAL.md)
    ↓ aprovação explícita necessária
Plano de implementação (UX_UI_V2_IMPLEMENTATION_PLAN.md)
    ↓ aprovação explícita necessária
Implementação por fase (A → B → C)
    ↓ validação em preview antes do merge
Merge na main → produção
```

**Nunca pular etapas.** A V1 é sempre o baseline de segurança.

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

O app do Vendedor foi projetado para **375–480px** — sempre testar nessa faixa.

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
