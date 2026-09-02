-- =============================================================
-- Simulador: esconde o peso das opções (tipo 'demanda') da leitura
-- pública (D-103)
-- =============================================================
-- Rode no SQL Editor do Supabase. Idempotente.
--
-- Contexto: `simuladores_select_publico` (migracao-simulador.sql) libera
-- SELECT de anon na LINHA inteira quando ativo=true — RLS é por linha,
-- não por coluna. Isso expõe `perguntas` (com `peso` de cada opção,
-- D-075) direto via REST (`/rest/v1/simuladores?select=perguntas`), sem
-- precisar nem abrir a página pública. Quem soubesse o peso poderia
-- escolher sempre a opção de maior peso pra forçar `temperatura='quente'`
-- na fila de distribuição.
--
-- `quiz_perguntas` (com `respostaCorretaId`, D-080) tem o MESMO problema,
-- mas NÃO é tocado aqui: o feedback visual verde/vermelho do Quiz
-- (SimuladorPublico.jsx) é calculado no cliente comparando com esse
-- campo — escondê-lo quebraria a feature hoje em produção. Corrigir
-- isso exige mover a checagem de resposta pro servidor (round-trip por
-- pergunta), o que é uma mudança de UX, não um ajuste de segurança
-- isolado — decisão em aberto, fora do escopo desta migração.
--
-- A Edge Function `submeter-simulador` NUNCA leu o peso do payload do
-- cliente — ela busca sua própria cópia de `perguntas`/`quiz_perguntas`
-- direto do banco com SUPABASE_SERVICE_ROLE_KEY (bypassa RLS). Ou seja:
-- esta migração não muda em nada o cálculo de pontuação/temperatura,
-- só o que é exposto ao público antes da submissão.

-- ─── 1. Function pública (SECURITY DEFINER) — devolve a campanha ativa
-- pelo slug, com `peso` removido de cada opção de `perguntas`. Mesmas
-- colunas/nomes de `simuladores`, pra dataService.js reaproveitar
-- `simuladorFromDb` sem mudança de mapeamento. ──────────────────

create or replace function public.simulador_publico(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'nome', s.nome,
    'slug', s.slug,
    'tipo', s.tipo,
    'campanha', s.campanha,
    'versao_perguntas', s.versao_perguntas,
    'mensagem_resultado', s.mensagem_resultado,
    'perguntas', (
      select jsonb_agg(
        (p.pergunta - 'opcoes') || jsonb_build_object(
          'opcoes', (
            select jsonb_agg(o.opcao - 'peso')
            from jsonb_array_elements(p.pergunta -> 'opcoes') as o(opcao)
          )
        )
      )
      from jsonb_array_elements(s.perguntas) as p(pergunta)
    ),
    'quiz_perguntas', s.quiz_perguntas,
    'quiz_faixas', s.quiz_faixas,
    'ativo', s.ativo
  )
  from public.simuladores s
  where s.slug = p_slug and s.ativo = true
  limit 1;
$$;

revoke all on function public.simulador_publico(text) from public;
grant execute on function public.simulador_publico(text) to anon;

-- ─── 2. Fecha a leitura direta da tabela pra anon — único consumidor
-- (fetchSimuladorPublico, dataService.js) passa a usar a function acima.
-- Leitura autenticada (marketing/comercial, gestão em SimuladorTab.jsx)
-- não é afetada — continua na policy `simuladores_select_interno`. ──

drop policy if exists "simuladores_select_publico" on public.simuladores;

-- =============================================================
-- Verificação
-- =============================================================
-- select simulador_publico('slug-de-uma-campanha-ativa');
-- -- confirmar que o jsonb devolvido NÃO tem a chave "peso" dentro de
-- -- nenhuma opção de "perguntas", e que "quiz_perguntas" continua igual.

notify pgrst, 'reload schema';
