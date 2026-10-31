-- 045: původní (papírový) zakázkový list ze starého systému se v E-servisce skryje, jakmile zakázka dostane
-- nový zakázkový list z Werkplaats (Vašek 31.10.2026: „v E-servisce jsou pak 2 zakázkové listy“).
-- Přepne se jen viditelnost (soubory.verejne = false) – soubor zůstává ve Werkplaats v „Ostatních dokumentech“
-- a jde znovu zobrazit tlačítkem 👁. Spustí se jen u PRVNÍHO zakázkového listu zakázky (nové verze už nic nepřepínají,
-- takže ruční zapnutí 👁 vydrží).
-- Název původního listu stejně jako v aplikaci (archivProZakaznika): začíná „Zakázkový list“ / „Work order“.

create or replace function soukrome.skryt_puvodni_zakazkovy_list() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.druh = 'zakazkovy_list'
     and not exists (select 1 from doklady d where d.zakazka_id = new.zakazka_id and d.druh = 'zakazkovy_list' and d.id <> new.id) then
    update soubory set verejne = false
     where zakazka_id = new.zakazka_id and druh = 'archiv' and smazano is null and verejne is distinct from false
       and nazev ~* '^(zak[aá]zkov[ýy][ _]list|work[ _]order)';
  end if;
  return new;
end $$;

drop trigger if exists skryt_puvodni_list on public.doklady;
create trigger skryt_puvodni_list after insert on public.doklady
  for each row execute function soukrome.skryt_puvodni_zakazkovy_list();

-- jednorázově pro zakázky, které už nový list mají (31.10.2026: 7374, 7376)
update soubory s set verejne = false
 where s.druh = 'archiv' and s.smazano is null and s.verejne is distinct from false
   and s.nazev ~* '^(zak[aá]zkov[ýy][ _]list|work[ _]order)'
   and exists (select 1 from doklady d where d.zakazka_id = s.zakazka_id and d.druh = 'zakazkovy_list');
