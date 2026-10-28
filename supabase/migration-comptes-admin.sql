-- LearnHub — gestion des comptes depuis l'interface super-admin.
--
-- À exécuter une fois dans Supabase → SQL Editor → Run. Le script est idempotent
-- et sans danger. Il crée deux fonctions réservées au rôle super-admin :
--   • admin_supprimer_compte : supprime le compte d'authentification (et, en
--     cascade, son profil, son espace et ses contenus) ;
--   • admin_changer_role     : change le rôle et crée un espace si le compte
--     devient enseignant.

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

    -- Un enseignant a besoin d'un espace pour créer ses classes.
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
