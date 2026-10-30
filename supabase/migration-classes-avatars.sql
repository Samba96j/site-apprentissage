-- ============================================================================
-- LearnHub — matière par classe et photo de profil
--
-- À coller dans Supabase → SQL Editor → Run. Le script est idempotent.
-- ============================================================================

-- 1. Une classe est rattachée à une matière (facultative : « toutes matières »).
alter table public.classes add column if not exists matiere text;

-- 2. Photo de profil : URL publique dans le bucket `avatars`.
alter table public.profiles add column if not exists avatar_url text;

-- 3. Bucket public en lecture, écriture limitée au dossier de l'utilisateur.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_lecture on storage.objects;
create policy avatars_lecture on storage.objects
    for select using (bucket_id = 'avatars');

drop policy if exists avatars_ajout on storage.objects;
create policy avatars_ajout on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists avatars_maj on storage.objects;
create policy avatars_maj on storage.objects
    for update to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists avatars_suppression on storage.objects;
create policy avatars_suppression on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
