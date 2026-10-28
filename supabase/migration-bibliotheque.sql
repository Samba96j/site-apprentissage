-- LearnHub — Bibliothèque publique de documentation.
--
-- À exécuter une fois dans Supabase → SQL Editor → Run. Idempotent.
-- Crée la table `documents` (lecture publique, écriture réservée aux rôles
-- admin/superadmin) et le bucket de stockage `documents` (public).

create table if not exists public.documents (
    id text primary key,
    titre text not null,
    description text,
    matiere text,
    niveau text,
    type text not null default 'pdf',
    url text not null,
    taille text,
    auteur text,
    created_at timestamptz not null default now()
);

create index if not exists idx_documents_matiere on public.documents (matiere);
create index if not exists idx_documents_niveau on public.documents (niveau);

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
    for select using (true);

drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
    for all using (public.mon_role() in ('admin', 'superadmin'))
    with check (public.mon_role() in ('admin', 'superadmin'));

grant select on public.documents to anon;

-- Stockage des fichiers (bucket public « documents »).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;

drop policy if exists documents_objet_select on storage.objects;
create policy documents_objet_select on storage.objects
    for select using (bucket_id = 'documents');

drop policy if exists documents_objet_insert on storage.objects;
create policy documents_objet_insert on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'documents'
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'superadmin')
        )
    );

drop policy if exists documents_objet_delete on storage.objects;
create policy documents_objet_delete on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'documents'
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin', 'superadmin')
        )
    );
