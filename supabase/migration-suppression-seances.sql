-- ============================================================================
-- LearnHub — suppression définitive des séances
--
-- La fonctionnalité « Séances » est remplacée par les leçons publiées en
-- livres PDF. À exécuter dans Supabase : SQL Editor → New query → Run.
--
-- ATTENTION : cette opération supprime la table et son contenu. Faites une
-- sauvegarde (Database → Backups) si vous souhaitez conserver l'historique.
-- ============================================================================

drop table if exists public.seances cascade;
