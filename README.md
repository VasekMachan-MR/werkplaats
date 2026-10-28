# Werkplaats – Mercedes Restorations

Firemní systém autoservisu Mercedes Restorations s.r.o.:
- **Werkplaats** – aplikace pro dílnu (werk.mercedesrestorations.cz), iPad a iPhone
- **E-serviska** – servisní knížka pro zákazníky (mercedesrestorations.cz/vin/VIN) – připravuje se

## Co už funguje (fáze 1 – příjem vozu)
Přihlášení → přehled zakázek → nový příjem: zákazník (pozná stávajícího), auto podle VIN (pozná známé auto, z VIN doplní typ),
nádrž, km, TP, závady a stav (rychlé texty), fotky (zmenšené, rovnou nahrané), náhled zakázkového listu,
podpis zákazníka prstem / perem → **zakázkový list 7377-1** jako PDF (1:1 s původním Excelem), uložený a uzamčený, s otiskem SHA-256.

## Složky
- `aplikace/` – webová aplikace (PWA), bez sestavovacích nástrojů
- `dokumenty/sablony/` – šablony dokladů 1:1 podle originálů (CZ + EN), `do-pdf.js` = PDF přímo v prohlížeči
- `databaze/` – migrace databáze Supabase (001–006), spuštěné v pořadí
- `testy/` – kontrola shody PDF (`npm run test:pdf`) a test aplikace jako na iPadu (`npm run test:app`)
- `build.js` – sestaví `dist/` pro Cloudflare Pages (`npm run build`, výstupní složka `dist`)

## Číslování
Číslo zakázky (od 7377) + pomlčka a přípona podle dokladu: `-1` zakázkový list, `-2` nabídka (`-2-2` další verze), `-3` faktura
(`-3-2` doúčtování), `-4` předávací protokol, `-5` zálohová faktura, `-6` opravný doklad. Variabilní symbol = jen číslice (7377-3 → 73773).

## Pravidla
- Osobní údaje zákazníků a podpisy nikdy do gitu – patří do databáze / zabezpečeného úložiště.
- Vydaný doklad se nemění ani nemaže (hlídá databáze); oprava = opravný doklad.
- Soubory se nemažou (úložiště nepovoluje mazání ani přepis).
- Písma: Liberation Sans/Serif (licence SIL OFL), metricky shodná s Arial/Helvetica/Times New Roman.
