-- LearnHub — migration à exécuter une seule fois sur un projet Supabase déjà créé.
--
-- Sans elle, toute modification de profil lancée depuis le SQL Editor échoue
-- avec « Modification de profil non autorisée » : le déclencheur de protection
-- ne distinguait pas la console d'administration d'une requête anonyme.
-- À coller dans Supabase → SQL Editor → Run. Le script est idempotent.

create or replace function public.proteger_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text;
begin
    -- Console SQL et service_role : aucun utilisateur authentifié, on laisse passer.
    if auth.uid() is null then
        return new;
    end if;

    v_role := public.mon_role();

    if v_role = 'superadmin' then
        return new;
    end if;

    if auth.uid() = old.id then
        new.role := old.role;
        new.espace_id := old.espace_id;
        return new;
    end if;

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
