#!/usr/bin/env bash
# Zkouška obnovy nanečisto (Vašek 31.10.2026: „ověřit zálohy“) – každou noc po záloze na GitHubu.
# Do prázdného PostgreSQL se pustí všechny migrace (databaze/0*.sql) a pak obnova-dat.sql z právě vytvořeného balíčku,
# nakonec se porovná počet řádků v každé tabulce s daty zálohy. Když cokoli nesedí, úloha skončí chybou (GitHub pošle e-mail).
# Použití:  zaloha/zkouska-obnovy.sh <složka balíčku>   (PGHOST/PGPORT/PGUSER míří na prázdný server, např. službu postgres:16)
set -euo pipefail
cd "$(dirname "$0")/.."
BAL=${1:?složka balíčku}
export PGOPTIONS="-c client_min_messages=warning"
P="psql -v ON_ERROR_STOP=1 -q -X"
$P -d postgres -c "drop database if exists zkouska_obnovy" -c "create database zkouska_obnovy"
$P -d zkouska_obnovy -f zaloha/supabase-stub.sql
for f in $(ls databaze/0*.sql | sort); do $P -d zkouska_obnovy -f "$f" >/dev/null || { echo "::error::Migrace $f nejde pustit"; exit 1; }; done
$P -d zkouska_obnovy -c "insert into auth.users (email) values ('zkouska@obnova.local')"
$P -d zkouska_obnovy -f "$BAL/data/obnova-dat.sql" >/dev/null
python3 - "$BAL/data/_vse.json" <<'PY'
import json, subprocess, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))["tabulky"]
spatne = []
for t, rows in sorted(d.items()):
    n = int(subprocess.check_output(["psql", "-X", "-At", "-d", "zkouska_obnovy", "-c", f'select count(*) from public."{t}"']).decode().strip())
    if n != len(rows): spatne.append(f"{t}: záloha {len(rows)}, obnoveno {n}")
celkem = sum(len(r) for r in d.values())
# tabulka v databázi, kterou záloha vůbec neobsahuje = zapomenutá v seznamu funkce zaloha (push_vapid záměrně – klíč notifikací se vytvoří znovu)
vsechny = set(subprocess.check_output(["psql", "-X", "-At", "-d", "zkouska_obnovy", "-c",
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"]).decode().split())
chybi = sorted(vsechny - set(d) - {"push_vapid"})
if chybi: spatne.append("tabulky chybí v záloze: " + ", ".join(chybi))
if spatne:
    print("::error::Obnova nesedí – " + "; ".join(spatne)); sys.exit(1)
print(f"Zkouška obnovy OK: {len(d)} tabulek, {celkem} řádků – všechno sedí")
PY
# zkušební databáze se po porovnání smaže (nic se nehromadí); samotná záloha v R2 zůstává
$P -d postgres -c "drop database if exists zkouska_obnovy"
