-- ============================================================================
-- LearnHub — livres PDF des leçons
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → Run.
-- Idempotent : peut être relancé sans risque.
--
-- Chaque leçon devient un livre PDF déposé sur Cloudflare R2 par la fonction
-- Edge « livre » ; ces colonnes mémorisent la couverture choisie par
-- l'enseignant et l'adresse du fichier généré.
-- ============================================================================

alter table public.lessons add column if not exists couverture_url text;
alter table public.lessons add column if not exists livre_url text;
alter table public.lessons add column if not exists livre_taille text;
alter table public.lessons add column if not exists livre_maj timestamptz;

-- Recherche rapide des leçons déjà publiées en livre.
create index if not exists idx_lessons_livre on public.lessons (espace_id) where livre_url is not null;

-- Les couvertures et les PDF de secours vont dans le bucket `documents`
-- (créé par schema.sql) : les politiques existantes réservent l'écriture aux
-- enseignants et la lecture à tout le monde.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;
