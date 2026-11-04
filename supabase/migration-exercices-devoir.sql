-- LearnHub — devoirs : un exercice peut être donné à une ou plusieurs classes.
--
-- À exécuter une fois dans Supabase → SQL Editor → Run. Idempotent.
--
-- ⚠️ Sans ces colonnes, la publication d'un devoir échoue côté Supabase et
-- l'élève ne voit ni le devoir ni la notification.

alter table public.exercises
    add column if not exists devoir boolean not null default false;

alter table public.exercises
    add column if not exists classe_ids text[] not null default '{}';

alter table public.exercises
    add column if not exists echeance date;

alter table public.exercises
    add column if not exists consigne text;

create index if not exists idx_exercises_classe_ids
    on public.exercises using gin (classe_ids);

-- Vérification : doit renvoyer 4 lignes, sans erreur.
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'exercises'
--     and column_name in ('devoir','classe_ids','echeance','consigne');
