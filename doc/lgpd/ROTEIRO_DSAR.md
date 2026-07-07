# Roteiro DSAR — Atendimento a Direitos de Titulares

> **PA-15/LGPD** — Procedimentos para exercício dos direitos do art. 18 da LGPD.  
> Canal de contato: **privacidade@rjnet.com.br** — ⚠️ pendente criação pela equipe de TI  
> Prazo de resposta: **15 dias corridos** (boa prática ANPD)

---

## Direito de Acesso (art. 18, I)

O titular pode solicitar quais dados a RJNet possui sobre ele.

**Query de busca por telefone ou CPF (executar no SQL Editor):**

```sql
SELECT
  l.*,
  e.nome AS evento
FROM public.leads l
LEFT JOIN public.eventos e ON l.evento_id = e.id
WHERE l.telefone = '(XX) XXXXX-XXXX'  -- substituir pelo telefone do titular
   OR l.cpf      = 'XXX.XXX.XXX-XX'   -- ou pelo CPF
ORDER BY l.criado_em DESC;
```

> **Use `l.*`, não uma lista fixa de colunas.** `leads` ganhou colunas novas ao longo do tempo (`mes_referencia`, `origem`, `qr_code_id`, `qr_code_label`, `formulario_id`, `bairro`, `campos_extras`, `origem_ip` — D-058, D-061 a D-063, D-067) e uma lista fixa sub-relataria dados de um titular capturado por QR Code/Formulário público, que não tem `evento_id`. Se precisar excluir colunas puramente técnicas/internas da resposta ao titular (ex.: `deletado`, `deletado_por`), remova-as explicitamente do resultado antes de exportar — não do SELECT.

**Resposta:** exportar resultado como CSV e enviar ao titular por e-mail.

---

## Direito de Correção (art. 18, III)

O titular pode solicitar correção de dados incorretos.

**Procedimento:** acessar o painel de marketing → aba Leads → localizar o lead → editar os campos incorretos.

---

## Direito de Exclusão (art. 18, VI)

O titular pode solicitar a exclusão dos seus dados.

**Hard delete imediato (executar no SQL Editor):**

```sql
-- Exclusão física — irreversível
DELETE FROM public.leads
WHERE telefone = '(XX) XXXXX-XXXX'  -- substituir
   OR cpf      = 'XXX.XXX.XXX-XX';  -- ou pelo CPF
```

> Nota: o soft delete via app (`deletado = true`) não é suficiente para atender este direito — usar hard delete acima.

---

## Direito de Portabilidade (art. 18, V)

O titular pode solicitar seus dados em formato estruturado.

**Usar a query do Direito de Acesso acima** e exportar como JSON:

```sql
SELECT row_to_json(dados) FROM (
  SELECT l.*, e.nome AS evento
  FROM public.leads l
  LEFT JOIN public.eventos e ON l.evento_id = e.id
  WHERE l.telefone = '(XX) XXXXX-XXXX'
) dados;
```

---

## Direito de Revogação de Consentimento (art. 18, IX)

O titular pode revogar o consentimento dado anteriormente.

**Procedimento:**
1. Executar o hard delete acima (remover todos os dados)
2. Registrar no log interno que o titular revogou o consentimento (e-mail de confirmação)
3. Garantir que o número de telefone/CPF não seja inserido novamente sem novo consentimento

---

## Registro de Atendimentos

Manter planilha ou sistema interno com:

| Campo | Descrição |
|-------|-----------|
| Data da solicitação | |
| Direito exercido | |
| Identificação do titular | |
| Data da resposta | |
| Ação tomada | |
| Responsável | |

---

> Documento criado em 2026-06-16 como parte do PA-15 do Plano de Ação LGPD.
