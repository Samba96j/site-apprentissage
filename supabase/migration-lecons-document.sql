-- ============================================================================
-- LearnHub — couverture facultative d'un cours
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → Run.
-- Idempotent : peut être relancé sans risque.
--
-- Un cours est désormais un document importé par l'enseignant (colonne
-- `support_url` de `lessons`, déjà en place). Seule la couverture affichée sur
-- la carte de l'élève est nouvelle ; elle reste facultative.
-- ============================================================================

alter table public.lessons add column if not exists couverture_url text;

-- Nettoyage des colonnes de l'ancienne génération automatique de PDF.
alter table public.lessons drop column if exists livre_url;
alter table public.lessons drop column if exists livre_taille;
alter table public.lessons drop column if exists livre_maj;

-- Les documents de cours et les couvertures vivent dans le bucket `documents`
-- (créé par schema.sql) : écriture réservée aux enseignants, lecture publique.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;
