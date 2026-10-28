-- LearnHub — migration à exécuter une seule fois sur un projet Supabase déjà créé.
--
-- Corrige le déclencheur de protection des profils :
--   1. les modifications lancées depuis le SQL Editor (aucun utilisateur connecté)
--      ne sont plus refusées : l'attribution du rôle superadmin devient possible ;
--   2. supprimer une classe contenant des élèves ne provoque plus
--      « Modification de profil non autorisée » (la cascade de la clé étrangère
--      passe désormais) ;
--   3. un élève ne peut plus s'affecter une classe en écrivant directement dans
--      la table : seul le code de classe, vérifié par rejoindre_classe(), le permet.
--
-- À coller dans Supabase → SQL Editor → Run. Le script est idempotent.

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

    perform set_config('learnhub.bypass', 'on', true);
    update public.profiles set classe_id = v_classe where id = auth.uid();
    perform set_config('learnhub.bypass', '', true);

    return v_espace;
end;
$$;

grant execute on function public.rejoindre_classe(text) to authenticated;

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

    -- Écriture autorisée explicitement par une fonction de confiance (rejoindre_classe).
    if coalesce(current_setting('learnhub.bypass', true), '') = 'on' then
        return new;
    end if;

    v_role := public.mon_role();

    if v_role = 'superadmin' then
        return new;
    end if;

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
