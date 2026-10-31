-- 049: poznámka k řádku „Práce k fakturaci“ (Vašek 31.10.2026) – zákazník ji vidí v E-servisce u provedeného úkonu pod modrým „i“
-- (např. „Chladicí kapalina do −25 °C“). Na nabídku ani fakturu nejde.
alter table public.polozky add column if not exists poznamka text;

create or replace function public.ulozit_polozky(p_zakazka uuid, p_polozky jsonb) returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  delete from public.polozky where zakazka_id = p_zakazka and nabidka_id is null;
  insert into public.polozky (zakazka_id, poradi, typ, popis, mnozstvi, jednotka, sazba, castka, poznamka)
  select p_zakazka, ord::int, coalesce(x ->> 'typ', 'prace')::public.typ_polozky, x ->> 'popis',
         nullif(x ->> 'mnozstvi', '')::numeric, nullif(x ->> 'jednotka', ''), nullif(x ->> 'sazba', '')::numeric, nullif(x ->> 'castka', '')::numeric,
         nullif(btrim(x ->> 'poznamka'), '')
  from jsonb_array_elements(p_polozky) with ordinality as t(x, ord);
  get diagnostics n = row_count;
  return n;
end $$;
