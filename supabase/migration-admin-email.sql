-- Synchronise l’adresse Auth avec le profil lors d’une modification par
-- l’API d’administration Supabase. L’opération reste atomique avec auth.users.
create or replace function public.synchroniser_email_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.profiles
    set email = new.email
    where id = new.id
      and email is distinct from new.email;
    return new;
end;
$$;

drop trigger if exists synchroniser_email_auth_profil on auth.users;
create trigger synchroniser_email_auth_profil
    after update of email on auth.users
    for each row
    when (old.email is distinct from new.email)
    execute function public.synchroniser_email_profil();
