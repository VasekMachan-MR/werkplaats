-- Hlídání role: změnu smí majitel, serverová funkce správy uživatelů (service_role) a správce databáze
create or replace function hlidej_roli() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.aktivni is distinct from old.aktivni or new.id is distinct from old.id)
     and not soukrome.je_majitel()
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Roli a přístup může měnit jen majitel';
  end if;
  return new;
end $$;
