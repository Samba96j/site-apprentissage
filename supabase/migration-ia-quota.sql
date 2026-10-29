-- ============================================================================
-- LearnHub — quota serveur de l'assistant IA
--
-- À coller dans Supabase → SQL Editor → Run. Le script est idempotent.
--
-- Pourquoi : le quota d'origine comptait les lignes de `ia_contenus`, une table
-- alimentée par le navigateur. Un appel direct à la fonction, sans
-- enregistrement, ne consommait donc rien. Le compteur ci-dessous est tenu
-- côté base, par la fonction elle-même : impossible à remettre à zéro depuis
-- le client, et valable pour les deux modes (étude et question).
-- ============================================================================

create table if not exists public.ia_quotas (
    user_id uuid not null references public.profiles(id) on delete cascade,
    jour date not null default current_date,
    etudes int not null default 0,
    questions int not null default 0,
    primary key (user_id, jour)
);

create index if not exists idx_ia_quotas_jour on public.ia_quotas (jour);

alter table public.ia_quotas enable row level security;

-- Lecture de son propre compteur uniquement ; l'écriture est réservée aux
-- fonctions ci-dessous (security definer), donc à aucune requête du client.
drop policy if exists ia_quotas_select on public.ia_quotas;
create policy ia_quotas_select on public.ia_quotas
    for select using (user_id = auth.uid() or public.mon_role() = 'superadmin');

-- Réserve une génération. Renvoie { autorise, motif, utilisees, limite }.
create or replace function public.ia_consommer(
    p_type text,
    p_limite_etudes int default 30,
    p_limite_questions int default 60,
    p_limite_globale int default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_etudes int := 0;
    v_questions int := 0;
    v_total int := 0;
    v_limite int;
begin
    if v_uid is null then
        raise exception 'Connexion requise';
    end if;

    if p_type not in ('etude', 'question') then
        raise exception 'Type invalide';
    end if;

    insert into public.ia_quotas (user_id, jour)
    values (v_uid, current_date)
    on conflict (user_id, jour) do nothing;

    select etudes, questions into v_etudes, v_questions
    from public.ia_quotas
    where user_id = v_uid and jour = current_date
    for update;

    -- Plafond global : protège le projet entier (comptes multiples, abus).
    select coalesce(sum(etudes + questions), 0) into v_total
    from public.ia_quotas
    where jour = current_date;

    if v_total >= p_limite_globale then
        return jsonb_build_object(
            'autorise', false,
            'motif', 'global',
            'utilisees', v_total,
            'limite', p_limite_globale
        );
    end if;

    v_limite := case when p_type = 'etude' then p_limite_etudes else p_limite_questions end;

    if (case when p_type = 'etude' then v_etudes else v_questions end) >= v_limite then
        return jsonb_build_object(
            'autorise', false,
            'motif', 'personnel',
            'type', p_type,
            'utilisees', case when p_type = 'etude' then v_etudes else v_questions end,
            'limite', v_limite
        );
    end if;

    if p_type = 'etude' then
        update public.ia_quotas set etudes = etudes + 1
        where user_id = v_uid and jour = current_date;
    else
        update public.ia_quotas set questions = questions + 1
        where user_id = v_uid and jour = current_date;
    end if;

    return jsonb_build_object(
        'autorise', true,
        'type', p_type,
        'utilisees', case when p_type = 'etude' then v_etudes + 1 else v_questions + 1 end,
        'limite', v_limite
    );
end;
$$;

grant execute on function public.ia_consommer(text, int, int, int) to authenticated;

-- Rend la réservation quand la génération échoue côté fournisseur.
create or replace function public.ia_liberer(p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null or p_type not in ('etude', 'question') then
        return;
    end if;

    if p_type = 'etude' then
        update public.ia_quotas set etudes = greatest(etudes - 1, 0)
        where user_id = v_uid and jour = current_date;
    else
        update public.ia_quotas set questions = greatest(questions - 1, 0)
        where user_id = v_uid and jour = current_date;
    end if;
end;
$$;

grant execute on function public.ia_liberer(text) to authenticated;
