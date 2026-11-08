-- LearnHub — journal global des activités réservé au super-administrateur.
-- À exécuter une fois dans Supabase → SQL Editor → Run.

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
