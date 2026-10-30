# Obnova Werkplaats + E-serviska 1:1

Ověřeno **30. 10. 2026**: obsah tohoto repozitáře odpovídá tomu, co běží naostro.

**Databáze**
- Migrace `databaze/001–031` vytvoří přesně stejné tabulky, sloupce, omezení, indexy, triggery, pravidla RLS, typy a úložiště.
- Porovnáno otiskem s produkční databází, shoda 100 %.
- Jediný rozdíl: u `vystavit_doklad` chybí jeden komentář.

**Serverové funkce:** `databaze/funkce/*` jsou stejné jako nasazené verze:
- eserviska v15
- kurz-cnb v1
- smazat-soubory v2
- sprava-uzivatelu v3
- import-archivu v2 (vypnutá)

**Web E-serviska**
- Kód v hlavičce i patičce stránky `/e-serviska` se shoduje s webem bajt po bajtu (SHA-256).
- Soubory `web/e-serviska-head.html` a `web/e-serviska-footer.html`.

Záloha kódu se dělá značkou (tagem) `zaloha-RRRR-MM-DD` na GitHubu a souborem `werkplaats-kod-RRRR-MM-DD.bundle`, který obsahuje celou historii (`git clone soubor.bundle werkplaats`).

## Co kde běží

| Část | Kde | Z čeho |
|---|---|---|
| Aplikace Werkplaats | Cloudflare Pages, projekt `werkplaats`, doména werk.mercedesrestorations.cz | větev `main` tohoto repozitáře, `npm run build` → `dist/` |
| Databáze + soubory | Supabase projekt `yokbljdjcvwbadbcwmgx` (region EU), úložiště `soubory` | `databaze/0*.sql` v pořadí podle názvu, `databaze/funkce/*` |
| E-serviska | Webflow, stránka `E-serviska`, slug `e-serviska`, page id `6ae2fd8f4fc26010bf5e8473` | `web/e-serviska-head.html` → Head code, `web/e-serviska-footer.html` → Footer code |

Další údaje:
- Webflow site id: `6606988ce196c11b806596eb`.
- SEO stránky E-serviska:
  - title „E-servisní knížka | Mercedes Restorations“;
  - description „Servisní historie vozu Mercedes-Benz z dílny Mercedes Restorations.“;
  - `noindex` je přímo v head kódu.
- Na webu nejsou žádné registrované skripty ani kód pro celý web. Všechno je jen v head a footer kódu stránky.

## Obnova krok za krokem (kdyby se něco ztratilo)

1. **Kód:** `git clone https://github.com/VasekMachan-MR/werkplaats`. Kdyby nebyl GitHub dostupný, použije se `git clone werkplaats-kod-….bundle werkplaats` ze zálohy v iCloudu.

2. **Databáze (nový projekt Supabase):**
   - Spustit `databaze/0*.sql` přesně v pořadí podle názvu souboru (015 před 015b, 028 před 028b).
   - Data nahrát ze zálohy dat (JSON po tabulkách).
   - Supabase Pro má navíc denní zálohy databáze přímo v Supabase.

3. **Serverové funkce:** nasadit každou složku z `databaze/funkce/` pod stejným názvem.
   - `eserviska` s `verify_jwt = false`.
   - Ostatní funkce s `verify_jwt = true`.
   - `import-archivu` a `zaloha` jsou jednorázové a mohou zůstat vypnuté.

4. **Nastavení Supabase, které není v kódu (nastavit ručně):**
   - Authentication → MFA: zapnout TOTP (aplikace vyžaduje druhý krok přihlášení).
   - Authentication → URL Configuration: Site URL `https://werk.mercedesrestorations.cz`, Redirect URLs `https://werk.mercedesrestorations.cz/**`.
   - Uživatelé (přihlášení) se nezálohují. Majitel si účet založí znovu a v tabulce `uzivatele` se mu nastaví `role = 'majitel'`.
   - Nová adresa a publishable klíč projektu se zapíšou do `aplikace/nastaveni.js` a do `API` v `web/e-serviska-footer.html`.

5. **Aplikace:** Cloudflare Pages
   - připojit repozitář;
   - build command `npm run build`;
   - output `dist`;
   - doména werk.mercedesrestorations.cz.

6. **E-serviska:** ve Webflow na stránce E-serviska vložit `web/e-serviska-head.html` do Head code a `web/e-serviska-footer.html` do Footer code (celý obsah), pak publikovat.

7. **Soubory (fotky, PDF, podpisy):** nahrát do úložiště `soubory` se stejnými cestami (sloupec `soubory.klic`).

## Co v gitu záměrně není
- Osobní údaje zákazníků, podpisy (`dokumenty/sablony/assets/podpis*.png`) a PDF dokladů. To je v databázi a úložišti, zálohuje se zvlášť.
- Hesla a tajné klíče. Serverové funkce používají jen proměnné, které Supabase dodá samo (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
