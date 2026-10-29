-- A3: vystavení dokladu jedním krokem v databázi (doklad + jeho soubory + podpisy najednou, nebo nic).
-- Výpadek signálu uprostřed tak nikdy nenechá „napůl vydaný“ doklad; opakovaný pokus nevytvoří druhou fakturu.
create or replace function public.vystavit_doklad(p jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare d public.doklady; x jsonb; sid uuid; pdf_id uuid; podpis_id uuid; navazat uuid[] := '{}';
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  -- opakovaný pokus po výpadku: doklad už existuje → vrátit ho (nic nového nevznikne)
  select * into d from public.doklady where cislo = p ->> 'cislo';
  if d.id is not null then return to_jsonb(d) || jsonb_build_object('uz_existoval', true); end if;

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
