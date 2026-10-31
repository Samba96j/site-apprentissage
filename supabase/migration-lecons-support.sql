-- ============================================================================
-- LearnHub — support de cours joint à une leçon
--
-- À coller dans Supabase → SQL Editor → Run. Le script est idempotent.
--
-- Le fichier lui-même est hébergé dans le bucket `documents` (déjà créé par
-- migration-bibliotheque.sql), sous le préfixe `supports/`. Ces trois colonnes
-- ne stockent que l'URL publique, le nom d'origine et la taille lisible.
-- ============================================================================

alter table public.lessons add column if not exists support_url text;
alter table public.lessons add column if not exists support_nom text;
alter table public.lessons add column if not exists support_taille text;
