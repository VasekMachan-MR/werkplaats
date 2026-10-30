#!/usr/bin/env python3
"""Z dat ze serverové funkce „zaloha“ sestaví balíček zálohy (Vašek 30.10.2026, denně ve 2:00).

Použití:  python3 zaloha/vytvor-balicek.py data.json VYSTUPNI_SLOZKA

Vytvoří ve VYSTUPNI_SLOZCE:
  data/<tabulka>.json, data/_vse.json, data/_seznam-souboru-v-ulozisti.json,
  data/obnova-dat.sql (vše jedním Run v Supabase SQL Editoru),
  JAK-OBNOVIT.html a OBNOVA.md (návody z repozitáře).
Kód (git bundle) přidává zvlášť skript denní zálohy.
"""
import json, os, re, shutil, sys

# pořadí nahrávání (vazby jsou při obnově dočasně vypnuté, pořadí je jen pro přehled)
PORADI = ["uzivatele", "nastaveni", "ciselne_rady", "sazby", "dodavatele", "motory", "typy_motoru", "servisni_ukony",
          "servisni_intervaly", "servisni_intervaly_motoru", "katalog_rady", "katalog_modely", "katalog_motorizace",
          "katalog_vozu", "zakaznici", "vozidla", "vlastnictvi", "zakazky", "nabidky", "postupy", "soubory", "doklady",
          "podpisy", "dalkove_podpisy", "nakupni_doklady", "polozky", "dily", "servisni_plan", "kalendar", "emaily",
          "koncepty_prijmu", "sklad", "sklad_pohyby", "preklady"]

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(vstup, vystup):
    d = json.load(open(vstup, encoding="utf-8"))
    tab = d["tabulky"]
    chyby = {t: v["chyba"] for t, v in tab.items() if isinstance(v, dict) and "chyba" in v}
    if chyby:
        sys.exit(f"Záloha neúplná, chyba u tabulek: {chyby}")
    neznamy = sorted(set(tab) - set(PORADI))
    poradi = PORADI + neznamy   # nová tabulka, o které skript neví, se přidá na konec
    os.makedirs(os.path.join(vystup, "data"), exist_ok=True)
    for t, rows in tab.items():
        json.dump(rows, open(os.path.join(vystup, "data", f"{t}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(d, open(os.path.join(vystup, "data", "_vse.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(d.get("soubory", []), open(os.path.join(vystup, "data", "_seznam-souboru-v-ulozisti.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # majitel ze zálohy: jeho id se při obnově přepíše na nový účet
    majitel = next((u["id"] for u in tab.get("uzivatele", []) if u.get("role") == "majitel"), None)
    migrace = sorted(f for f in os.listdir(os.path.join(KOREN, "databaze")) if re.match(r"^\d{3}", f) and f.endswith(".sql"))
    posledni = migrace[-1][:3] if migrace else "???"
    s = [f"-- OBNOVA DAT Werkplaats ze zálohy {d.get('vytvoreno', '')}",
         f"-- Postup: 1) databáze už má migrace 001–{posledni}  2) v nové aplikaci ses jednou přihlásil (vznikl účet)  "
         "3) celý tento soubor vlož do Supabase → SQL Editor → Run",
         "set session_replication_role = replica;   -- dočasně vypne kontroly vazeb, aby šlo nahrát v libovolném pořadí",
         "create temp table _zaloha (poradi int, tabulka text, data text);"]
    for i, t in enumerate(poradi):
        rows = tab.get(t)
        if not rows:
            continue
        data = json.dumps(rows, ensure_ascii=False)
        assert "$zaloha$" not in data
        s.append(f"insert into _zaloha values ({i}, '{t}', $zaloha${data}$zaloha$);")
    nahrad = (f"replace(r.data, '{majitel}', novy)" if majitel else "r.data")
    s.append(f"""do $$
declare novy text; r record; sloupce text;
begin
  -- tvůj nový účet (první přihlášený) převezme roli majitele a všechno, co dělal starý účet
  select id::text into novy from auth.users order by created_at limit 1;
  if novy is null then raise exception 'Nejdřív se jednou přihlas do nové aplikace (musí existovat účet)'; end if;
  for r in select * from _zaloha order by poradi loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into sloupce
      from information_schema.columns where table_schema = 'public' and table_name = r.tabulka and is_generated = 'NEVER'
        and column_name in (select json_object_keys((r.data::json) -> 0));   -- jen sloupce, které záloha má (novější sloupce dostanou výchozí hodnotu)
    execute format('delete from public.%I', r.tabulka);
    execute format('insert into public.%I (%s) select %s from json_populate_recordset(null::public.%I, %L::json)',
                   r.tabulka, sloupce, sloupce, r.tabulka, {nahrad});
    raise notice '%: hotovo', r.tabulka;
  end loop;
end $$;
set session_replication_role = origin;
select 'Obnova dat dokončena' as vysledek;""")
    open(os.path.join(vystup, "data", "obnova-dat.sql"), "w", encoding="utf-8").write("\n".join(s) + "\n")
    shutil.copy(os.path.join(KOREN, "zaloha", "JAK-OBNOVIT.html"), vystup)
    shutil.copy(os.path.join(KOREN, "OBNOVA.md"), vystup)
    print(f"OK: {sum(len(v) for v in tab.values())} řádků v {len(tab)} tabulkách, {len(d.get('soubory', []))} souborů v úložišti")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
