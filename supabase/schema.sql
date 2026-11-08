-- ============================================================================
-- LearnHub — schéma Supabase (PostgreSQL)
--
-- À exécuter une seule fois dans Supabase :
--   Dashboard → SQL Editor → New query → coller ce fichier → Run.
--
-- Modèle :
--   espaces    : espace de travail d'un enseignant (propriétaire)
--   profiles   : compte (élève, enseignant/admin, super-admin), lié à auth.users
--   classes    : classe d'un espace, rejointe par un code
--   lessons    : cours d'un enseignant (document importé + couverture facultative)
--   exercises  : exercices (quiz, associations, textes à trous)
--   resources  : liens et documents
--   attempts   : résultats des élèves
--   messages   : messages du formulaire de contact
--   audit_events: journal global (consultation super-administrateur uniquement)
--
-- Les identifiants des contenus sont des textes générés côté client
-- (« lecon-… », « exo-… ») afin de pouvoir migrer les données locales.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

create table if not exists public.espaces (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    owner_id uuid not null unique references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    email text not null,
    role text not null default 'eleve' check (role in ('eleve', 'admin', 'superadmin')),
    espace_id uuid references public.espaces(id) on delete set null,
    classe_id text,
    created_at timestamptz not null default now()
);

create table if not exists public.classes (
    id text primary key,
    espace_id uuid not null references public.espaces(id) on delete cascade,
    nom text not null,
    niveau text,
    description text,
    code text not null unique,
    created_at timestamptz not null default now()
);

alter table public.classes add column if not exists matiere text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'profiles_classe_fk') then
        alter table public.profiles
            add constraint profiles_classe_fk
            foreign key (classe_id) references public.classes(id) on delete set null;
    end if;
end;
$$;

create table if not exists public.lessons (
    id text primary key,
    espace_id uuid not null references public.espaces(id) on delete cascade,
    titre text not null,
    matiere text not null,
    niveau text,
    duree int not null default 30,
    resume text,
    objectifs text[] not null default '{}',
    contenu text not null,
    contenu_html text,
    support_url text,
    support_nom text,
    support_taille text,
    classe_ids text[] not null default '{}',
    couverture_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
    id text primary key,
    espace_id uuid not null references public.espaces(id) on delete cascade,
    titre text not null,
    matiere text not null,
    type text not null check (type in ('quiz', 'matching', 'fillblank')),
    actif boolean not null default true,
    temps int,
    questions jsonb not null default '[]'::jsonb,
    pairs jsonb not null default '[]'::jsonb,
    quotes jsonb not null default '[]'::jsonb,
    devoir boolean not null default false,
    classe_ids text[] not null default '{}',
    echeance date,
    consigne text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.resources (
    id text primary key,
    espace_id uuid not null references public.espaces(id) on delete cascade,
    titre text not null,
    type text,
    matiere text,
    url text not null,
    taille text,
    classe_ids text[] not null default '{}',
    created_at timestamptz not null default now()
);

create table if not exists public.attempts (
    id text primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    exercise_id text not null,
    type text,
    titre text,
    score int not null default 0,
    total int not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.tutorial_progress (
    user_id uuid not null references public.profiles(id) on delete cascade,
    resource_id text not null,
    completed_at timestamptz not null default now(),
    primary key (user_id, resource_id)
);

create table if not exists public.messages (
    id text primary key,
    nom text not null,
    email text not null,
    sujet text not null,
    message text not null,
    created_at timestamptz not null default now()
);

-- Bibliothèque publique de documentation (livres, cours, fichiers).
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
    visibilite text not null default 'public',
    created_at timestamptz not null default now()
);

-- Visibilité : 'public' (tout le monde), 'eleves' (comptes connectés),
-- 'enseignants' (admin et super-admin).
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

create index if not exists idx_documents_matiere on public.documents (matiere);
create index if not exists idx_documents_niveau on public.documents (niveau);

-- ----------------------------------------------------------------------------
-- 2. Index
-- ----------------------------------------------------------------------------

create index if not exists idx_profiles_espace on public.profiles (espace_id);
create index if not exists idx_profiles_classe on public.profiles (classe_id);
create index if not exists idx_classes_espace on public.classes (espace_id);
create index if not exists idx_lessons_espace on public.lessons (espace_id);
create index if not exists idx_exercises_espace on public.exercises (espace_id);
create index if not exists idx_exercises_classe_ids on public.exercises using gin (classe_ids);
create index if not exists idx_resources_espace on public.resources (espace_id);
create index if not exists idx_resources_classe_ids on public.resources using gin (classe_ids);
create index if not exists idx_attempts_user on public.attempts (user_id);
create index if not exists idx_attempts_exercise on public.attempts (exercise_id);

-- ----------------------------------------------------------------------------
-- 3. Fonctions utilitaires (rôle et espace de l'utilisateur connecté)
-- ----------------------------------------------------------------------------

create or replace function public.mon_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role from public.profiles where id = auth.uid()), 'anonyme');
$$;

-- Espace de l'utilisateur : celui de l'enseignant, ou celui de la classe de l'élève.
create or replace function public.mon_espace()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(p.espace_id, c.espace_id)
    from public.profiles p
    left join public.classes c on c.id = p.classe_id
    where p.id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 4. Création automatique du profil à l'inscription
-- ----------------------------------------------------------------------------

create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text;
    v_role text;
    v_espace uuid;
begin
    v_username := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1));
    v_role := coalesce(new.raw_user_meta_data ->> 'role', 'eleve');

    -- Sécurité : le rôle super-admin ne peut jamais venir de l'inscription.
    if v_role not in ('eleve', 'admin') then
        v_role := 'eleve';
    end if;

    if exists (select 1 from public.profiles where username = v_username) then
        v_username := v_username || '_' || substr(new.id::text, 1, 4);
    end if;

    if v_role = 'admin' then
        insert into public.espaces (nom, owner_id)
        values ('Espace de ' || v_username, new.id)
        returning id into v_espace;
    end if;

    insert into public.profiles (id, username, email, role, espace_id)
    values (new.id, v_username, new.email, v_role, v_espace);

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.creer_profil();

create or replace function public.synchroniser_email_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.profiles
    set email = new.email
    where id = new.id
      and email is distinct from new.email;
    return new;
end;
$$;

drop trigger if exists synchroniser_email_auth_profil on auth.users;
create trigger synchroniser_email_auth_profil
    after update of email on auth.users
    for each row
    when (old.email is distinct from new.email)
    execute function public.synchroniser_email_profil();

-- ----------------------------------------------------------------------------
-- 5. Rejoindre une classe avec un code (contourne la RLS de façon contrôlée)
-- ----------------------------------------------------------------------------

drop function if exists public.lister_classes_inscription(text, text);
create function public.lister_classes_inscription(
    p_matiere text,
    p_niveau text
)
returns table (id text, nom text)
language plpgsql
security definer
set search_path = public
as $$
begin
    if nullif(trim(p_matiere), '') is null or nullif(trim(p_niveau), '') is null then
        raise exception 'Matière et niveau obligatoires';
    end if;

    return query
    select c.id, c.nom
    from public.classes c
    where (nullif(trim(c.matiere), '') is null or c.matiere = trim(p_matiere))
      and (nullif(trim(c.niveau), '') is null or c.niveau = trim(p_niveau))
    order by c.nom, c.id;
end;
$$;

revoke all on function public.lister_classes_inscription(text, text) from public;
grant execute on function public.lister_classes_inscription(text, text) to anon, authenticated;

create or replace function public.rejoindre_classe_selectionnee(
    p_classe_id text,
    p_matiere text,
    p_niveau text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_espace uuid;
    v_matiere text;
    v_niveau text;
    v_role text;
begin
    if auth.uid() is null then
        raise exception 'Connexion requise';
    end if;

    select role into v_role
    from public.profiles
    where id = auth.uid();

    if v_role is distinct from 'eleve' then
        raise exception 'Réservé aux élèves uniquement';
    end if;

    select c.espace_id, c.matiere, c.niveau
    into v_espace, v_matiere, v_niveau
    from public.classes c
    where c.id = p_classe_id;

    if v_espace is null then
        raise exception 'Classe introuvable';
    end if;

    if p_matiere is null or (v_matiere is not null and v_matiere <> p_matiere) then
        raise exception 'Cette classe ne correspond pas à la matière sélectionnée';
    end if;
    if p_niveau is null or (v_niveau is not null and v_niveau <> p_niveau) then
        raise exception 'Cette classe ne correspond pas au niveau sélectionné';
    end if;

    perform set_config('learnhub.bypass', 'on', true);
    update public.profiles set classe_id = p_classe_id where id = auth.uid();
    perform set_config('learnhub.bypass', '', true);

    return v_espace;
end;
$$;

revoke all on function public.rejoindre_classe_selectionnee(text, text, text) from public;
grant execute on function public.rejoindre_classe_selectionnee(text, text, text) to authenticated;

drop function if exists public.rejoindre_classe(text);
drop function if exists public.rejoindre_classe(text, text, text);
create function public.rejoindre_classe(
    p_code text,
    p_matiere text default null,
    p_niveau text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_classe text;
    v_espace uuid;
    v_matiere text;
    v_niveau text;
begin
    if auth.uid() is null then
        raise exception 'Connexion requise';
    end if;

    select id, espace_id, matiere, niveau
    into v_classe, v_espace, v_matiere, v_niveau
    from public.classes
    where upper(code) = upper(trim(p_code));

    if v_classe is null then
        raise exception 'Code de classe inconnu';
    end if;

    if p_matiere is not null and v_matiere is not null and p_matiere <> v_matiere then
        raise exception 'Cette classe ne correspond pas à la matière sélectionnée';
    end if;
    if p_niveau is not null and v_niveau is not null and p_niveau <> v_niveau then
        raise exception 'Cette classe ne correspond pas au niveau sélectionné';
    end if;

    -- Le code fait foi : on autorise exceptionnellement cette écriture au
    -- déclencheur de protection, qui interdit sinon de s'auto-affecter une classe.
    perform set_config('learnhub.bypass', 'on', true);
    update public.profiles set classe_id = v_classe where id = auth.uid();
    perform set_config('learnhub.bypass', '', true);

    return v_espace;
end;
$$;

grant execute on function public.rejoindre_classe(text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5 bis. Gestion des comptes réservée au super-administrateur
-- ----------------------------------------------------------------------------

create or replace function public.admin_supprimer_compte(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if public.mon_role() <> 'superadmin' then
        raise exception 'Réservé au super-administrateur';
    end if;
    if p_id = auth.uid() then
        raise exception 'Impossible de supprimer votre propre compte';
    end if;
    if not exists (select 1 from public.profiles where id = p_id) then
        raise exception 'Compte introuvable';
    end if;

    delete from auth.users where id = p_id;
end;
$$;

grant execute on function public.admin_supprimer_compte(uuid) to authenticated;

create or replace function public.admin_changer_role(p_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_nom text;
    v_espace uuid;
begin
    if public.mon_role() <> 'superadmin' then
        raise exception 'Réservé au super-administrateur';
    end if;
    if p_role not in ('eleve', 'admin', 'superadmin') then
        raise exception 'Rôle invalide';
    end if;
    if p_id = auth.uid() and p_role <> 'superadmin' then
        raise exception 'Impossible de retirer votre propre rôle super-administrateur';
    end if;

    select username, espace_id into v_nom, v_espace
    from public.profiles where id = p_id;

    if v_nom is null then
        raise exception 'Compte introuvable';
    end if;

    if p_role = 'admin' and v_espace is null then
        insert into public.espaces (nom, owner_id)
        values ('Espace de ' || v_nom, p_id)
        returning id into v_espace;
    end if;

    update public.profiles
    set role = p_role,
        espace_id = v_espace
    where id = p_id;
end;
$$;

grant execute on function public.admin_changer_role(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Protection des champs sensibles des profils
-- ----------------------------------------------------------------------------

create or replace function public.proteger_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text;
begin
    -- Console SQL et service_role : aucun utilisateur authentifié, on laisse passer
    -- (nécessaire pour attribuer le rôle superadmin et gérer les comptes).
    if auth.uid() is null then
        return new;
    end if;

    -- Écriture autorisée explicitement par une fonction de confiance (rejoindre_classe).
    if coalesce(current_setting('learnhub.bypass', true), '') = 'on' then
        return new;
    end if;

    v_role := public.mon_role();

    if v_role = 'superadmin' then
        return new;
    end if;

    -- Rôle, espace et nom d'utilisateur ne changent jamais sans super-admin.
    new.role := old.role;
    new.espace_id := old.espace_id;
    new.username := old.username;

    -- Détachement d'une classe : suppression de la classe (cascade), élève
    -- retiré par son enseignant, ou élève qui quitte sa classe.
    if new.classe_id is null then
        return new;
    end if;

    -- Un élève ne rejoint une classe que par le code, via rejoindre_classe().
    if auth.uid() = old.id then
        if v_role <> 'admin' then
            new.classe_id := old.classe_id;
        end if;
        return new;
    end if;

    -- Un enseignant peut gérer ses élèves et ses propres comptes enseignants.
    if v_role = 'admin' and (
        old.espace_id = public.mon_espace()
        or exists (
            select 1 from public.classes c
            where c.id = old.classe_id and c.espace_id = public.mon_espace()
        )
    ) then
        return new;
    end if;

    raise exception 'Modification de profil non autorisée';
end;
$$;

drop trigger if exists proteger_profil on public.profiles;
create trigger proteger_profil
    before update on public.profiles
    for each row execute function public.proteger_profil();

-- ----------------------------------------------------------------------------
-- 7. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.espaces enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.resources enable row level security;
alter table public.attempts enable row level security;
alter table public.tutorial_progress enable row level security;
alter table public.messages enable row level security;

-- Espaces -------------------------------------------------------------------
drop policy if exists espaces_select on public.espaces;
create policy espaces_select on public.espaces
    for select using (id = public.mon_espace() or public.mon_role() = 'superadmin');

drop policy if exists espaces_update on public.espaces;
create policy espaces_update on public.espaces
    for update using (owner_id = auth.uid() or public.mon_role() = 'superadmin');

-- Profils -------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
    for select using (
        id = auth.uid()
        or public.mon_role() = 'superadmin'
        or (
            public.mon_role() = 'admin' and (
                espace_id = public.mon_espace()
                or classe_id in (select id from public.classes where espace_id = public.mon_espace())
            )
        )
    );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
    for update using (
        id = auth.uid()
        or public.mon_role() = 'superadmin'
        or (
            public.mon_role() = 'admin' and (
                espace_id = public.mon_espace()
                or classe_id in (select id from public.classes where espace_id = public.mon_espace())
            )
        )
    );

-- Classes -------------------------------------------------------------------
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
    for select using (espace_id = public.mon_espace() or public.mon_role() = 'superadmin');

drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes
    for all using (
        public.mon_role() = 'superadmin'
        or (public.mon_role() = 'admin' and espace_id = public.mon_espace())
    )
    with check (
        public.mon_role() = 'superadmin'
        or (public.mon_role() = 'admin' and espace_id = public.mon_espace())
    );

-- Contenus (leçons, exercices, ressources) ------------------------------------
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
    for select using (espace_id = public.mon_espace() or public.mon_role() = 'superadmin');

drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons
    for all using (
        public.mon_role() = 'superadmin'
        or (public.mon_role() = 'admin' and espace_id = public.mon_espace())
    )
    with check (
        public.mon_role() = 'superadmin'
        or (public.mon_role() = 'admin' and espace_id = public.mon_espace())
    );

drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises
    for select using (espace_id = public.mon_espace() or public.mon_role() = 'superadmin');

drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises
    for all using (
        public.mon_role() = 'superadmin'
        or (public.mon_role() = 'admin' and espace_id = public.mon_espace())
    )
    with check (
        public.mon_role() = 'superadmin'
        or (public.mon_role() = 'admin' and espace_id = public.mon_espace())
    );

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources
    for select using (espace_id = public.mon_espace() or public.mon_role() = 'superadmin');

drop policy if exists resources_write on public.resources;
create policy resources_write on public.resources
    for all using (
        public.mon_role() = 'superadmin'
        or (public.mon_role() = 'admin' and espace_id = public.mon_espace())
    )
    with check (
        public.mon_role() = 'superadmin'
        or (public.mon_role() = 'admin' and espace_id = public.mon_espace())
    );

-- Résultats -----------------------------------------------------------------
drop policy if exists attempts_insert on public.attempts;
create policy attempts_insert on public.attempts
    for insert with check (user_id = auth.uid());

drop policy if exists attempts_select on public.attempts;
create policy attempts_select on public.attempts
    for select using (
        user_id = auth.uid()
        or public.mon_role() = 'superadmin'
        or (
            public.mon_role() = 'admin' and exists (
                select 1
                from public.profiles p
                left join public.classes c on c.id = p.classe_id
                where p.id = attempts.user_id
                  and c.espace_id = public.mon_espace()
            )
        )
    );

drop policy if exists attempts_delete on public.attempts;
create policy attempts_delete on public.attempts
    for delete using (
        user_id = auth.uid()
        or public.mon_role() = 'superadmin'
        or (
            public.mon_role() = 'admin' and exists (
                select 1
                from public.profiles p
                left join public.classes c on c.id = p.classe_id
                where p.id = attempts.user_id
                  and c.espace_id = public.mon_espace()
            )
        )
    );

drop policy if exists tutorial_progress_select on public.tutorial_progress;
create policy tutorial_progress_select on public.tutorial_progress
    for select to authenticated
    using (user_id = auth.uid() and public.mon_role() = 'eleve');

drop policy if exists tutorial_progress_insert on public.tutorial_progress;
create policy tutorial_progress_insert on public.tutorial_progress
    for insert to authenticated
    with check (user_id = auth.uid() and public.mon_role() = 'eleve');

-- Messages de contact -------------------------------------------------------
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
    for insert with check (true);

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
    for select using (public.mon_role() = 'superadmin');

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
    for delete using (public.mon_role() = 'superadmin');

-- Bibliothèque publique ------------------------------------------------------
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
    for select using (
        visibilite = 'public'
        or (auth.uid() is not null and visibilite = 'eleves')
        or (visibilite = 'enseignants' and public.mon_role() in ('admin', 'superadmin'))
    );

drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
    for all using (public.mon_role() in ('admin', 'superadmin'))
    with check (public.mon_role() in ('admin', 'superadmin'));

-- ----------------------------------------------------------------------------
-- 8. Droits d'accès (RLS reste la barrière de sécurité)
-- ----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant insert on public.messages to anon;
grant select on public.documents to anon;

-- Stockage des fichiers de la bibliothèque (bucket public).
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

-- ----------------------------------------------------------------------------
-- 9. Journal global des activités (visible uniquement au super-administrateur)
-- ----------------------------------------------------------------------------

create table if not exists public.audit_events (
    id bigint generated always as identity primary key,
    actor_user_id uuid references auth.users(id) on delete set null,
    subject_user_id uuid references auth.users(id) on delete set null,
    action text not null,
    entity text not null,
    entity_id text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_created
    on public.audit_events (created_at desc, id desc);
create index if not exists idx_audit_events_actor
    on public.audit_events (actor_user_id, created_at desc);
create index if not exists idx_audit_events_subject
    on public.audit_events (subject_user_id, created_at desc);

alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

drop policy if exists audit_events_superadmin_select on public.audit_events;
create policy audit_events_superadmin_select on public.audit_events
    for select to authenticated
    using (public.mon_role() = 'superadmin');

create or replace function public.journaliser_changement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
    v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
    v_ligne jsonb;
    v_action text;
    v_id text;
    v_sujet uuid;
    v_details jsonb := '{}'::jsonb;
begin
    v_ligne := case when tg_op = 'DELETE' then v_old else v_new end;
    v_action := lower(tg_op);
    if v_action = 'insert' then v_action := 'created'; end if;
    if v_action = 'update' then v_action := 'updated'; end if;
    if v_action = 'delete' then v_action := 'deleted'; end if;

    v_id := coalesce(v_ligne ->> 'id', v_ligne ->> 'user_id');
    if tg_table_name = 'profiles' then
        v_sujet := nullif(v_ligne ->> 'id', '')::uuid;
        v_details := jsonb_build_object(
            'username', v_ligne ->> 'username',
            'role', v_ligne ->> 'role',
            'previous_role', v_old ->> 'role',
            'class_id', v_ligne ->> 'classe_id',
            'previous_class_id', v_old ->> 'classe_id'
        );
    elsif tg_table_name in ('attempts', 'ia_contenus', 'ia_quotas') then
        v_sujet := nullif(v_ligne ->> 'user_id', '')::uuid;
        if tg_table_name = 'attempts' then
            v_details := jsonb_build_object(
                'title', v_ligne ->> 'titre',
                'type', v_ligne ->> 'type',
                'score', v_ligne ->> 'score',
                'total', v_ligne ->> 'total'
            );
        elsif tg_table_name = 'ia_contenus' then
            v_details := jsonb_build_object('type', v_ligne ->> 'type');
        else
            v_details := jsonb_build_object(
                'jour', v_ligne ->> 'jour',
                'etudes', v_ligne ->> 'etudes',
                'questions', v_ligne ->> 'questions'
            );
        end if;
    elsif tg_table_name = 'espaces' then
        v_sujet := nullif(v_ligne ->> 'owner_id', '')::uuid;
        v_details := jsonb_build_object('name', v_ligne ->> 'nom');
    elsif tg_table_name = 'classes' then
        v_details := jsonb_build_object(
            'name', v_ligne ->> 'nom',
            'subject', v_ligne ->> 'matiere',
            'level', v_ligne ->> 'niveau'
        );
    elsif tg_table_name in ('lessons', 'exercises', 'resources', 'documents') then
        v_details := jsonb_build_object(
            'title', coalesce(v_ligne ->> 'titre', v_ligne ->> 'title'),
            'type', v_ligne ->> 'type'
        );
    elsif tg_table_name = 'messages' then
        v_details := jsonb_build_object('subject', v_ligne ->> 'sujet');
    end if;

    insert into public.audit_events (
        actor_user_id, subject_user_id, action, entity, entity_id, details
    ) values (
        auth.uid(), v_sujet, v_action, tg_table_name, v_id, v_details
    );

    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

do $$
declare
    v_table text;
begin
    foreach v_table in array array[
        'espaces', 'profiles', 'classes', 'lessons', 'exercises',
        'resources', 'attempts', 'messages', 'documents', 'ia_contenus',
        'ia_quotas'
    ] loop
        if to_regclass('public.' || v_table) is not null then
            execute format('drop trigger if exists journaliser_changement on public.%I', v_table);
            execute format(
                'create trigger journaliser_changement after insert or update or delete on public.%I for each row execute function public.journaliser_changement()',
                v_table
            );
        end if;
    end loop;
end;
$$;

revoke all on function public.journaliser_changement() from public, anon, authenticated;

create or replace function public.journaliser_authentification(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Connexion requise';
    end if;
    if p_action is null or p_action not in ('login', 'logout') then
        raise exception 'Action d’authentification invalide';
    end if;

    insert into public.audit_events (actor_user_id, subject_user_id, action, entity, entity_id)
    values (v_uid, v_uid, p_action, 'auth', v_uid::text);
end;
$$;

revoke all on function public.journaliser_authentification(text) from public, anon;
grant execute on function public.journaliser_authentification(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10. Promouvoir un super-administrateur (à exécuter manuellement)
--
-- Après avoir créé le compte via l'application :
--   update public.profiles set role = 'superadmin' where username = 'votre_pseudo';
-- ----------------------------------------------------------------------------
