-- 041: rozepsaný název dílu nenechá ve skladu prázdnou položku (Vašek 31.10.2026, „micheli“, „contin“)
-- Díly v zakázce se ukládají samy chvíli po dopsání; z rozepsaného názvu tak vznikla položka skladu a po dopsání
-- názvu další. Nově: když se díl přepojí na jinou položku skladu, předchozí položka se smaže, ale JEN pokud
--   * vznikla před méně než hodinou (tj. právě při psaní),
--   * nemá žádný pohyb (příjem, výdej, inventuru), nulové množství,
--   * a neodkazuje na ni žádný jiný díl.
-- Starší a používané položky se nikdy nemažou.
create or replace function public.uklid_rozepsane_polozky() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.sklad_id is not null and new.sklad_id is distinct from old.sklad_id then
    delete from public.sklad s
     where s.id = old.sklad_id
       and s.vytvoreno > now() - interval '1 hour'
       and coalesce(s.mnozstvi, 0) = 0
       and not exists (select 1 from public.sklad_pohyby p where p.sklad_id = s.id)
       and not exists (select 1 from public.dily d where d.sklad_id = s.id);
  end if;
  return null;
end $$;
revoke execute on function public.uklid_rozepsane_polozky() from public, anon, authenticated;
drop trigger if exists uklid_rozepsane_polozky on public.dily;
-- bez „update of sklad_id“: přepojení dělá trigger dil_do_katalogu, ne příkaz UPDATE, proto podmínka WHEN
create trigger uklid_rozepsane_polozky after update on public.dily
  for each row when (old.sklad_id is not null and old.sklad_id is distinct from new.sklad_id)
  execute function public.uklid_rozepsane_polozky();
