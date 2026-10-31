-- 042: noční kontrola 31.10.2026 (schválil Vašek)
-- 1) Nahrazení nepodepsaného zakázkového listu probíhá UVNITŘ vystavení nového listu (jedna transakce):
--    výpadek signálu už nemůže nechat zakázku bez listu – buď se starý nahradí novým, nebo se nestane nic.
--    Aplikace pošle p.nahradit_nepodepsane = true.
-- 2) Když číslo mezitím obsadil jiný doklad (druhé zařízení, zákazník podepsal list v E-servisce), vystavení skončí chybou
--    a nic se nesmaže. Opakovaný pokus po výpadku (stejná značka p.data.pokus) dál vrátí už vzniklý doklad.
-- 3) Nahrazují se jen listy, které opravdu čekají na podpis (data.cekaPodpis) – stejně jako to počítá aplikace.

create or replace function public.nahradit_nepodepsane_listy(p_zakazka uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare ids uuid[]; soub uuid[];
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepovoleno'; end if;
  select array_agg(d.id) into ids from public.doklady d where d.zakazka_id = p_zakazka and d.druh = 'zakazkovy_list'
    and coalesce((d.data ->> 'cekaPodpis')::boolean, false)
    and not exists (select 1 from public.podpisy x where x.doklad_id = d.id and x.role = 'zakaznik')
    and not exists (select 1 from public.dalkove_podpisy x where x.doklad_id = d.id);
  if ids is null then return 0; end if;
  select array_agg(x) into soub from (
    select id x from public.soubory where doklad_id = any(ids)
    union select pdf_soubor_id from public.doklady where id = any(ids) and pdf_soubor_id is not null
    union select obrazek_soubor_id from public.podpisy where doklad_id = any(ids) and obrazek_soubor_id is not null) s;
  perform set_config('werk.mazani_dokladu', 'ano', true);
  update public.soubory set doklad_id = null, smazano = coalesce(smazano, now()) where id = any(coalesce(soub, '{}'));
  delete from public.podpisy where doklad_id = any(ids);
  delete from public.emaily where doklad_id = any(ids);
  delete from public.doklady where id = any(ids);
  perform set_config('werk.mazani_dokladu', '', true);
  return coalesce(array_length(ids, 1), 0);
end $$;
revoke all on function public.nahradit_nepodepsane_listy(uuid) from public, anon;
grant execute on function public.nahradit_nepodepsane_listy(uuid) to authenticated;

create or replace function public.vystavit_doklad(p jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare d public.doklady; x jsonb; sid uuid; pdf_id uuid; podpis_id uuid; navazat uuid[] := '{}';
  nahradit boolean := coalesce((p ->> 'nahradit_nepodepsane')::boolean, false) and p ->> 'druh' = 'zakazkovy_list';
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  if nahradit then perform public.nahradit_nepodepsane_listy((p ->> 'zakazka_id')::uuid); end if;
  -- opakovaný pokus po výpadku: doklad už existuje → vrátit ho (nic nového nevznikne)
  select * into d from public.doklady where cislo = p ->> 'cislo';
  if d.id is not null then
    if nahradit and (d.data ->> 'pokus') is distinct from (p -> 'data' ->> 'pokus') then
      raise exception 'Číslo % už mezitím dostal jiný doklad – načtěte zakázku znovu', p ->> 'cislo';   -- zruší i nahrazení výše
    end if;
    return to_jsonb(d) || jsonb_build_object('uz_existoval', true);
  end if;

  for x in select * from jsonb_array_elements(coalesce(p -> 'soubory', '[]')) loop
    insert into public.soubory (zakazka_id, vozidlo_id, druh, klic, nazev, velikost, mime, verejne)
    values ((p ->> 'zakazka_id')::uuid, nullif(p ->> 'vozidlo_id', '')::uuid, x ->> 'druh', x ->> 'klic', x ->> 'nazev',
            nullif(x ->> 'velikost', '')::int, x ->> 'mime', false)
    returning id into sid;
    if x ->> 'role' = 'pdf' then pdf_id := sid; end if;
    if x ->> 'role' = 'podpis' then podpis_id := sid; end if;
    if x ->> 'role' in ('pdf', 'priloha') then navazat := navazat || sid; end if;
  end loop;

  insert into public.doklady (zakazka_id, nabidka_id, druh, verze, cislo, variabilni_symbol, jazyk, vystaveno, splatnost, data,
                              pdf_soubor_id, zamceno, celkem)
  values ((p ->> 'zakazka_id')::uuid, nullif(p ->> 'nabidka_id', '')::uuid, (p ->> 'druh')::public.druh_dokladu, (p ->> 'verze')::int,
          p ->> 'cislo', p ->> 'variabilni_symbol', coalesce(p ->> 'jazyk', 'cs'), coalesce((p ->> 'vystaveno')::date, current_date),
          (p ->> 'splatnost')::date, coalesce(p -> 'data', '{}'), pdf_id, true, (p ->> 'celkem')::numeric)
  returning * into d;

  update public.soubory set doklad_id = d.id where id = any(navazat);

  for x in select * from jsonb_array_elements(coalesce(p -> 'podpisy', '[]')) loop
    insert into public.podpisy (doklad_id, role, jmeno, zpusob, otisk_dokumentu, obrazek_soubor_id, uzivatel_id)
    values (d.id, x ->> 'role', x ->> 'jmeno', x ->> 'zpusob', x ->> 'otisk_dokumentu',
            case when x ->> 'role' = 'zakaznik' then podpis_id end, nullif(x ->> 'uzivatel_id', '')::uuid);
  end loop;
  return to_jsonb(d);
end $function$;
