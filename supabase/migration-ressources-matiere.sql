-- Associe une ressource à une matière pour organiser la playlist de tutoriels.
alter table public.resources
    add column if not exists matiere text;
