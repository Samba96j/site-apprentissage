-- Autorise l'enregistrement des nouveaux contenus de l'assistant IA.
-- À exécuter dans Supabase → SQL Editor après avoir créé ia_contenus
-- avec migration-ia.sql.

alter table public.ia_contenus
    drop constraint if exists ia_contenus_type_check;

alter table public.ia_contenus
    add constraint ia_contenus_type_check
    check (type in ('etude', 'question', 'quiz', 'fiche'));
