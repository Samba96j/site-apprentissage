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
    classe_ids uuid[] not null default '{}',
    chapter_ids text[] not null default '{}',
    lesson_ids text[] not null default '{}',
    exercise_ids text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
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

create table if not exists public.messages (
    id text primary key,
    nom text not null,
    email text not null,
    sujet text not null,
    message text not null,
    created_at timestamptz not null default now()
);

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

    update public.profiles set classe_id = v_classe where id = auth.uid();
    return v_espace;
end;
$$;

grant execute on function public.rejoindre_classe(text) to authenticated;

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
    v_role := public.mon_role();

    if v_role = 'superadmin' then
        return new;
    end if;

    -- L'utilisateur ne peut pas changer son propre rôle ni son espace.
    if auth.uid() = old.id then
        new.role := old.role;
        new.espace_id := old.espace_id;
        return new;
    end if;

    -- Un enseignant peut gérer ses élèves et ses propres comptes enseignants.
    if v_role = 'admin' and new.role in ('eleve', 'admin') and (
        old.espace_id = public.mon_espace()
        or old.classe_id in (select id from public.classes where espace_id = public.mon_espace())
    ) then
        new.espace_id := old.espace_id;
        new.username := old.username;
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

-- ----------------------------------------------------------------------------
-- 8. Droits d'accès (RLS reste la barrière de sécurité)
-- ----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant insert on public.messages to anon;

-- ----------------------------------------------------------------------------
-- 9. Promouvoir un super-administrateur (à exécuter manuellement)
--
-- Après avoir créé le compte via l'application :
--   update public.profiles set role = 'superadmin' where username = 'votre_pseudo';
-- ----------------------------------------------------------------------------
