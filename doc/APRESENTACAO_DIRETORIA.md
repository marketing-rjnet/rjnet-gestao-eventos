# RJNet Gestão de Eventos — Apresentação para Diretoria

> Documento de alinhamento estratégico | Junho 2026

---

## 1. O ponto de partida

Antes desse sistema existir, cada evento era uma caixa preta. A equipe ia a campo, capturava contatos em papel ou em planilha pessoal, voltava, e esses dados sumiam em algum lugar entre o WhatsApp e o e-mail. Não tinha como saber quantos leads foram gerados por evento, qual vendedor estava performando melhor, se o material foi usado ou ficou no carro.

Não dava pra medir nada. E o que você não mede, você não melhora.

A pergunta que esse projeto tentou responder desde o começo foi simples: como a gente transforma operação de campo em dado? Como a gente para de adivinhar e começa a saber?

---

## 2. O que foi construído

Não é um sistema de cadastro. É uma operação inteira digitalizada.

O time de marketing hoje abre o sistema, cria um evento, aloca o material que vai ser levado, e já tem visibilidade de tudo em tempo real — quantos leads estão sendo capturados, por qual vendedor, para qual produto. Quando o evento encerra, o histórico fica. Não some.

O vendedor em campo usa o celular. O formulário foi pensado pra ser rápido — modo rápido de captura, seleção de produto por toque, validação de CPF na hora, check-in por CPF ou nome. Se o sinal cair, o lead fica salvo no aparelho e sobe automaticamente quando a conexão voltar. Isso foi uma decisão importante: a gente não pode perder lead por causa de sinal ruim numa feira ou num evento em galpão.

O sistema passou por 18 etapas de refatoração estrutural — não é um projeto improvisado que funcionou por sorte. Cada parte tem responsabilidade definida, cada dado tem dono, cada operação tem tratamento de erro. Isso é o que separa um protótipo de um sistema que pode crescer.

---

## 3. O que isso significa em números

Antes: zero. Nenhuma métrica de evento existia de forma confiável.

Hoje o sistema registra tudo: leads por evento, leads por vendedor, temperatura do lead (frio, morno, quente, convertido), produto de interesse, taxa de check-in. Dá pra comparar dois eventos, dois vendedores, dois meses. Dá pra ver onde a equipe performa melhor e onde está deixando lead na mesa.

O ranking em tempo real entre dispositivos já existe — o sistema vai de v0.1 a v4.6 em menos de um mês, e uma das últimas entregas foi exatamente isso: o time de marketing acompanha o desempenho da equipe em campo enquanto o evento acontece, sem precisar ligar pra ninguém. Isso muda a dinâmica de gestão.

---

## 4. A proteção que foi construída

Esse ponto é importante e eu quero ser direto: coleta de dado pessoal tem obrigação legal no Brasil. A LGPD não é opcional.

Quando fiz uma auditoria completa do sistema em junho de 2026, o score inicial de conformidade era 4,2 de 10. Foram identificadas mais de 30 não conformidades — CPF sendo armazenado sem criptografia, sem prazo de retenção definido, sem política de deleção, sem aviso de consentimento no formulário. Isso não era uma bomba que ia explodir amanhã, mas era um risco real que a empresa carregava sem saber.

Todas as correções críticas foram implementadas: criptografia AES-256 na fila offline, sanitização de inputs, headers de segurança no servidor (CSP, HSTS, X-Frame-Options), política de soft delete com prazo. O sistema passou por testes automatizados de segurança — SQL injection, XSS. Esse trabalho foi feito de forma proativa, sem ninguém pedir. Eu preferi encontrar o problema antes que ele encontrasse a empresa.

---

## 5. Para onde isso vai

O sistema atual resolve o operacional. O próximo passo é transformar isso numa engine de aquisição.

A visão é a seguinte: cada evento gera uma landing page própria com QR code. O visitante escaneia, cai numa página personalizada por produto — fibra, móvel, empresarial — já com o contexto do evento. O formulário é simples, o lead entra direto no sistema, rastreado por campanha. O painel do atendente mostra os leads em tempo real, com contexto suficiente pra fazer a abordagem certa. Depois, follow-up automático via WhatsApp com a oferta certa pro produto certo.

Isso fecha o ciclo: da presença física no evento até a conversão. E tudo rastreado, por produto, por campanha, por evento. Múltiplas campanhas simultâneas — fibra aqui, móvel ali, empresarial no outro estande — tudo separado, tudo mensurável.

Não é complexo de construir em cima do que já existe. A base já está feita.

---

## 6. O papel da IA nessa história

Vou ser honesto sobre isso porque acho que é relevante pra vocês entenderem o que aconteceu aqui.

Eu sou designer. Antes desse projeto, eu não sabia programar. O que me permitiu construir um sistema desse nível em menos de dois meses foi usar IA como parceiro de execução — Claude foi a ferramenta principal. Cada decisão técnica, cada escolha de arquitetura, cada problema de segurança foi discutido e resolvido em conjunto.

Mas a IA não decide o que construir. Ela não sabia que a gente precisava de ranking em tempo real no campo. Não sabia que o sinal cai em evento de rua. Não sabia que o time de marketing não ia usar uma interface complexa. Essas decisões foram minhas, baseadas em entender o negócio e a operação da RJNet. A IA acelerou a execução de semanas para dias. A visão e o julgamento foram humanos.

Isso não é um detalhe — é o modelo que eu proponho pra qualquer projeto futuro aqui. Não precisamos de um time de dev de 5 pessoas pra construir produto digital. Precisamos de alguém que entende o negócio e sabe usar as ferramentas certas.

---

## 7. O que eu preciso de vocês

Três coisas.

Primeiro, validação. Eu preciso saber se a direção enxerga valor nesse sistema e quer que ele continue crescendo. Não é uma pergunta retórica — se a resposta for não, eu paro de investir tempo nisso. Se a resposta for sim, eu preciso de sinal claro.

Segundo, orçamento para tráfego. O sistema de landing page com QR code só faz sentido se a gente tiver budget pra rodar campanha — mesmo que pequeno no começo, pra testar. Preciso de uma conversa sobre quanto a empresa está disposta a colocar em aquisição digital por evento.

Terceiro, formalização. Eu construí isso como iniciativa própria, no limite entre minha função de designer e algo maior. Se a empresa quer que eu continue desenvolvendo produto digital — e eu acredito que faz sentido —, precisamos definir como isso se encaixa formalmente. Não pra engessar, mas pra eu poder priorizar isso sem culpa e com os recursos certos.

Esse é o papo que eu queria ter.

---

*Documento preparado por Rafael Jenne — Junho 2026*
