# Obnova Werkplaats + E-serviska 1:1

Ověřeno **31. 10. 2026** (noční kontrola): obsah tohoto repozitáře odpovídá tomu, co běží naostro.

**Databáze**
- Migrace `databaze/001–042` vytvoří přesně stejné tabulky, sloupce, omezení, indexy, triggery, pravidla RLS, typy a úložiště.
- Porovnáno otiskem s produkční databází, shoda 100 % (jediný rozdíl: u `vystavit_doklad` chybí jeden komentář).
- Zkouška obnovy 31. 10. 2026: databáze postavená z migrací + `obnova-dat.sql` ze zálohy → všechna data sedí, majitel převeden na nový účet.

**Serverové funkce:** `databaze/funkce/*` jsou stejné jako nasazené verze:
- eserviska v28 (`verify_jwt = false`; GET ?k=…, ?jen=servis pro Werkplaats, ?jen=nahled pro náhled odkazu, POST podpis)
- notifikace v2 (`verify_jwt = false`; Web Push na telefon – podpisy v E-servisce, chyby systému; klíč VAPID si vytvoří sama v tabulce push_vapid)
- kurz-cnb v2
- smazat-soubory v2
- sprava-uzivatelu v3
- zaloha v8 (noční záloha, přihlášení tokenem GitHub OIDC)
- import-archivu v2 (jednorázová, nepoužívá se)
- odeslat-email (nová 31. 10. 2026, `verify_jwt = false` – ověřuje si přihlášení / interní klíč sama): e-mail se zakázkovým listem a VOP po podpisu
- email-udalosti (nová 31. 10. 2026, `verify_jwt = false` – ověřuje podpis Svix): zpětná vazba doručení od Resend
- `uklid-jednorazovy` – jen prázdná funkce po jednorázovém úklidu 31. 10. 2026 (není v gitu, dá se smazat; při obnově ji nezakládat)

**Web E-serviska**
- Kód v hlavičce i patičce stránky `/e-serviska` se shoduje s webem bajt po bajtu (SHA-256).
- Soubory `web/e-serviska-head.html` a `web/e-serviska-footer.html`. Od 31.10.2026 je kód E-servisky v `aplikace/eserviska.js` (nasazuje se s aplikací na werk.mercedesrestorations.cz/eserviska.js) a patička ve Webflow ho jen načítá. Původní kód přímo ve Webflow je zálohovaný v `web/e-serviska-footer-webflow-zaloha.html` (návrat = vložit ho do Footer code a publikovat).

Záloha kódu: soubor `werkplaats-kod-RRRR-MM-DD.bundle` s celou historií (`git clone soubor.bundle werkplaats`) a větev `zaloha-RRRR-MM-DD` na GitHubu.

## Noční záloha (každou noc kolem 2:00, od 31. 10. 2026)

Běží na GitHubu (workflow `.github/workflows/zaloha.yml`), nezávisle na Macu. Nic se neplatí (bezplatný limit Cloudflare R2).

1. Funkce `zaloha` v Supabase vydá data všech tabulek; přihlášení tokenem GitHub OIDC (žádné heslo – jen tento repozitář, větev `main`).
2. `zaloha/denni-zaloha.sh` + `zaloha/vytvor-balicek.py` sestaví balíček: data po tabulkách, `data/obnova-dat.sql` (obnova dat jedním spuštěním v SQL Editoru), `JAK-OBNOVIT.html`, tento návod, kód webu E-servisky a git bundle s kódem.
3. Balíček se nahraje do Cloudflare R2 `werkplaats-zalohy/RRRR-MM-DD/` (drží se 30 posledních).
4. `zaloha/zrcadlo-souboru.py` zrcadlí fotky, videa a PDF do R2 `werkplaats-soubory` (jen přidává, nic nemaže).
5. Pojistka: když je v R2 přes 8 GB, nic se nenahraje (aby se neplatilo).
6. **Zkouška obnovy nanečisto** (`zaloha/zkouska-obnovy.sh`, od 31. 10. 2026): do prázdného PostgreSQL (služba v GitHub Actions) se pustí všechny migrace a `obnova-dat.sql` z právě vytvořeného balíčku a porovnají se počty řádků každé tabulky. Když něco nesedí nebo v záloze chybí tabulka, úloha skončí chybou (GitHub pošle e-mail). Zkušební databáze se pak smaže.

**Odkaz s náhledem v chatu:** `werk.mercedesrestorations.cz/s/<kód>` – Cloudflare Pages Functions ve složce `functions/s/` (náhled: název auta + profilová fotka, pak přesměrování do E-servisky; noindex).

Ruční spuštění: `gh workflow run zaloha.yml -R VasekMachan-MR/werkplaats --ref main`.

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
   - Jednou se přihlásit do nové aplikace (vznikne účet), pak celý `data/obnova-dat.sql` ze zálohy vložit do Supabase → SQL Editor → Run. Nový účet převezme roli majitele.
   - Supabase Pro má navíc denní zálohy databáze přímo v Supabase.

3. **Serverové funkce:** nasadit každou složku z `databaze/funkce/` pod stejným názvem.
   - `eserviska` s `verify_jwt = false`.
   - Ostatní funkce s `verify_jwt = true`.
   - Výjimka: `zaloha` také s `verify_jwt = false` (ověřuje si token GitHub OIDC sama). `import-archivu` je jednorázová a nemusí se nasazovat.

4. **Nastavení Supabase, které není v kódu (nastavit ručně):**
   - Authentication → MFA: zapnout TOTP (aplikace vyžaduje druhý krok přihlášení).
   - Authentication → Sign In / Providers → Email: zapnout „Prevent use of leaked passwords“ (ochrana uniklých hesel, zapnuto 31. 10. 2026).
   - Authentication → URL Configuration: Site URL `https://werk.mercedesrestorations.cz`, Redirect URLs `https://werk.mercedesrestorations.cz/**`.
   - Uživatelé (přihlášení) se nezálohují. Majitel si účet založí znovu a v tabulce `uzivatele` se mu nastaví `role = 'majitel'`.
   - Nová adresa a publishable klíč projektu se zapíšou do `aplikace/nastaveni.js` a do `API` v `web/e-serviska-footer.html`.

5. **Aplikace:** Cloudflare Pages
   - připojit repozitář;
   - build command `npm run build`;
   - output `dist`;
   - doména werk.mercedesrestorations.cz.

6. **E-serviska:** ve Webflow na stránce E-serviska vložit `web/e-serviska-head.html` do Head code a `web/e-serviska-footer.html` do Footer code (celý obsah), pak publikovat.

7. **Soubory (fotky, PDF, podpisy):** zkopírovat z R2 `werkplaats-soubory` do úložiště `soubory` se stejnými cestami (sloupec `soubory.klic`).

8. **Noční záloha:** v GitHubu nastavit Secrets `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (klíč R2 jen pro koše `werkplaats-zalohy` a `werkplaats-soubory`).

**Odesílání e-mailů (Resend):** Secrets v Supabase → Edge Functions: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`. Doména `mercedesrest.cz` ověřená v Resend (DNS záznamy u WEDOS). Webhook v Resend → `https://yokbljdjcvwbadbcwmgx.supabase.co/functions/v1/email-udalosti` (události delivered, bounced, complained, delivery_delayed, failed). VOP pro přílohu: `aplikace/vop.pdf` → werk.mercedesrestorations.cz/vop.pdf, anglicky `aplikace/vop-en.pdf` → /vop-en.pdf (anglicky mluvící zákazníci; při změně VOP vyměnit oba soubory).

## Co v gitu záměrně není
- Osobní údaje zákazníků, podpisy (`dokumenty/sablony/assets/podpis*.png`) a PDF dokladů. To je v databázi a úložišti, zálohuje se zvlášť.
- Hesla a tajné klíče. Serverové funkce používají jen proměnné, které Supabase dodá samo (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
