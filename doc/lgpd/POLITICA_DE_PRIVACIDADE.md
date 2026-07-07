# Política de Privacidade — RJNet Telecomunicações

> **Versão:** 1.1  
> **Vigência:** a partir de _data a preencher_  
> **PA-16/LGPD** — Elaborada como parte do Plano de Ação LGPD da RJNet.  
> **Controlador:** RJNet Telecomunicações Ltda.  
> **Canal de contato:** privacidade@rjnet.com.br _(canal em implantação)_

---

## 1. Quem somos

A **RJNet Telecomunicações Ltda.** é a empresa controladora dos dados pessoais coletados neste sistema. Operamos em Angra dos Reis — RJ, oferecendo serviços de internet residencial, empresarial e móvel.

Para fins desta política, o sistema **RJNet Gestão de Eventos** é a plataforma interna utilizada para gerenciar eventos de campo, capturar leads e acompanhar o desempenho da equipe comercial.

---

## 2. Dados pessoais que coletamos

| Dado | Finalidade | Base legal (LGPD) |
|------|-----------|-------------------|
| Nome completo | Identificação do lead para contato comercial | Consentimento (art. 7°, I) |
| Telefone | Contato para apresentação de serviços | Consentimento (art. 7°, I) |
| CPF | Visita técnica e formalização de contrato (opcional) | Consentimento (art. 7°, I) |
| Endereço | Verificação de cobertura de rede (opcional) | Consentimento (art. 7°, I) |
| Bairro | Segmentação geográfica de campanhas de captação (formulário público) | Consentimento (art. 7°, I) |
| Serviço de interesse | Personalização da abordagem comercial | Consentimento (art. 7°, I) |
| Temperatura do lead | Priorização interna da equipe — não compartilhado | Legítimo interesse (art. 7°, IX) |
| Observações do vendedor | Contexto para follow-up — uso interno | Legítimo interesse (art. 7°, IX) |
| Campos adicionais do formulário (quando aplicável) | Definidos conforme o formulário público preenchido — sempre informados no próprio formulário antes do envio | Consentimento (art. 7°, I) |
| Endereço IP (apenas em envios pelo formulário público) | Prevenção de abuso/spam no formulário público; não é usado para fins comerciais e é excluído junto com o dado do lead | Legítimo interesse (art. 7°, IX) |
| E-mail (usuários internos) | Autenticação no sistema | Execução de contrato (art. 7°, V) |

### Dados que não coletamos

- Dados sensíveis (art. 5°, II LGPD): origem racial, convicção religiosa, saúde, biometria, etc.
- Dados de menores de 18 anos.

---

## 3. Como coletamos

Os dados são coletados:

- **Presencialmente**, em eventos de campo ou na atividade comercial do dia a dia dos vendedores (D-058), por vendedores da RJNet. O titular assina uma ficha de consentimento antes da coleta.
- **Digitalmente, mediado por um vendedor**, no sistema interno, sempre com apresentação do termo de consentimento e confirmação do titular.
- **Digitalmente, diretamente pelo titular**, por meio de um formulário público (acessado por link ou QR Code de divulgação da RJNet) — o próprio titular preenche e envia seus dados, sem intermediação de um vendedor. O formulário exige confirmação de um checkbox de consentimento antes de permitir o envio.

---

## 4. Consentimento

O consentimento é coletado de forma **livre, informada e inequívoca** antes do registro de qualquer dado pessoal. O titular pode:

- Negar o consentimento — nenhum dado será registrado.
- Revogar o consentimento a qualquer momento — todos os dados serão excluídos (ver seção 7).

A versão do termo aceito é registrada junto ao cadastro para fins de rastreabilidade.

---

## 5. Compartilhamento de dados

| Destinatário | País | Dados compartilhados | Base legal |
|---|---|---|---|
| **Supabase Inc.** | EUA | Todos os dados da plataforma (armazenamento e autenticação) | Art. 33, II LGPD — garantias contratuais (DPA) ⚠️ pendente upgrade de plano |
| **Equipe interna RJNet** | Brasil | Acesso conforme papel (marketing: todos; vendedor: apenas próprios leads) | Execução de contrato |

Não vendemos, alugamos nem cedemos dados pessoais a terceiros para fins comerciais.

---

## 6. Retenção de dados

| Situação | Prazo de retenção |
|----------|------------------|
| Lead ativo (contato em andamento) | Enquanto houver interesse comercial |
| Lead excluído pelo vendedor (soft delete) | 90 dias, depois exclusão definitiva automática |
| Lead de evento encerrado | 365 dias após encerramento do evento, depois exclusão definitiva |
| Lead do dia a dia sem evento (D-058) | 365 dias após o fim do mês de referência, depois exclusão definitiva |
| Lead do formulário público, sem evento nem mês associado | Contado a partir da data de envio, mesmo prazo de retenção padrão; exclusão definitiva automática |
| Endereço IP capturado no formulário público | Sem retenção própria — excluído junto do dado do lead ao qual está associado |
| Dados de usuários internos (ex-colaboradores) | Até revogação de acesso pelo administrador |

A exclusão definitiva é realizada automaticamente pelo sistema via rotina agendada diária.

---

## 7. Direitos dos titulares (art. 18 LGPD)

O titular tem os seguintes direitos, exercidos pelo canal **privacidade@rjnet.com.br** com prazo de resposta de **15 dias corridos**:

| Direito | O que garante |
|---------|--------------|
| **Acesso** (art. 18, I) | Confirmar a existência e obter cópia dos dados |
| **Correção** (art. 18, III) | Corrigir dados incompletos, inexatos ou desatualizados |
| **Exclusão** (art. 18, VI) | Excluir dados desnecessários ou tratados sem consentimento |
| **Portabilidade** (art. 18, V) | Receber os dados em formato estruturado (JSON/CSV) |
| **Revogação de consentimento** (art. 18, IX) | Revogar o consentimento e ter os dados excluídos |
| **Informação** (art. 18, VII) | Saber com quais entidades os dados foram compartilhados |

Ver procedimentos detalhados em `doc/lgpd/ROTEIRO_DSAR.md`.

---

## 8. Segurança

Adotamos as seguintes medidas técnicas e organizacionais para proteger os dados:

- **Autenticação:** e-mail e senha com suporte a MFA (autenticação multifator) via TOTP
- **Controle de acesso:** RBAC com RLS no banco de dados — vendedor acessa apenas os próprios leads
- **Criptografia em trânsito:** HTTPS/TLS em todas as comunicações
- **Criptografia em repouso:** dados da fila offline criptografados com AES-GCM 256 bits
- **Auditoria:** log automático de todas as operações de inserção, edição e exclusão de leads
- **Retenção controlada:** exclusão automática de dados vencidos via rotina agendada
- **Soft delete rastreável:** exclusões registram usuário responsável e data

---

## 9. Transferência internacional

Os dados são armazenados em servidores da **Supabase Inc.** nos Estados Unidos. A transferência é realizada com base no art. 33, II da LGPD (garantias contratuais adequadas). O DPA com a Supabase está pendente de assinatura formal (requer upgrade de plano — PA-14).

---

## 10. Encarregado de Proteção de Dados (DPO)

O DPO ainda está em processo de nomeação formal (PA-19). Até lá, solicitações de direitos de titulares devem ser encaminhadas para **privacidade@rjnet.com.br**.

---

## 11. Atualizações desta política

Esta política pode ser atualizada periodicamente. A versão vigente estará sempre disponível em `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` e referenciada no termo de consentimento do sistema. Alterações relevantes serão comunicadas aos titulares.

| Versão | Data | Alterações |
|--------|------|-----------|
| 1.0 | 2026-06-16 | Versão inicial — PA-16/LGPD |
| 1.1 | 2026-07-07 | Adiciona o formulário público de captação sem intermediação de vendedor (bairro, campos adicionais, IP de origem para prevenção de abuso) — D-062, D-063, D-067 |

---

> Documento elaborado em 2026-06-16 como parte do PA-16 do Plano de Ação LGPD.  
> Referência: `doc/lgpd/PLANO_DE_ACAO_LGPD.md` — PA-16.
