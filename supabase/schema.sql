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
--   lessons    : leçons rédigées par un enseignant
--   exercises  : exercices (quiz, associations, textes à trous)
--   resources  : liens et documents
--   seances    : séances planifiées
--   attempts   : résultats des élèves
--   messages   : messages du formulaire de contact
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
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.resources (
    id text primary key,
    espace_id uuid not null references public.espaces(id) on delete cascade,
    titre text not null,
    type text,
    url text not null,
    taille text,
    created_at timestamptz not null default now()
);

create table if not exists public.seances (
    id text primary key,
    espace_id uuid not null references public.espaces(id) on delete cascade,
    titre text not null,
    description text,
    date date not null,
    duree int not null default 60,
    publie boolean not null default true,
    classe_ids text[] not null default '{}',
    chapter_ids text[] not null default '{}',
    lesson_ids text[] not null default '{}',
    exercise_ids text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Migration : les premières versions du schéma utilisaient uuid[] pour ces
-- colonnes. Les identifiants de contenu sont textuels, on convertit donc.
do $$
declare
    col text;
begin
    foreach col in array array['classe_ids', 'chapter_ids', 'lesson_ids', 'exercise_ids'] loop
        if exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'seances'
              and column_name = col
              and udt_name <> '_text'
        ) then
            execute format('alter table public.seances alter column %I drop default', col);
            execute format('alter table public.seances alter column %I type text[] using %I::text[]', col, col);
            execute format('alter table public.seances alter column %I set default ''{}''::text[]', col);
        end if;
    end loop;
end;
$$;

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
create index if not exists idx_resources_espace on public.resources (espace_id);
create index if not exists idx_seances_espace on public.seances (espace_id);
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

-- ----------------------------------------------------------------------------
-- 5. Rejoindre une classe avec un code (contourne la RLS de façon contrôlée)
-- ----------------------------------------------------------------------------

create or replace function public.rejoindre_classe(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_classe text;
    v_espace uuid;
begin
    if auth.uid() is null then
        raise exception 'Connexion requise';
    end if;

    select id, espace_id into v_classe, v_espace
    from public.classes
    where upper(code) = upper(trim(p_code));

    if v_classe is null then
        raise exception 'Code de classe inconnu';
    end if;

    -- Le code fait foi : on autorise exceptionnellement cette écriture au
    -- déclencheur de protection, qui interdit sinon de s'auto-affecter une classe.
    perform set_config('learnhub.bypass', 'on', true);
    update public.profiles set classe_id = v_classe where id = auth.uid();
    perform set_config('learnhub.bypass', '', true);

    return v_espace;
end;
$$;

grant execute on function public.rejoindre_classe(text) to authenticated;

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
alter table public.seances enable row level security;
alter table public.attempts enable row level security;
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

-- Contenus (leçons, exercices, ressources, séances) ---------------------------
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

drop policy if exists seances_select on public.seances;
create policy seances_select on public.seances
    for select using (espace_id = public.mon_espace() or public.mon_role() = 'superadmin');

drop policy if exists seances_write on public.seances;
create policy seances_write on public.seances
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
-- 9. Promouvoir un super-administrateur (à exécuter manuellement)
--
-- Après avoir créé le compte via l'application :
--   update public.profiles set role = 'superadmin' where username = 'votre_pseudo';
-- ----------------------------------------------------------------------------
