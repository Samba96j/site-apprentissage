-- LearnHub — ciblage des ressources par classe.
--
-- À exécuter une fois dans Supabase → SQL Editor → Run. Idempotent.

alter table public.resources
    add column if not exists classe_ids text[] not null default '{}';

create index if not exists idx_resources_classe_ids
    on public.resources using gin (classe_ids);
