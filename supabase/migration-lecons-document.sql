-- ============================================================================
-- LearnHub — cours : colonnes manquantes, couverture et plafond de stockage
--
-- À coller dans Supabase → SQL Editor → New query → Run.
-- Le script est IDEMPOTENT : il peut être relancé sans risque.
--
-- ⚠️ Sans ces colonnes, l'enregistrement d'un cours échoue côté Supabase et
-- l'élève ne voit jamais le document (le professeur, lui, le voit encore dans
-- le cache de son navigateur).
--
-- Ce fichier regroupe les trois migrations de leçons :
--   migration-lecons-classes.sql  → classe_ids
--   migration-lecons-support.sql  → support_url, support_nom, support_taille
--   migration-lecons-document.sql → couverture_url
-- ============================================================================

-- Cours ciblés sur une ou plusieurs classes.
alter table public.lessons
    add column if not exists classe_ids text[] not null default '{}';

create index if not exists idx_lessons_classe_ids
    on public.lessons using gin (classe_ids);

-- Document de cours importé (PDF, Word, PowerPoint, EPUB).
-- Le fichier est hébergé dans le bucket `documents`, préfixe `supports/`.
alter table public.lessons add column if not exists support_url text;
alter table public.lessons add column if not exists support_nom text;
alter table public.lessons add column if not exists support_taille text;

-- Couverture facultative affichée sur la carte de l'élève.
alter table public.lessons add column if not exists couverture_url text;

-- Nettoyage des colonnes de l'ancienne génération automatique de PDF.
alter table public.lessons drop column if exists livre_url;
alter table public.lessons drop column if exists livre_taille;
alter table public.lessons drop column if exists livre_maj;

-- Documents de cours et couvertures : bucket public, écriture réservée aux
-- enseignants par les politiques de schema.sql.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;

-- Autorise les cours volumineux (50 Mo) dans ce bucket.
-- Le plafond global du projet doit aussi être au moins égal :
-- Dashboard → Storage → Settings → « Global file upload limit ».
update storage.buckets set file_size_limit = 52428800 where id = 'documents';

-- Vérification : doit renvoyer 5 lignes, sans erreur.
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'lessons'
--     and column_name in ('classe_ids','support_url','support_nom','support_taille','couverture_url');

