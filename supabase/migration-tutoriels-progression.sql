-- Progression des tutoriels, isolée des scores d'exercices.
create table if not exists public.tutorial_progress (
    user_id uuid not null references public.profiles(id) on delete cascade,
    resource_id text not null,
    completed_at timestamptz not null default now(),
    primary key (user_id, resource_id)
);

alter table public.tutorial_progress enable row level security;

drop policy if exists tutorial_progress_select on public.tutorial_progress;
create policy tutorial_progress_select on public.tutorial_progress
    for select to authenticated
    using (user_id = auth.uid() and public.mon_role() = 'eleve');

drop policy if exists tutorial_progress_insert on public.tutorial_progress;
create policy tutorial_progress_insert on public.tutorial_progress
    for insert to authenticated
    with check (user_id = auth.uid() and public.mon_role() = 'eleve');
