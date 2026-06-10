# Auditoria Técnica — RJNet Gestão de Eventos
**Função do autor:** CTO / Arquiteto / Auditor de Segurança
**Data:** 10/06/2026
**Público-alvo deste documento:** fundador / gestor de produto (linguagem acessível, sem assumir conhecimento técnico avançado)

---

## Como ler este documento

Eu escrevi tudo pensando em alguém que entende de negócio, mas não necessariamente de programação. Sempre que uso um termo técnico, eu traduzo com um exemplo do mundo real. Se em algum ponto ficar denso, pule para o **Resumo Executivo** (logo abaixo) — ele tem o essencial em linguagem de gestor.

Níveis de criticidade que uso ao longo do texto:

- 🔴 **Crítico** — risco sério e imediato (segurança, vazamento de dados, ou algo que faz o produto não funcionar de verdade). Mexer primeiro.
- 🟠 **Alto** — problema importante que vai doer em breve, mas não está pegando fogo agora.
- 🟡 **Médio** — vale corrigir, melhora qualidade e reduz dor futura.
- 🔵 **Baixo** — refinamento, "nice to have".

---

# 1. Resumo Executivo (linguagem de negócio)

O sistema é um **protótipo bonito e bem desenhado**, mas hoje ele é o que chamamos de "fachada de loja sem estoque atrás": a vitrine (a tela) está excelente, mas **não existe um depósito central** guardando os dados. Isso gera três problemas que você precisa entender antes de qualquer coisa:

### 1.1. O problema que provavelmente quebra o seu negócio hoje
**Cada celular e cada computador guarda seus próprios dados, isolados.** Quando o vendedor Carlos cadastra um lead no celular dele, esse lead fica **só no celular do Carlos**. A gerente, no computador do escritório, **não vê esse lead**. O "ranking da equipe", o "placar", o total de leads do evento — tudo isso só mostra o que foi digitado naquele aparelho específico.

> **Analogia:** é como se cada vendedor tivesse um caderninho de papel próprio. O sistema parece compartilhar informação, mas na prática cada um anota no seu caderno e ninguém vê o caderno do outro. O "painel da gerência" é só mais um caderno isolado.

Para um sistema cujo propósito é **a equipe capturar leads em eventos e a gerência acompanhar**, isso significa que a função central **não funciona de verdade entre pessoas diferentes**.

### 1.2. O problema legal (LGPD)
Você está coletando **CPF, nome, telefone e endereço** de clientes. Isso é dado pessoal protegido por lei (a LGPD, a lei brasileira de proteção de dados). Hoje esses dados ficam guardados **sem proteção, em texto puro, dentro do navegador**, e qualquer pessoa com acesso ao aparelho (ou com um conhecimento técnico básico) consegue ler tudo. Além disso, recentemente a **validação de CPF foi removida** do sistema. Isso é um risco jurídico e de reputação real, com potencial de multa.

### 1.3. O problema de senha
As senhas do sistema (`mkt2025` e `com2025`) estão **escritas dentro do código** e **publicadas no histórico do projeto**. Pior: pela forma como o sistema é construído, **mesmo trocando as senhas, elas continuariam visíveis** para qualquer pessoa que abrir o site e souber onde olhar. A "tranca da porta" hoje está desenhada na própria porta, do lado de fora.

### Conclusão executiva
O produto **não está pronto para uso real com dados de clientes**. Ele está pronto como **demonstração / validação de ideia**. A boa notícia: a estrutura visual e a organização dos dados estão bem-feitas, então a distância até um produto real é **trabalho conhecido e finito** — basicamente "construir o depósito central" (um servidor com banco de dados). O código já foi escrito antecipando isso (existem comentários "Supabase-ready"), só que essa parte nunca foi ligada.

**Recomendação de uma frase:** pause o uso com dados reais de clientes, e priorize ligar um banco de dados de verdade com login seguro antes de escalar para a equipe toda.

---

# 2. Resumo Técnico

Aplicação **SPA React 19 + Vite**, single-file (`src/main.jsx`, ~1840 linhas), sem backend. Persistência 100% client-side via `localStorage`/`sessionStorage` (`usePersisted`). Deploy estático na Vercel com bons headers de segurança (CSP, HSTS, X-Frame-Options).

Pontos centrais:

- **Autenticação puramente client-side.** Objeto `AUTH` (linhas 245–248) compara usuário/senha no navegador. Credenciais com fallback hardcoded (`mkt2025`/`com2025`). Variáveis `VITE_*` são **embutidas no bundle** em build-time — não são segredo. Não há servidor validando nada.
- **Sem banco de dados / sem multi-dispositivo.** `localStorage` é por-navegador. O modelo de domínio (eventos, leads, materiais, vendedores) está bem modelado e "Supabase-ready", mas o cliente Supabase (`config/supabase.template.js`) nunca foi instanciado.
- **Camada de segurança morta.** `config/security.js` (com `validateLead`, `sanitizeEmail`, `escapeHtml`, etc.) usa `module.exports` (CommonJS) e **não é importada** pelo app ESM. O app usa uma função `sanitize()` local e mais fraca (linha 1351). Os testes unitários testam o módulo morto, dando falsa sensação de cobertura.
- **LGPD:** dados pessoais (CPF/nome/telefone/endereço) em texto puro no `localStorage`, exportáveis em CSV, sem criptografia, sem controle de acesso real, sem trilha de auditoria, sem gestão de consentimento.
- **Possível CSV Injection** no `exportarCSV` (valores não são prefixados contra fórmulas).
- **XSS:** mitigado majoritariamente pelo escape automático do React (não há `dangerouslySetInnerHTML`). O `sanitize` por regex é frágil, mas não é a principal linha de defesa.
- **Manutenibilidade:** monólito de arquivo único, duas implementações de sanitização, mock data como fonte de verdade.

Stack: React 19.2, Vite 8, Chart.js 4.5, Playwright (E2E). Sem TypeScript, sem ESLint configurado, sem CI visível.

---

# 3. Achados detalhados

Para cada achado: **o que é**, **por que é problema**, **impacto no sistema**, **impacto no negócio**, **como corrigir**, **dificuldade** e **benefício**.

---

## 🔴 ACHADO 1 — Não existe backend: os dados não são compartilhados entre pessoas
**Categoria:** Arquitetura / Funcionalidade central

**O que foi encontrado**
Toda a informação do sistema é salva com `localStorage` (função `usePersisted`, linha 172). `localStorage` é uma "gavetinha" que **cada navegador guarda só para si**, no próprio aparelho.

```js
// linha 172 — o "banco de dados" atual é a gaveta do próprio navegador
function usePersisted(key, fallback, { session = false } = {}) {
  const storage = session ? sessionStorage : localStorage;
  ...
}
```

**Por que isso é um problema**
Não existe um lugar central onde os dados de todos se encontram. O celular do vendedor A, o celular do vendedor B e o computador da gerência são **três mundos separados** que nunca se falam.

> **Analogia:** imagine um grupo de WhatsApp onde, na verdade, cada pessoa só vê as próprias mensagens. Parece um grupo, mas é um monte de monólogos isolados.

**Impacto no sistema**
- O "Placar da equipe" e o "Ranking" (linhas 1480–1490) só contam os leads daquele aparelho.
- O painel de Marketing/gerência (`MarketingApp`) mostra apenas os leads digitados naquele computador — não os da equipe em campo.
- A consulta "Check-in por CPF" só encontra quem foi cadastrado naquele mesmo dispositivo.

**Impacto no negócio**
A proposta de valor do produto — **equipe captura leads, gestão acompanha em tempo real** — não se concretiza. Você teria que juntar os dados manualmente (exportar CSV de cada celular). É o tipo de falha que destrói a confiança da equipe no sistema ("cadastrei e sumiu").

**Como corrigir**
Ligar um backend com banco de dados central. O caminho mais rápido e barato para o seu caso é o **Supabase** (o próprio código já foi preparado para ele: veja `config/supabase.template.js`). Supabase é um "banco de dados na nuvem com login pronto", de configuração relativamente simples. Em alto nível:
1. Criar projeto no Supabase e as tabelas (`eventos`, `leads`, `materiais`, `vendedores`).
2. Trocar as funções do `AppProvider` (hoje mexem no `localStorage`) por chamadas ao Supabase.
3. Configurar **RLS (Row Level Security)** — regras que dizem "cada vendedor só vê/edita o que tem direito".

**Dificuldade:** Alta (é a maior obra do projeto, mas é trabalho conhecido — talvez 1 a 3 semanas de um dev competente).
**Benefício:** Altíssimo. É o que transforma o protótipo em produto de verdade.

---

## 🔴 ACHADO 2 — Login é "teatro de segurança": pode ser burlado por qualquer um
**Categoria:** Segurança / Autenticação

**O que foi encontrado**
A verificação de senha acontece **inteiramente dentro do navegador do usuário** (linhas 308–314):

```js
if (u === AUTH.marketing.user && p === AUTH.marketing.pass) onLogin({ role: "marketing" });
```

E o `AUTH` tem senhas embutidas como fallback (linhas 245–248):

```js
const AUTH = {
  marketing: { user: ..., pass: import.meta.env.VITE_MARKETING_PASS || "mkt2025" },
  comercial: { user: ..., pass: import.meta.env.VITE_COMERCIAL_PASS || "com2025" },
};
```

**Por que isso é um problema**
Quando a segurança roda no navegador, **o "segurança da portaria" trabalha para o visitante, não para você**. O usuário controla o navegador inteiro; ele pode simplesmente mandar o app pular a verificação.

> **Demonstração (no seu próprio sistema, para você ver a gravidade):** num computador comum, basta abrir o site, apertar `F12` (ferramentas de desenvolvedor), ir na aba "Console" e digitar:
> ```js
> sessionStorage.setItem('rjnet_session', JSON.stringify({ role: 'marketing' }));
> location.reload();
> ```
> Pronto — entrou como Marketing **sem nenhuma senha**. O mesmo serve para virar qualquer vendedor.

Além disso, sobre o detalhe técnico do Vite: variáveis com prefixo `VITE_` **não são secretas**. O Vite as "cola" dentro do arquivo JavaScript que é baixado pelo navegador. Ou seja, **mesmo que você configure senhas fortes via variável de ambiente, elas ficam legíveis** para quem inspecionar o código baixado. É um equívoco comum e importante de entender.

**Impacto no sistema**
Qualquer pessoa com o link acessa qualquer perfil, lê e altera todos os dados (incluindo CPFs de clientes).

**Impacto no negócio**
Confidencialidade zero. Combinado com o Achado 4 (LGPD), é exposição jurídica direta. Hoje o que protege você é só a obscuridade ("ninguém sabe o link"), o que não é proteção.

**Como corrigir**
Autenticação **de verdade só existe com servidor**. Ao migrar para Supabase (Achado 1), use o **Supabase Auth**: o login passa a ser validado no servidor, as senhas ficam guardadas com hash (embaralhadas de forma irreversível) e o navegador recebe apenas um "crachá temporário" (token) que não revela a senha. Remova **todo** fallback hardcoded.

**Dificuldade:** Média (vem quase "de graça" junto com a migração do Achado 1).
**Benefício:** Altíssimo.

---

## 🔴 ACHADO 3 — Senhas hardcoded e publicadas no histórico do git
**Categoria:** Segurança / Gestão de Segredos

**O que foi encontrado**
As senhas `mkt2025` e `com2025` estão escritas no código-fonte e, pelo histórico de commits, foram **deliberadamente restauradas** (commit "Restaura fallback de credenciais para acesso sem env vars").

**Por que isso é um problema**
Tudo que entra no histórico do git **fica lá para sempre**, mesmo que você apague depois. Se este repositório algum dia virar público (ou alguém com acesso vazar), as senhas vão junto.

> **Analogia:** é como deixar a chave reserva debaixo do tapete e ainda tirar foto do tapete e postar num álbum compartilhado. Trocar o tapete depois não apaga a foto.

**Impacto no negócio**
Senhas previsíveis e públicas. Qualquer pessoa que já viu o código (ex-funcionário, freelancer, etc.) tem acesso permanente.

**Como corrigir**
1. Curto prazo, hoje: troque as senhas atuais (elas devem ser consideradas "queimadas").
2. Estrutural: elimine senhas do código; use Supabase Auth (Achado 2).
3. Adote a regra: **nenhum segredo no código, nunca** — segredos ficam só em configuração de servidor, fora do navegador.

**Dificuldade:** Baixa para o paliativo; resolvida de vez junto com Achados 1 e 2.
**Benefício:** Alto.

---

## 🔴 ACHADO 4 — Dados pessoais de clientes (CPF, etc.) expostos — risco de LGPD
**Categoria:** Segurança / Conformidade legal

**O que foi encontrado**
Os leads guardam **nome, CPF, telefone e endereço** (dados pessoais sob a LGPD) em **texto puro** no `localStorage`, e há exportação em CSV com CPF (linhas 919–940). Não há criptografia, controle de acesso real, registro de quem acessou (trilha de auditoria), nem gestão de consentimento. Adicionalmente, a **validação de CPF foi removida** (commit "Remove validação de CPF"), embora a função `validarCpf` ainda exista no código (linha 1356), apenas não é usada no cadastro.

**Por que isso é um problema**
A LGPD exige que dados pessoais sejam tratados com segurança e finalidade clara. "Texto puro acessível a qualquer um" é o oposto disso. CPF é dado sensível para fraude.

> **Analogia:** é como anotar o CPF e endereço dos clientes num quadro branco no meio da praça do evento. Qualquer um que passe consegue copiar.

**Impacto no negócio**
Risco de **multa da ANPD** (a autoridade da LGPD), risco de processo de cliente, e dano de reputação grave se houver vazamento de CPFs. Para uma empresa que quer escalar, isso é um passivo que assusta investidores e parceiros.

**Como corrigir**
1. Mover os dados para o backend com acesso controlado (Achado 1) — pré-requisito de tudo.
2. Restaurar a validação de CPF no cadastro (a função já existe; é "religar o fio").
3. Coletar **consentimento** explícito do cliente no momento do cadastro (uma frase + checkbox: "Autorizo a RJNet a usar meus dados para contato comercial").
4. Avaliar se você realmente precisa de CPF nesta etapa — **coletar menos dado é a melhor proteção** (minimização de dados).
5. Restringir/proteger a exportação CSV e registrar quem exportou.

**Dificuldade:** Média (o ponto 2 é fácil; os demais acompanham a migração).
**Benefício:** Altíssimo (evita risco legal real).

---

## 🟠 ACHADO 5 — A "camada de segurança" oficial é código morto
**Categoria:** Segurança / Manutenção

**O que foi encontrado**
Existe um arquivo `config/security.js` cuidadoso (validação de e-mail, de lead, de evento, escape de HTML robusto). Mas ele usa `module.exports` (formato CommonJS) e **não é importado** pelo app, que é ESM/Vite. O app usa, em vez disso, uma função `sanitize` local e mais simples (linha 1351). Os **testes unitários testam o arquivo morto**, dando a falsa impressão de que essas proteções estão ativas.

**Por que isso é um problema**
Você acredita ter um cinto de segurança que, na verdade, está guardado no porta-malas. As validações fortes (e-mail, datas, quantidades, CPF) não rodam onde os dados realmente entram.

**Impacto no sistema**
Validação real mais fraca do que a documentação/testes sugerem. Risco de dados inconsistentes salvos.

**Impacto no negócio**
Falsa sensação de segurança — o pior tipo, porque você para de procurar o problema.

**Como corrigir**
Decidir por **uma** camada de validação e usá-la de verdade:
- Opção A (recomendada quando houver backend): validar **no servidor** (Supabase Edge Functions / constraints do banco), porque validação no navegador sempre pode ser burlada.
- Opção B (enquanto não há backend): converter `config/security.js` para ESM (`export`) e importá-lo no `main.jsx`, substituindo o `sanitize` local. Apontar os testes para o código realmente usado.

**Dificuldade:** Baixa/Média.
**Benefício:** Médio/Alto (e elimina uma ilusão perigosa).

---

## 🟡 ACHADO 6 — Possível "CSV Injection" na exportação
**Categoria:** Segurança

**O que foi encontrado**
No `exportarCSV` (linha 932), cada valor é só envolvido em aspas. Se um cliente se cadastrar com um nome começando por `=`, `+`, `-` ou `@`, o Excel pode **interpretar como fórmula** ao abrir o arquivo.

**Por que isso é um problema**
Um lead malicioso poderia digitar um "nome" que, ao ser aberto no Excel pela sua equipe, executa um comando.

> **Analogia:** é como receber um envelope onde o remetente escreveu, no campo do nome, uma instrução para o seu assistente. Se o assistente obedecer cegamente ao que está escrito, você tem um problema.

**Impacto no negócio**
Baixa probabilidade hoje (exige intenção e que alguém abra o CSV), mas baixo custo de corrigir.

**Como corrigir**
Antes de exportar, prefixar com um apóstrofo (`'`) qualquer célula que comece com `= + - @`, neutralizando a fórmula. É uma função de poucas linhas.

**Dificuldade:** Baixa.
**Benefício:** Médio.

---

## 🟠 ACHADO 7 — Vendedores não têm identidade própria (qualquer um "vira" qualquer um)
**Categoria:** Segurança / UX / Integridade de dados

**O que foi encontrado**
No login Comercial, após a senha compartilhada `com2025`, aparece uma **lista de vendedores** e a pessoa simplesmente **clica em quem ela é** (linhas 294–300). Não há autenticação individual.

**Por que isso é um problema**
Qualquer pessoa da equipe (ou qualquer um com a senha comercial) pode se passar por qualquer vendedor — inflar o próprio ranking, atribuir leads a outro, etc.

**Impacto no negócio**
O "placar" e as metas perdem credibilidade (e se houver comissão por lead, vira disputa). Sem rastreabilidade de quem fez o quê.

**Como corrigir**
Com o Supabase Auth (Achado 1), cada vendedor tem login próprio. O lead fica amarrado ao usuário autenticado, não a um nome escolhido num clique.

**Dificuldade:** Média (acompanha a migração de auth).
**Benefício:** Alto (dados confiáveis = decisões confiáveis).

---

## 🟠 ACHADO 8 — Risco de perda total de dados / sem backup
**Categoria:** Confiabilidade

**O que foi encontrado**
Como tudo vive no `localStorage`, **limpar o histórico/dados do navegador, trocar de celular, ou um app de "limpeza" apagam todos os leads** sem aviso e sem recuperação.

**Impacto no negócio**
Você pode perder, de uma hora para outra, todos os leads captados num evento inteiro. Sem backup, é irrecuperável.

**Como corrigir**
Resolvido estruturalmente pelo backend (Achado 1), que centraliza e permite backup automático. Enquanto isso não vem, oriente a equipe a **exportar o CSV ao fim de cada evento** como cópia de segurança manual.

**Dificuldade:** Baixa (paliativo) / resolvido pelo Achado 1.
**Benefício:** Alto.

---

## 🟡 ACHADO 9 — Aplicação inteira em um único arquivo de ~1840 linhas
**Categoria:** Manutenção / Escalabilidade

**O que foi encontrado**
Todo o sistema (ícones, dados, telas, lógica, login) está em `src/main.jsx`.

**Por que isso é um problema**
Quanto maior o arquivo, mais difícil achar coisas, mais fácil quebrar algo sem querer, e mais arriscado ter duas pessoas mexendo ao mesmo tempo.

> **Analogia:** é uma casa de um cômodo só onde cozinha, banheiro e quarto dividem o mesmo espaço. Funciona para uma pessoa por pouco tempo; vira caos quando a família cresce.

**Impacto no negócio**
À medida que você contratar desenvolvedores, o custo de cada mudança sobe e a velocidade cai (isso se chama **dívida técnica** — como um cartão de crédito: dá para adiar, mas os juros se acumulam).

**Como corrigir**
Quebrar em arquivos por responsabilidade (componentes, lógica de dados, utilidades). Não precisa ser tudo de uma vez; faça aos poucos, idealmente junto da migração para backend.

**Dificuldade:** Média.
**Benefício:** Médio (paga-se ao longo do tempo).

---

## 🔵 ACHADO 10 — Performance e qualidade: pontos menores
**Categoria:** Performance / Qualidade

- `ChartView` recria gráficos comparando dados via `JSON.stringify` em cada render (linha 268) — funciona, mas é ineficiente em telas com muitos dados. Baixo impacto hoje.
- `localStorage` tem limite (~5MB) e fica lento com milhares de leads. Mais um motivo para o backend.
- Sem TypeScript e sem ESLint: erros que poderiam ser pegos automaticamente passam batido. Adotar ESLint é barato e ajuda bastante.

**Dificuldade:** Baixa. **Benefício:** Baixo/Médio.

---

# 4. Antes de mexer: o que eu mudaria e os riscos

Eu **não alterei nenhum código de funcionamento** nesta auditoria — só adicionei este relatório. Qualquer correção abaixo deve ser decisão sua. Resumo do que cada frente envolveria:

| Mudança proposta | Arquivos afetados | Possível impacto / risco |
|---|---|---|
| Religar validação de CPF | `src/main.jsx` (função `submit` do vendedor) | Baixo. Pode rejeitar CPFs que hoje passam — é o objetivo. Risco: se a equipe às vezes cadastra sem CPF, manter o campo opcional mas validar quando preenchido. |
| Proteção contra CSV injection | `src/main.jsx` (`exportarCSV`) | Muito baixo. Apenas adiciona um `'` em casos raros. |
| Unificar validação (matar código morto) | `config/security.js`, `src/main.jsx`, testes | Médio. Precisa testar cada formulário depois. |
| Migrar para Supabase (backend + auth) | Praticamente todo o app + nova infra | Alto. É a grande obra; exige planejamento, migração de dados e testes. Recomendo fazer em ambiente separado antes de virar a chave. |

---

# 5. Roadmap priorizado

### Curto prazo (esta semana — baixo esforço, alto retorno)
1. **Trocar as senhas atuais** e tratá-las como comprometidas (Achado 3).
2. **Religar a validação de CPF** no cadastro (Achado 4 / função já existe).
3. **Orientar a equipe a exportar CSV ao fim de cada evento** como backup manual (Achado 8).
4. **Corrigir o CSV injection** (Achado 6) — poucas linhas.
5. **Decisão de negócio:** suspender o uso com dados reais de clientes em larga escala até o backend existir, ou aceitar conscientemente o risco no curtíssimo prazo.

### Médio prazo (próximas semanas — a obra principal)
6. **Migrar para Supabase**: banco de dados central + Supabase Auth + RLS (Achados 1, 2, 3, 7, 8 de uma vez só). Esta é a tarefa que destrava o produto de verdade.
7. **Validação no servidor** e unificação da camada de segurança (Achado 5).
8. **Consentimento LGPD + minimização de dados** no cadastro (Achado 4).

### Longo prazo (consolidação e escala)
9. Quebrar o `main.jsx` em módulos; adotar ESLint e, se possível, TypeScript (Achados 9, 10).
10. Trilha de auditoria (quem viu/exportou dados), backups automatizados, e um ambiente de testes separado do de produção.
11. CI/CD: rodar os testes automaticamente a cada mudança antes de publicar.

> **Regra de ouro do roadmap:** os itens 1–5 são paliativos baratos. O item 6 é o que realmente resolve a maioria dos problemas de uma vez. Não invista energia demais em paliativos sofisticados — invista no backend.

---

# 6. O que aprender com esta análise (para você decidir melhor no futuro)

Estes são os conceitos que, se você internalizar, vão te deixar muito mais independente para avaliar qualquer sistema ou qualquer desenvolvedor que você contrate:

1. **"Frontend" vs. "Backend" — vitrine vs. depósito.** O frontend é o que o usuário vê e toca (roda no aparelho dele). O backend é o servidor central, que o usuário não controla. **Regra prática:** se uma informação precisa ser confiável ou compartilhada entre pessoas, ela tem que viver no backend. Segurança e dados de verdade **nunca** ficam só no frontend.

2. **"Segurança no cliente é teatro."** Tudo que roda no navegador pode ser visto e alterado pelo usuário. Senhas, regras de acesso e validações que importam **precisam ser verificadas no servidor**. Pergunta que você pode fazer a qualquer dev: *"essa verificação acontece no servidor ou só no navegador?"*

3. **Segredo no código não é segredo.** Senhas, chaves e tokens **nunca** entram no código-fonte nem no histórico do git. Se entraram uma vez, considere-os vazados para sempre. (E variáveis `VITE_*` vão para o navegador — não servem para segredos.)

4. **LGPD e minimização de dados.** Coletar dado pessoal traz responsabilidade legal. O melhor jeito de proteger um dado é **não coletá-lo se não for necessário**. Sempre pergunte: *"a gente precisa mesmo desse CPF agora?"*

5. **Dívida técnica é como cartão de crédito.** Atalhos no código (arquivo único, código morto, validação só no navegador) parecem grátis hoje, mas cobram juros depois, na forma de bugs e lentidão para evoluir. Não é proibido usar — é proibido esquecer que existe.

6. **Falsa sensação de segurança é pior que insegurança assumida.** Ter testes que validam código morto, ou uma camada de segurança que não está ligada, é perigoso porque te faz parar de procurar o risco. Pergunta-chave: *"isso que parece protegido está realmente sendo usado no caminho real dos dados?"*

7. **Onde colocar energia.** Vários problemas deste sistema (login inseguro, dados não compartilhados, perda de dados, identidade de vendedor) têm **uma mesma raiz**: a falta de um backend. Aprender a enxergar a *causa raiz comum* evita gastar dinheiro corrigindo dez sintomas quando uma obra resolve todos.

---

*Documento gerado como auditoria técnica. Nenhuma funcionalidade do sistema foi alterada — apenas este relatório foi adicionado ao repositório.*
