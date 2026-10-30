-- 038: nový formát čísel dokladů od 1. 11. 2026 (Vašek 30.10.2026)
-- 7377-3 → 73770003 (zakázka + verze na 3 místa + druh); číslo = variabilní symbol.
-- Pravidlo povoluje oba tvary: starý s pomlčkou (už vydané doklady se nepřečíslovávají) i nový jen z číslic.
-- Návrat: aplikace přepíná podle data (NOVA_CISLA_OD); tohle pravidlo může zůstat, protože starý tvar dál povoluje.
alter table public.doklady drop constraint if exists doklady_cislo_tvar;
alter table public.doklady add constraint doklady_cislo_tvar check (cislo ~ '^[0-9]+-[1-6](-[0-9]+)?$' or cislo ~ '^[0-9]{4,}[0-9]{3}[1-6]$');
