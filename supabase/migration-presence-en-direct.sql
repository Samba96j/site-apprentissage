-- LearnHub — canal privé de présence en direct.
--
-- À exécuter une fois dans Supabase → SQL Editor → Run.
-- Les utilisateurs authentifiés peuvent rejoindre le seul canal partagé de
-- présence. Celui-ci ne contient que les identifiants de profil et l'heure
-- de connexion ; les informations de compte restent protégées par RLS.

drop policy if exists learnhub_presence_auth on realtime.messages;
create policy learnhub_presence_auth
    on realtime.messages
    for select
    to authenticated
    using (realtime.topic() = 'learnhub-presence');
