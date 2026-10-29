-- ============================================================================
-- LearnHub — assistant IA : études d'œuvres et questions
--
-- À coller dans Supabase → SQL Editor → Run. Le script est idempotent.
--
-- Une ligne par génération, rattachée à son auteur. La policy RLS garantit
-- que chaque élève ne voit que ses propres contenus.
-- ============================================================================

create table if not exists public.ia_contenus (
    id text primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    type text not null check (type in ('etude', 'question')),
    requete text not null,
    auteur text,
    niveau text,
    modele text,
    contenu jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_ia_contenus_user
    on public.ia_contenus (user_id, created_at desc);

alter table public.ia_contenus enable row level security;

drop policy if exists ia_contenus_select on public.ia_contenus;
create policy ia_contenus_select on public.ia_contenus
    for select using (user_id = auth.uid() or public.mon_role() = 'superadmin');

drop policy if exists ia_contenus_insert on public.ia_contenus;
create policy ia_contenus_insert on public.ia_contenus
    for insert with check (user_id = auth.uid());

drop policy if exists ia_contenus_delete on public.ia_contenus;
create policy ia_contenus_delete on public.ia_contenus
    for delete using (user_id = auth.uid() or public.mon_role() = 'superadmin');
