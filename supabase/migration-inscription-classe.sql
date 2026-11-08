-- LearnHub — afficher les classes adaptées et rattacher l'élève dès l'inscription.
--
-- À exécuter une fois dans Supabase → SQL Editor → Run.

alter table public.classes add column if not exists matiere text;

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

    perform set_config('learnhub.bypass', 'on', true);
    update public.profiles set classe_id = v_classe where id = auth.uid();
    perform set_config('learnhub.bypass', '', true);

    return v_espace;
end;
$$;

grant execute on function public.rejoindre_classe(text, text, text) to authenticated;
