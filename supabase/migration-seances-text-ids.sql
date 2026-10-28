-- LearnHub — migration à exécuter une seule fois sur un projet Supabase déjà créé.
--
-- Les colonnes de `public.seances` qui référencent du contenu doivent être en
-- `text[]` : les identifiants des leçons, exercices et classes sont des chaînes
-- (ex. « lecon-mvrjt6uawx5ue ») et non des uuid.
--
-- À coller dans Supabase → SQL Editor → Run. Le script est idempotent.

do $$
declare
    col text;
begin
    foreach col in array array['classe_ids', 'chapter_ids', 'lesson_ids', 'exercise_ids'] loop
        if exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'seances'
              and column_name = col
              and udt_name <> '_text'
        ) then
            execute format('alter table public.seances alter column %I drop default', col);
            execute format('alter table public.seances alter column %I type text[] using %I::text[]', col, col);
            execute format('alter table public.seances alter column %I set default ''{}''::text[]', col);
        end if;
    end loop;
end;
$$;
