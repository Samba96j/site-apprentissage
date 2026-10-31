-- ============================================================================
-- LearnHub — ciblage des leçons par classe
--
-- À coller dans Supabase → SQL Editor → Run. Le script est idempotent.
--
-- Une leçon sans classe cible reste visible par tout l'espace enseignant.
-- Dès qu'une ou plusieurs classes sont cochées, seuls leurs élèves la voient.
-- ============================================================================

alter table public.lessons
    add column if not exists classe_ids text[] not null default '{}';

create index if not exists idx_lessons_classe_ids
    on public.lessons using gin (classe_ids);
