# Segurança e Moderação — Captação Pública (Form Builder)

> Processo operacional, não código. Cobre o canal de captação sem sessão
> (`FormularioPublico.jsx` / Edge Function `submeter-formulario`) — o único
> ponto do sistema onde qualquer pessoa, sem autenticação, grava dado direto
> no banco.

## 1. Proteções técnicas já em vigor

| Proteção | Onde | O que cobre |
|---|---|---|
| Honeypot antispam | `submeter-formulario/index.ts` | Bots simples que preenchem todos os campos |
| Bloqueio de link em texto livre | `submeter-formulario/index.ts`, `FormularioPublico.jsx` | `nome`/`endereco`/`bairro`/campos personalizados não podem conter URL |
| Rate limit por IP (5 submissões / 10 min) | `submeter-formulario/index.ts` | Automação/spam em massa vindo do mesmo IP |
| CORS restrito por origem | `submeter-formulario/index.ts` (secret `CORS_ALLOWED_ORIGINS`) | Chamada só a partir do domínio oficial |
| IP + timestamp de cada submissão | `leads.origem_ip`/`leads.criado_em` | Rastreabilidade para cooperação com autoridade, se necessário |
| Fila de revisão antes de virar lead ativo | "Leads sem vendedor" em `LeadsTab.jsx` | Marketing/comercial vê o dado antes de distribuir a um vendedor |
| Exclusão manual de lead suspeito | Botão de excluir na mesma fila | Remove um lead sem precisar atribuí-lo antes |

Nenhuma dessas proteções filtra **conteúdo impróprio em texto livre que não seja link** (ex: ofensas, dado falso) — isso depende da revisão humana na fila de distribuição.

## 2. Se aparecer conteúdo ilegal (ex: abuso sexual infantil, ameaça, etc.)

1. **Não repassar, não printar para terceiros, não divulgar internamente além do necessário.** Manuseio mínimo.
2. **Excluir o lead imediatamente** pela fila "Leads sem vendedor" (`LeadsTab.jsx`) — soft delete não é suficiente aqui; a exclusão nessa fila já é definitiva (`db.removeLead`, hard delete com auditoria via trigger).
3. **Denunciar às autoridades competentes antes ou junto da exclusão** — a exclusão não substitui a denúncia:
   - **Disque 100** (Direitos Humanos, inclui abuso infantil) — telefone ou [disque100.mdh.gov.br](https://disque100.mdh.gov.br)
   - **SaferNet Brasil** — canal de denúncia de crimes/violações na internet: [new.safernet.org.br/denuncie](https://new.safernet.org.br/denuncie)
   - **Delegacia de crimes cibernéticos** do seu estado, se o caso exigir registro formal (B.O.)
4. Guardar evidência mínima necessária para a denúncia (data/hora da submissão, `origem_ip`, `formulario_id`) **antes** de excluir — sem isso a denúncia perde rastreabilidade.
5. Registrar internamente (fora do banco de leads) que o incidente ocorreu e foi tratado — data, quem tratou, para onde foi denunciado. Não precisa ser sofisticado: uma entrada de log/planilha à parte já basta.

## 3. Por que isso é responsabilidade de quem opera o sistema

Quem cria e opera o formulário público — não a infraestrutura que o hospeda — tem acesso às respostas e, portanto, o dever de agir ao tomar conhecimento de conteúdo ilegal. No Brasil, o Marco Civil da Internet (Lei 12.965/2014) prevê remoção **imediata**, sem necessidade de ordem judicial, para casos de natureza sexual (art. 21) — e o Estatuto da Criança e do Adolescente (Lei 8.069/1990) trata abuso sexual infantil como crime com dever de comunicação. Trocar a ferramenta de captação (ex: por Google Forms) não transfere essa responsabilidade — quem vê e usa a resposta continua sendo quem opera o negócio.

*Isto não é aconselhamento jurídico.* Para uma avaliação formal de responsabilidade, consulte um advogado.

## 4. Limites conhecidos

- O bloqueio de link (item 1) não impede texto ofensivo sem URL — só a revisão humana na fila de distribuição cobre isso.
- Não há upload de arquivo/imagem em nenhum formulário do Form Builder hoje — se essa funcionalidade for adicionada no futuro, este documento precisa ser revisado (upload exige moderação própria, ex: verificação de hash contra bases de conteúdo ilegal conhecido).
- O rate limit é por IP e conta apenas leads efetivamente gravados na tabela `leads` — não cobre tentativas rejeitadas por outros motivos (campo obrigatório ausente, etc.), que não geram linha nova.
