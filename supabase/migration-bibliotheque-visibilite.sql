-- LearnHub — visibilité des documents de la bibliothèque.
--
-- À exécuter une fois dans Supabase → SQL Editor → Run. Idempotent.
--
-- Trois niveaux :
--   public      : visible par tout le monde (même sans compte)
--   eleves      : réservé aux comptes connectés (élèves, enseignants, super-admin)
--   enseignants : réservé aux rôles admin et superadmin

alter table public.documents add column if not exists visibilite text not null default 'public';

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'documents_visibilite_check') then
        alter table public.documents
            add constraint documents_visibilite_check
            check (visibilite in ('public', 'eleves', 'enseignants'));
    end if;
end;
$$;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
    for select using (
        visibilite = 'public'
        or (auth.uid() is not null and visibilite = 'eleves')
        or (visibilite = 'enseignants' and public.mon_role() in ('admin', 'superadmin'))
    );

-- Option : basculer tous les documents existants en accès élèves.
-- update public.documents set visibilite = 'eleves';
