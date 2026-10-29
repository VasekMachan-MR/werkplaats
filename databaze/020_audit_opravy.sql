-- Opravy po kontrole 29.10.2026 (schválil Vašek): B6, D2, D3/C1, E2, E3, E4, F5, D1.

-- ---------- B6 + E4: zámek dokladů ----------
-- „předáno účetní“ jde jen nastavit, nikdy vrátit; „zaplaceno“ smí měnit jen majitel.
create or replace function public.hlidej_zamceny_doklad()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    if old.zamceno and not (current_setting('werk.mazani_dokladu', true) = 'ano'
                            or (current_setting('werk.mazani_zakazky', true) = 'ano' and old.druh not in ('faktura', 'zalohova', 'opravny'))) then
      raise exception 'Doklad % je vydaný a nelze ho smazat (oprava = opravný doklad -6)', old.cislo;
    end if;
    return old;
  end if;
  if old.odeslano_uol is not null and new.odeslano_uol is distinct from old.odeslano_uol then
    raise exception 'Doklad % už byl předán účetní – to nejde vrátit', old.cislo;
  end if;
  if new.zaplaceno is distinct from old.zaplaceno and not (select soukrome.je_majitel()) then
    raise exception 'Úhradu dokladu může označit jen majitel';
  end if;
  if old.zamceno and (to_jsonb(new) - 'pdf_soubor_id' - 'odeslano_uol' - 'zaplaceno')
                  <> (to_jsonb(old) - 'pdf_soubor_id' - 'odeslano_uol' - 'zaplaceno') then
    raise exception 'Doklad % je vydaný a nelze ho měnit (oprava = opravný doklad -6)', old.cislo;
  end if;
  return new;
end $function$;

-- ---------- D2 + E4: pravidla přístupu ----------
do $$
declare t text;
begin
  -- běžné tabulky: číst a zapisovat smí dílna, mazat jen majitel
  foreach t in array array['zakaznici', 'vozidla', 'zakazky', 'vlastnictvi', 'soubory', 'podpisy', 'nakupni_doklady'] loop
    execute format('drop policy if exists dilna on public.%I', t);
    execute format('create policy dilna_cte on public.%I for select to authenticated using ((select soukrome.je_clen()))', t);
    execute format('create policy dilna_pridava on public.%I for insert to authenticated with check ((select soukrome.je_clen()))', t);
    execute format('create policy dilna_upravuje on public.%I for update to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()))', t);
    execute format('create policy majitel_maze on public.%I for delete to authenticated using ((select soukrome.je_majitel()))', t);
  end loop;
  -- nastavení a číselníky: číst smí dílna, měnit jen majitel
  foreach t in array array['sazby', 'nastaveni', 'ciselne_rady', 'katalog_modely', 'katalog_motorizace', 'katalog_rady', 'motory', 'typy_motoru',
                           'servisni_intervaly', 'servisni_intervaly_motoru', 'servisni_ukony'] loop
    execute format('drop policy if exists dilna on public.%I', t);
    execute format('create policy dilna_cte on public.%I for select to authenticated using ((select soukrome.je_clen()))', t);
    execute format('create policy majitel_meni on public.%I for all to authenticated using ((select soukrome.je_majitel())) with check ((select soukrome.je_majitel()))', t);
  end loop;
  -- ostatní tabulky dílny: jen rychlejší vyhodnocení pravidla
  foreach t in array array['dily', 'dodavatele', 'emaily', 'nabidky', 'polozky', 'postupy', 'servisni_plan'] loop
    execute format('drop policy if exists dilna on public.%I', t);
    execute format('create policy dilna on public.%I for all to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()))', t);
  end loop;
end $$;

-- doklady: fakturu, zálohovou fakturu a opravný doklad vystavuje jen majitel; mazání jen přes smazat_doklad (majitel)
drop policy if exists dilna on public.doklady;
create policy dilna_cte on public.doklady for select to authenticated using ((select soukrome.je_clen()));
create policy dilna_vystavuje on public.doklady for insert to authenticated
  with check ((select soukrome.je_clen()) and (druh not in ('faktura', 'zalohova', 'opravny') or (select soukrome.je_majitel())));
create policy dilna_upravuje on public.doklady for update to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()));
create policy majitel_maze on public.doklady for delete to authenticated using ((select soukrome.je_majitel()));

-- číselná řada: mění se jen přes dalsi_cislo (zakládání zakázky smí každý z dílny)
create or replace function public.dalsi_cislo(p_rada text)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare c int;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  update public.ciselne_rady set posledni = posledni + 1 where rada = p_rada returning posledni into c;
  return c;
end $function$;
revoke execute on function public.dalsi_cislo(text) from public, anon;
grant execute on function public.dalsi_cislo(text) to authenticated;

-- smazat_zakazku vrací číslo do řady – běží jako majitel, ten řadu měnit smí (pravidlo majitel_meni)

-- ---------- E3: tajný odkaz na E-servisku, F5: poznámky ----------
alter table public.vozidla add column if not exists eserviska_kod text;
update public.vozidla set eserviska_kod = substr(replace(gen_random_uuid()::text, '-', ''), 1, 20) where eserviska_kod is null;
alter table public.vozidla alter column eserviska_kod set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
alter table public.vozidla alter column eserviska_kod set not null;
create unique index if not exists vozidla_eserviska_kod on public.vozidla (eserviska_kod);
alter table public.vozidla add column if not exists poznamky text;
alter table public.zakazky add column if not exists poznamky text;

-- ---------- E2: fotky a archivní PDF jsou v E-servisce vidět, jednotlivě jdou skrýt ----------
alter table public.soubory alter column verejne set default true;
update public.soubory set verejne = true where druh in ('foto', 'video', 'archiv') and smazano is null;

-- ---------- D3/C1: auto má nejvýš jednoho současného majitele; změna majitele při příjmu ----------
create unique index if not exists vlastnictvi_jeden_soucasny on public.vlastnictvi (vozidlo_id) where vlastni_do is null;

-- zapíše vlastnictví podle situace:
--  · zákazník už je současný majitel → nic
--  · p_zmena = true → předchozím majitelům ukončit vlastnictví k dnešku, nový majitel, nový tajný odkaz E-servisky
--  · auto nemá současného majitele → zákazník je majitel
--  · jinak (auto přivezl někdo jiný než majitel) → vlastnictví se nemění
create or replace function public.zapsat_vlastnictvi(p_vozidlo uuid, p_zakaznik uuid, p_zmena boolean)
 returns void
 language plpgsql
 set search_path to ''
as $function$
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  if p_zakaznik is null or exists (select 1 from public.vlastnictvi where vozidlo_id = p_vozidlo and zakaznik_id = p_zakaznik and vlastni_do is null) then
    return;
  end if;
  if coalesce(p_zmena, false) then
    update public.vlastnictvi set vlastni_do = current_date where vozidlo_id = p_vozidlo and vlastni_do is null;
    insert into public.vlastnictvi (vozidlo_id, zakaznik_id, vlastni_od) values (p_vozidlo, p_zakaznik, current_date);
    update public.vozidla set eserviska_kod = substr(replace(gen_random_uuid()::text, '-', ''), 1, 20) where id = p_vozidlo;
  elsif not exists (select 1 from public.vlastnictvi where vozidlo_id = p_vozidlo and vlastni_do is null) then
    insert into public.vlastnictvi (vozidlo_id, zakaznik_id) values (p_vozidlo, p_zakaznik);
  end if;
end $function$;

create or replace function public.zalozit_zakazku(p jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  z jsonb := p -> 'zakaznik'; v jsonb := p -> 'vozidlo'; k jsonb := p -> 'zakazka';
  zid uuid; vid uuid; zkid uuid; c int;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  if length(regexp_replace(coalesce(v ->> 'vin', ''), '[^A-Za-z0-9]', '', 'g')) < 8 then raise exception 'Chybí VIN'; end if;

  if nullif(z ->> 'id', '') is not null then
    zid := (z ->> 'id')::uuid;
    update public.zakaznici set
      je_firma = coalesce((z ->> 'je_firma')::boolean, je_firma), jmeno = z ->> 'jmeno', kontaktni_osoba = z ->> 'kontaktni_osoba',
      ico = z ->> 'ico', dic = z ->> 'dic', ulice = z ->> 'ulice', mesto = z ->> 'mesto', psc = z ->> 'psc', zeme = z ->> 'zeme',
      telefon = z ->> 'telefon', email = z ->> 'email', jazyk = coalesce(z ->> 'jazyk', jazyk)
    where id = zid;
    if not found then raise exception 'Zákazník nenalezen'; end if;
  else
    insert into public.zakaznici (je_firma, jmeno, kontaktni_osoba, ico, dic, ulice, mesto, psc, zeme, telefon, email, jazyk)
    values (coalesce((z ->> 'je_firma')::boolean, false), z ->> 'jmeno', z ->> 'kontaktni_osoba', z ->> 'ico', z ->> 'dic',
            z ->> 'ulice', z ->> 'mesto', z ->> 'psc', coalesce(z ->> 'zeme', 'Česká Republika'), z ->> 'telefon', z ->> 'email',
            coalesce(z ->> 'jazyk', 'cs'))
    returning id into zid;
  end if;

  insert into public.vozidla (vin, spz, znacka, typ, model, rok, verze, barva, km_posledni, jednotka_tachometru)
  values (v ->> 'vin', v ->> 'spz', coalesce(v ->> 'znacka', 'Mercedes-Benz'), v ->> 'typ', v ->> 'model',
          (v ->> 'rok')::int, v ->> 'verze', v ->> 'barva', (k ->> 'km_prijem')::int, coalesce(v ->> 'jednotka_tachometru', 'km'))
  on conflict (vin) do update set
    spz = coalesce(excluded.spz, public.vozidla.spz), typ = coalesce(excluded.typ, public.vozidla.typ),
    model = coalesce(excluded.model, public.vozidla.model), rok = coalesce(excluded.rok, public.vozidla.rok),
    verze = coalesce(excluded.verze, public.vozidla.verze), barva = coalesce(excluded.barva, public.vozidla.barva),
    km_posledni = greatest(excluded.km_posledni, public.vozidla.km_posledni),
    jednotka_tachometru = coalesce(v ->> 'jednotka_tachometru', public.vozidla.jednotka_tachometru)
  returning id into vid;

  perform public.zapsat_vlastnictvi(vid, zid, (p ->> 'zmena_majitele')::boolean);

  c := public.dalsi_cislo('zakazky');
  insert into public.zakazky (cislo, vozidlo_id, zakaznik_id, jazyk, datum_prijmu, predpoklad_dokonceni, km_prijem,
                              nadrz_prijem, tp_prilozen, foto_prijem, zavady, stav_prijem, odhad_ceny)
  values (c, vid, zid, coalesce(k ->> 'jazyk', 'cs'), coalesce((k ->> 'datum_prijmu')::date, current_date),
          (k ->> 'predpoklad_dokonceni')::date, (k ->> 'km_prijem')::int, k ->> 'nadrz_prijem',
          (k ->> 'tp_prilozen')::boolean, (k ->> 'foto_prijem')::boolean,
          coalesce(array(select jsonb_array_elements_text(k -> 'zavady')), '{}'),
          coalesce(array(select jsonb_array_elements_text(k -> 'stav_prijem')), '{}'),
          (k ->> 'odhad_ceny')::numeric)
  returning id into zkid;

  return jsonb_build_object('zakazka_id', zkid, 'cislo', c, 'zakaznik_id', zid, 'vozidlo_id', vid);
end $function$;

create or replace function public.ulozit_vozidlo(p jsonb, p_zakaznik uuid default null)
 returns uuid
 language plpgsql
 set search_path to ''
as $function$
declare vid uuid;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  if length(regexp_replace(coalesce(p ->> 'vin', ''), '[^A-Za-z0-9]', '', 'g')) < 8 then raise exception 'Chybí VIN'; end if;
  insert into public.vozidla (vin, spz, znacka, typ, model, rok, verze, barva, km_posledni, jednotka_tachometru)
  values (p ->> 'vin', p ->> 'spz', coalesce(p ->> 'znacka', 'Mercedes-Benz'), p ->> 'typ', p ->> 'model',
          nullif(p ->> 'rok', '')::int, p ->> 'verze', p ->> 'barva', nullif(p ->> 'km', '')::int, coalesce(p ->> 'jednotka_tachometru', 'km'))
  on conflict (vin) do update set
    spz = coalesce(excluded.spz, public.vozidla.spz), typ = coalesce(excluded.typ, public.vozidla.typ),
    model = coalesce(excluded.model, public.vozidla.model), rok = coalesce(excluded.rok, public.vozidla.rok),
    verze = coalesce(excluded.verze, public.vozidla.verze), barva = coalesce(excluded.barva, public.vozidla.barva),
    km_posledni = greatest(excluded.km_posledni, public.vozidla.km_posledni),
    jednotka_tachometru = coalesce(p ->> 'jednotka_tachometru', public.vozidla.jednotka_tachometru)
  returning id into vid;
  perform public.zapsat_vlastnictvi(vid, p_zakaznik, (p ->> 'zmena_majitele')::boolean);
  return vid;
end $function$;

-- ---------- D1: soubory v úložišti bez záznamu (po smazání) – seznam pro úklid, volá jen serverová funkce ----------
create or replace function public.osirele_soubory(p_prefixy text[], p_starsi_nez interval)
 returns table (klic text)
 language sql
 security definer
 set search_path to ''
as $function$
  select o.name from storage.objects o
  where o.bucket_id = 'soubory' and o.created_at < now() - p_starsi_nez
    and exists (select 1 from unnest(p_prefixy) pr where o.name like pr || '%')
    and not exists (select 1 from public.soubory s where s.klic = o.name);
$function$;
revoke execute on function public.osirele_soubory(text[], interval) from public, anon, authenticated;
grant execute on function public.osirele_soubory(text[], interval) to service_role;
