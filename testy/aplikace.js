/* Test aplikace jako na iPadu: dva příjmy (nový zákazník, pak stejné auto znovu), podpis prstem, PDF, detail.
   Běží proti zkušební databázi v paměti (mock-db.js) a sestavené aplikaci v dist/ – včetně bezpečnostních hlaviček z _headers. */
const { chromium, devices } = require("playwright");
const fs = require("fs"), path = require("path"), http = require("http");
const DIST = path.resolve("dist"), OUT = path.resolve(process.argv[2] || "testy/vystup-app");
fs.mkdirSync(OUT, { recursive: true });

const TYPY = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
const hlavicky = {};   // z _headers jen „/*“
const hdr = fs.readFileSync(path.join(DIST, "_headers"), "utf8").split("\n/")[0];
hdr.split("\n").slice(1).forEach(r => { const m = r.trim().match(/^([\w-]+):\s*(.*)$/); if (m) hlavicky[m[1]] = m[2]; });
const server = http.createServer((q, r) => {
  let f = path.join(DIST, decodeURIComponent(q.url.split("?")[0]));
  if (f.endsWith("/")) f += "index.html";
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { ...hlavicky, "Content-Type": TYPY[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise(ok => server.listen(0, "127.0.0.1", ok));
  const URL0 = `http://127.0.0.1:${server.address().port}/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPad Pro 11"], locale: "cs-CZ", timezoneId: "Europe/Prague" });
  const podpisVasek = fs.existsSync("dokumenty/sablony/assets/podpis.png") ? "data:image/png;base64," + fs.readFileSync("dokumenty/sablony/assets/podpis.png").toString("base64") : null;
  await ctx.addInitScript({ content: `window.__TEST_PODPIS__ = ${JSON.stringify(podpisVasek)}; window.__KATALOG__ = ${fs.readFileSync("testy/katalog-vozu.json", "utf8")};` + fs.readFileSync("testy/mock-db.js", "utf8") });
  const p = await ctx.newPage();
  const chyby = [];
  p.on("pageerror", e => chyby.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error") chyby.push("console: " + m.text()); });
  const foto = async n => { await p.screenshot({ path: path.join(OUT, n + ".png"), fullPage: true }); };
  const kontrola = (podminka, text) => { if (!podminka) throw new Error("KONTROLA SELHALA: " + text); console.log("✓ " + text); };

  await p.goto(URL0);
  await p.waitForSelector("text=Zatím žádné zakázky");
  kontrola(true, "přehled se otevřel (prázdný)");
  await foto("01-prehled-prazdny");

  // ---------- příjem 1: nový zákazník ----------
  await p.click("text=Nový příjem vozu");
  const dnesek = await p.evaluate(() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); });
  const za60 = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 60); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); });
  kontrola(await p.inputValue('[data-pole="zakazka.datum_prijmu"]') === dnesek, "datum převzetí = dnešek");
  kontrola(await p.inputValue('[data-pole="zakazka.predpoklad_dokonceni"]') === za60, "předpoklad dokončení = dnešek + 60 dní");
  await p.fill('[data-pole="zakazka.datum_prijmu"]', "2026-11-02");
  kontrola(await p.inputValue('[data-pole="zakazka.predpoklad_dokonceni"]') === "2027-01-01", "změna data převzetí posune dokončení (2. 11. → 1. 1.)");
  await p.fill('[data-pole="zakazka.datum_prijmu"]', dnesek);
  await p.click('[data-segment="vozidlo.verze"] >> text=US');
  kontrola(await p.getAttribute('[data-segment="vozidlo.jednotka_tachometru"] button[aria-pressed="true"]', "data-hodnota") === '"mi"', "US verze přepne tachometr na míle");
  kontrola(await p.isVisible("text=Stav tachometru (míle)"), "popisek tachometru v mílích");
  await p.click('[data-segment="vozidlo.verze"] >> text=EU');
  kontrola(await p.getAttribute('[data-segment="vozidlo.jednotka_tachometru"] button[aria-pressed="true"]', "data-hodnota") === '"km"', "EU verze vrátí km");
  kontrola(await p.isVisible("text=Stav při převzetí do opravy") && await p.isVisible("#sekce-odhad >> text=6") && await p.isVisible("#sekce-fotky >> text=7"), "pořadí: 6 Odhadovaná cena, 7 Fotky");
  // zakázkový list: závady nad 8 řádků → nejde k podpisu (zákazník by podepsal neúplný list)
  for (let i = 0; i < 9; i++) { await p.click('[data-pridat="zavady"]'); }
  await p.evaluate(() => { document.querySelectorAll('textarea[data-radek="zavady"]').forEach((t, i) => { t.value = "Závada číslo " + (i + 1); t.dispatchEvent(new Event("input", { bubbles: true })); }); });
  kontrola(/10 řádků z 8/.test(await p.textContent('[data-zbyva="zavady"]')) && /nevejdou/.test(await p.textContent("#co-chybi")), "závady nad 8 řádků: červené upozornění a nejde k podpisu");
  while (await p.locator('[data-smazat="zavady"]').count() > 1) await p.click('[data-smazat="zavady"] >> nth=0');
  await p.fill('textarea[data-radek="zavady"]', "");
  // nesmyslné hodnoty zčervenají a nepustí k podpisu
  await p.fill('[data-pole="vozidlo.rok"]', "1850");
  await p.fill('[data-pole="zakaznik.email"]', "jan@");
  kontrola(await p.evaluate(() => document.querySelector('[data-pole="vozidlo.rok"]').classList.contains("neplatne")) && /Rok výroby 1900/.test(await p.evaluate(() => [...document.querySelectorAll(".chyba-pole")].map(e => e.textContent).join(" "))) && /neplatný e-mail/.test(await p.textContent("#co-chybi")), "rok 1850 a e-mail „jan@“ zčervenají a jsou v seznamu „Chybí“");
  await p.fill('[data-pole="vozidlo.rok"]', ""); await p.fill('[data-pole="zakaznik.email"]', "");
  await p.fill('[data-pole="zakaznik.jmeno"]', "Jan Novák");
  await p.fill('[data-pole="zakaznik.ulice"]', "Lipová 12");
  await p.fill('[data-pole="zakaznik.psc"]', "500 02");
  await p.fill('[data-pole="zakaznik.mesto"]', "Hradec Králové");
  await p.fill('[data-pole="zakaznik.telefon"]', "+420 600 111 222");
  await p.fill('[data-pole="zakaznik.email"]', "jan.novak@example.cz");
  await p.fill('[data-pole="vozidlo.vin"]', "wdb1260241a000001");
  await p.waitForSelector("text=Nové auto");
  kontrola(await p.inputValue('[data-pole="vozidlo.typ"]') === "126", "z VIN se doplnil typ 126");
  kontrola(await p.isVisible("text=kód modelu 126.024"), "z VIN se rozluštil kód modelu 126.024");
  await p.waitForFunction(() => document.querySelector('[data-pole="vozidlo.model"]').value === "300 SE");
  kontrola(true, "katalog: z VIN 126.024 se doplnil model 300 SE");
  kontrola(/126\.024/.test(await p.textContent("#info-katalog")) && /M103/.test(await p.textContent("#info-katalog")), "katalog: ukáže typ, roky výroby a motor (M103)");
  await p.fill('[data-pole="vozidlo.rok"]', "1981"); await p.waitForTimeout(50);
  const kat = await p.evaluate(() => ({ typy: [...document.querySelectorAll("#dl-typ option")].map(o => o.value), cervena: document.querySelector('[data-pole="vozidlo.rok"]').classList.contains("neplatne"), info: document.querySelector("#info-katalog").textContent }));
  kontrola(!kat.typy.includes("129") && kat.typy.includes("123") && kat.typy.includes("107"), "katalog: v roce 1981 nenabídne W129, nabídne W123 a R107");
  kontrola(kat.cervena && /vyráběl 1985/.test(kat.info), "katalog: rok 1981 k 300 SE (126.024) zčervená – vyráběl se 1985–1991");
  await p.fill('[data-pole="vozidlo.rok"]', "1989"); await p.waitForTimeout(50);
  kontrola(!(await p.evaluate(() => document.querySelector('[data-pole="vozidlo.rok"]').classList.contains("neplatne"))), "katalog: rok 1989 je v pořádku");
  await p.fill('[data-pole="vozidlo.spz"]', "1H1 2345");
  await p.fill('[data-pole="zakazka.km_prijem"]', "123456");
  await p.fill('[data-pole="zakazka.predpoklad_dokonceni"]', "2027-01-07");
  await p.click('[data-segment="zakazka.nadrz_prijem"] >> text=1/4');
  await p.fill('[data-pole="zakazka.odhad_ceny"]', "40 000");
  await p.click('.cip[data-cip="zavady"] >> nth=0');
  await p.click('.cip[data-cip="zavady"] >> nth=1');
  await p.click('[data-pridat="zavady"]');
  await p.keyboard.type("Svítí kontrolka ASD");
  await p.click('[data-pridat="zavady"]');
  await p.keyboard.type("Zatéká čelním oknem do prostoru pro nohy řidiče");
  await p.click('.cip[data-cip="zavady"] >> nth=2');
  await p.click('.cip[data-cip="stav_prijem"] >> nth=0');
  await p.click('[data-pridat="stav_prijem"]');
  await p.keyboard.type("Zadní anténa nefunkční");
  await p.click('.cip[data-cip="stav_prijem"] >> nth=1');
  await p.setInputFiles("#foto-galerie", ["testy/auto-1.jpg", "testy/auto-2.jpg"]);
  await p.waitForFunction(() => document.querySelectorAll("#fotky .fotka.nahrano img").length === 2);
  kontrola(true, "2 fotky zmenšeny a nahrány");
  await p.setInputFiles("#video-kamera", "testy/video-test.webm");
  await p.waitForFunction(() => document.querySelectorAll("#fotky .fotka.nahrano").length === 3);
  kontrola(await p.locator("#fotky .ikona-videa").count() === 1 && await p.locator("#fotky .fotka img").count() === 3, "video nahráno i s náhledem");
  kontrola((await p.textContent("#pocet-fotek")) === "2 fotky, 1 video", "počet: 2 fotky, 1 video");
  kontrola(await p.locator("#fotky .stav-fotky.nahrano >> text=✓ Nahráno").count() === 3, "u každé fotky i videa zelená fajfka ✓ Nahráno");
  kontrola((await p.textContent(".souhrn-ok")).trim() === "✓ Vše nahráno (2 fotky, 1 video)", "souhrn: ✓ Vše nahráno (2 fotky, 1 video)");
  kontrola(/0:03/.test(await p.textContent("#fotky .info-videa")), "u videa je vidět délka (0:03)");
  kontrola(await p.isVisible("text=30 s ve Full HD (1080p)"), "poznámka s limitem videa je vidět");
  // rozpracovaný příjem přežije obnovení stránky
  await p.reload(); await p.waitForSelector('[data-pole="zakaznik.jmeno"]');
  kontrola(await p.inputValue('[data-pole="zakaznik.jmeno"]') === "Jan Novák" && await p.locator("#fotky .fotka").count() === 3, "rozpracovaný příjem přežil obnovení stránky");
  await foto("02-prijem-formular");

  await p.click("#k-podpisu");
  await p.waitForSelector("#nahled");
  await p.waitForFunction(() => document.querySelector("#nahled").contentDocument?.querySelector("section.page"));
  kontrola(await p.isDisabled("#ulozit"), "bez podpisu nejde uložit");
  await p.locator("#podpis").scrollIntoViewIfNeeded();
  const c = await p.locator("#podpis").boundingBox();
  await p.mouse.move(c.x + 40, c.y + 140); await p.mouse.down();
  for (let i = 0; i <= 60; i++) await p.mouse.move(c.x + 40 + i * 6, c.y + 120 - Math.sin(i / 4) * 40 * Math.cos(i / 15), { steps: 1 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  kontrola(!(await p.isDisabled("#ulozit")), "po podpisu jde uložit");
  await foto("03-nahled-podpis");
  await p.click("#ulozit");
  await p.waitForSelector("text=Zakázkový list uložen");
  kontrola(await p.isVisible("text=7377-1"), "uloženo jako 7377-1");
  kontrola((await p.evaluate(() => document.querySelector(".velke-cislo").textContent)) === "7377-1", "číslo dokladu 7377-1");
  await foto("04-hotovo");

  const ulozeno = await p.evaluate(() => ({ t: window.__ULOZENO__.tabulky, pdf: Object.entries(window.__ULOZENO__.soubory).filter(([k]) => k.endsWith(".pdf")).map(([k, v]) => [k, Array.from(v)]) }));
  kontrola(ulozeno.t.doklady.length === 1 && ulozeno.t.doklady[0].cislo === "7377-1" && ulozeno.t.doklady[0].variabilni_symbol === "73771" && ulozeno.t.doklady[0].zamceno, "doklad 7377-1, VS 73771, uzamčený");
  kontrola(ulozeno.t.podpisy.length === 2 && ulozeno.t.podpisy.every(x => /^[0-9a-f]{64}$/.test(x.otisk_dokumentu)), "2 podpisy s otiskem SHA-256");
  kontrola(ulozeno.t.soubory.filter(s => s.druh === "foto").length === 2 && ulozeno.t.soubory.filter(s => s.druh === "video" && s.mime === "video/webm" && /^videa\/.*\.webm$/.test(s.klic)).length === 1, "2 fotky a 1 video přiřazené k zakázce");
  kontrola(ulozeno.t.zakazky[0].zavady.length === 5 && ulozeno.t.zakazky[0].km_prijem === 123456 && ulozeno.t.zakazky[0].odhad_ceny === 40000, "závady, km a odhad uložené");
  fs.writeFileSync(path.join(OUT, "7377-1.pdf"), Buffer.from(ulozeno.pdf[0][1]));

  await p.click("text=Detail zakázky");
  await p.waitForSelector("text=Otevřít PDF");
  await p.waitForSelector("#sekce-fotky-detail"); await p.evaluate(() => { const d = document.getElementById("sekce-fotky-detail"); if (d) d.open = true; });
  await p.waitForSelector("#sekce-fotky-detail video");
  kontrola(await p.locator("#sekce-fotky-detail video").count() === 1 && await p.locator("#sekce-fotky-detail img").count() === 2, "detail ukazuje 2 fotky a přehrávatelné video");
  await foto("05-detail");

  // ---------- práce, díly → nabídka 7377-2 → faktura 7377-3 → úhrada → protokol 7377-4 ----------
  let odpovedPrompt = "2026-11-05";
  let odmitnoutDialog = false;
  p.on("dialog", d => d.type() === "prompt" ? d.accept(odpovedPrompt) : odmitnoutDialog ? d.dismiss() : d.accept());
  await p.click('[data-pridat-pol="inspekce"]');
  await p.click('[data-pridat-pol="prace"]');
  await p.locator('.radek-pol[data-i="1"] [data-f="popis"]').fill("Odstranění závady ASD");
  await p.locator('.radek-pol[data-i="1"] [data-f="mnozstvi"]').fill("4");
  await p.click('[data-ze-zavady="2"]');
  await p.click('[data-pridat-pol="pausal"]');
  await p.locator('.radek-pol[data-i="3"] [data-f="popis"]').fill("Likvidace kapalin");
  await p.locator('.radek-pol[data-i="3"] [data-f="castka"]').fill("350");
  await p.click("#pridat-dil");
  await p.locator('.dil[data-i="0"] [data-f="nazev"]').fill("Hydraulické čerpadlo ASD");
  await p.locator('.dil[data-i="0"] [data-f="cislo_mb"]').fill("A 001 466 82 01");
  await p.locator('.dil[data-i="0"] [data-f="nakupni_cena"]').fill("10000");
  kontrola(await p.inputValue('.dil[data-i="0"] [data-f="prodejni_cena"]') === "13000", "díl: nákup 10 000 + 30 % marže = prodej 13 000");
  await p.locator('.dil[data-i="0"] [data-f="poznamka"]').fill("Original MB");
  await p.selectOption('.dil[data-i="0"] [data-f="dodavatel_id"]', "d3");
  kontrola(await p.inputValue('.dil[data-i="0"] [data-f="puvod"]') === "original", "dodavatel MB (original) → původ se sám nastaví na MB (original)");
  await p.click("#pridat-dil");
  await p.locator('.dil[data-i="1"] [data-f="nazev"]').fill("Těsnění");
  await p.selectOption('.dil[data-i="1"] [data-f="mena"]', "EUR");
  kontrola(await p.inputValue('.dil[data-i="1"] [data-f="kurz"]') === "24,34", "díl v EUR: kurz se předvyplní podle ČNB (24,34)");
  await p.locator('.dil[data-i="1"] [data-f="kurz"]').fill("25");
  await p.locator('.dil[data-i="1"] [data-f="nakupni_cena"]').fill("10");
  kontrola(await p.inputValue('.dil[data-i="1"] [data-f="prodejni_cena"]') === "325", "díl v EUR: 10 € × 25 + 30 % = 325 Kč");
  await p.selectOption('.dil[data-i="1"] [data-f="dodavatel_id"]', "d1");
  kontrola(await p.inputValue('.dil[data-i="1"] [data-f="puvod"]') === "aftermarket", "jiný dodavatel (Auto Kelly) → původ Aftermarket");
  await p.waitForSelector("#stav-dilu >> text=✓ Uloženo"); await p.waitForSelector("#stav-prace >> text=✓ Uloženo");
  const souhrn = await p.textContent("#souhrn");
  const sh = souhrn.replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ");
  if (!/Práce \(6 h\) ?9 050 Kč/.test(sh)) console.log("souhrn:", sh);
  // daň 50 % z práce (9 050 → 4 525) a z marže dílů (3 000 → 1 500, 75 → 38) = 6 063 Kč
  kontrola(/Práce \(6 h\) ?9 050 Kč/.test(sh) && /Materiál \(díly\) ?13 325 Kč/.test(sh) && /marže ?6 063 Kč/.test(sh) && /Celkem ?28 438 Kč/.test(sh), "souhrn: daň 50 % jen z práce a marže dílů (6 063 Kč), celkem 28 438 Kč");
  await p.fill("#dan-pct", "20"); await p.waitForSelector("#stav-dane >> text=✓ Uloženo");
  kontrola((await p.textContent("#souhrn-celkem")).replace(/\s/g, "") === "24800Kč" && await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky[0].dan_pct === 20), "daň jde změnit (20 % → celkem 24 800 Kč) a uloží se k zakázce");
  await p.fill("#dan-pct", "50"); await p.waitForSelector("#stav-dane >> text=✓ Uloženo");
  await p.uncheck("#dan-zap"); await p.waitForSelector("#stav-dane >> text=✓ Uloženo");   // další kontroly dokladů počítají ceny bez daně
  { const t = (await p.textContent("#souhrn")).replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ");
    kontrola(/Celkem bez daně ?22 375 Kč/.test(t) && /S daní by to bylo ?28 438 Kč/.test(t) && await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky[0].dan_zapnuto === false), "políčko Daň vypnuto: celkem bez daně 22 375 Kč, náhled „s daní by to bylo 28 438 Kč“, uloží se k zakázce"); }
  await foto("11-prace-dily");
  // změna a hned odchod na přehled – musí se uložit i tak (bez čekání)
  await p.locator('.radek-pol[data-i="0"] [data-f="mnozstvi"]').fill("1");
  const zid = await p.evaluate(() => location.hash.split("/")[2]);
  await p.evaluate(() => { location.hash = "#/zakazky"; }); await p.waitForSelector("#seznam .zakazka-radek");
  await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, zid); await p.waitForSelector('.radek-pol[data-i="3"]');
  kontrola(await p.locator(".radek-pol[data-i]").count() === 4 && await p.locator(".dil[data-i]").count() === 2, "práce a díly se uložily i při rychlém odchodu ze stránky");
  // bez signálu: změna se podrží v zařízení (⏳ čeká na odeslání), jde odejít, po návratu signálu se odešle sama
  {
    await p.evaluate(() => { window.__OFFLINE__ = true; });
    await p.locator('.radek-pol[data-i="0"] [data-f="sazba"]').fill("1250");
    await p.waitForSelector("#stav-prace >> text=Bez signálu");
    await p.waitForSelector("#fronta-odznak:not([hidden]) >> text=1 čeká na odeslání");
    kontrola(true, "bez signálu: změna se podrží a v liště je ⏳ 1 čeká na odeslání");
    await p.evaluate(() => { location.hash = "#/zakaznici"; }); await p.waitForTimeout(400);
    kontrola(/#\/zakaznici/.test(await p.evaluate(() => location.hash)), "bez signálu: ze zakázky jde normálně odejít (nic se neztratí)");
    await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, zid); await p.waitForSelector('.radek-pol[data-i="0"]');
    kontrola(await p.inputValue('.radek-pol[data-i="0"] [data-f="sazba"]') === "1250", "bez signálu: po znovuotevření zakázky je vidět neodeslaná změna (1250)");
    await p.evaluate(() => { window.__OFFLINE__ = false; window.dispatchEvent(new Event("online")); });
    await p.waitForSelector("#fronta-odznak", { state: "hidden" });
    kontrola(await p.evaluate(() => window.__ULOZENO__.tabulky.polozky.some(x => Number(x.sazba) === 1250)), "po návratu signálu se změna odešle sama");
    await p.locator('.radek-pol[data-i="0"] [data-f="sazba"]').fill("1200"); await p.waitForSelector("#stav-prace >> text=✓ Uloženo");
  }

  await p.click("text=📝 Cenová nabídka");
  await p.waitForSelector("#vystavit:not([disabled])");
  kontrola((await p.textContent("#vystavit")).includes("7377-2"), "nabídka dostane číslo 7377-2");
  // výpadek signálu: doklad v databázi vznikl, ale odpověď se ztratila → druhý pokus nesmí vytvořit druhou nabídku
  await p.evaluate(() => { window.__PO_VYSTAVENI_CHYBA__ = true; });
  await p.click("#vystavit"); await p.waitForSelector("#hlaska >> text=Vystavení se nepovedlo");
  await p.click("#vystavit");
  await p.waitForSelector(".velke-cislo >> text=7377-2", { timeout: 8000 }).catch(async e => { console.log("HLÁŠKA:", await p.textContent("#hlaska"), chyby, p.url()); await p.screenshot({ path: path.join(OUT, "chyba.png") }); throw e; });
  kontrola(await p.evaluate(() => window.__ULOZENO__.tabulky.doklady.filter(d => d.cislo.startsWith("7377-2")).length) === 1, "výpadek při vystavení: po opakování jen jedna nabídka 7377-2 (žádná 7377-2-2)");
  await p.click("text=Detail zakázky");
  await p.waitForSelector("text=📝 Cenová nabídka");
  // zálohová faktura na materiál (předvyplněno 13 325 Kč, text s číslem nabídky) → zaplaceno
  await p.click("text=💰 Zálohová faktura");
  await p.waitForSelector("#vystavit:not([disabled])");
  kontrola(await p.inputValue('[data-d="castka"]') === "13325" && /dle cenové nabídky 7377-2/.test(await p.inputValue('[data-d="popis"]')), "zálohová: předvyplněno 13 325 Kč a text „Záloha na materiál dle cenové nabídky 7377-2“");
  await p.click("#vystavit");
  await p.waitForSelector(".velke-cislo >> text=7377-5");
  await p.click("text=Detail zakázky");
  await p.waitForSelector("[data-zaplaceno]");
  // nezaplacená záloha se do faktury sama neodečte (jinak by chyběly peníze)
  await p.click("text=💳 Faktura"); await p.waitForSelector('[data-odecist="7377-5"]');
  kontrola(!(await p.isChecked('[data-odecist="7377-5"]')), "faktura: nezaplacená záloha není předvybraná k odečtu");
  await p.goBack(); await p.waitForSelector("[data-zaplaceno]");
  await p.click("[data-zaplaceno]");
  await p.waitForSelector("text=zaplaceno 5. 11. 2026");
  await p.click("text=💳 Faktura");
  await p.waitForSelector("#vystavit:not([disabled])");
  kontrola((await p.textContent("#k-uhrade")).replace(/\s/g, "") === "9050Kč", "faktura: odečte zaplacenou zálohu → k úhradě 9 050 Kč");
  await foto("12-faktura-nahled");
  await p.click("#vystavit");
  await p.waitForSelector(".velke-cislo >> text=7377-3");
  const uf = await p.evaluate(() => ({ d: window.__ULOZENO__.tabulky.doklady, z: window.__ULOZENO__.tabulky.zakazky, pdf: Object.entries(window.__ULOZENO__.soubory).filter(([k]) => /7377-[235]-/.test(k)).map(([k, v]) => [k, Array.from(v)]) }));
  const fa = uf.d.find(x => x.cislo === "7377-3"), na = uf.d.find(x => x.cislo === "7377-2");
  const za = uf.d.find(x => x.cislo === "7377-5");
  kontrola(na && na.celkem === 22375 && za && za.celkem === 13325 && za.variabilni_symbol === "73775" && fa && fa.celkem === 9050 && fa.variabilni_symbol === "73773", "nabídka 22 375, záloha 13 325 (VS 73775), faktura 9 050 (VS 73773)");
  for (const [k, v] of uf.pdf) fs.writeFileSync(path.join(OUT, path.basename(k)), Buffer.from(v));
  const plSoubory = await p.evaluate(() => window.__ULOZENO__.tabulky.soubory.filter(f => /parts-list/.test(f.klic)).map(f => [f.klic, f.doklad_id]));
  kontrola(plSoubory.length === 2 && plSoubory.every(([, d]) => d), "parts list přiložen k nabídce i k faktuře (ne k zálohové)");
  const txtPl = require("child_process").execFileSync("pdftotext", ["-layout", path.join(OUT, "7377-3-parts-list.pdf"), "-"]).toString();
  kontrola(/PARTS LIST\s+# 7377/.test(txtPl) && /Reference: Invoice 7377-3/.test(txtPl) && /VIN: WDB1260241A000001/.test(txtPl) && /Hydraulické čerpadlo ASD\s+A 001 466 82 01\s+Original\s+1\s+13 000 CZK\s+13 000 CZK\s+Original MB/.test(txtPl)
    && /Těsnění\s+Aftermarket\s+1\s+325 CZK/.test(txtPl) && /TOTAL\s+13 325 CZK/.test(txtPl) && /Original – genuine Mercedes-Benz part/.test(txtPl),
    "PDF parts listu: vůz, odkaz na fakturu, díl s číslem, původem, cenou za kus i celkem a poznámkou, TOTAL 13 325 CZK, vysvětlivky");
  const txtFa = require("child_process").execFileSync("pdftotext", ["-l", "1", "-layout", path.join(OUT, "7377-3-faktura.pdf"), "-"]).toString();
  kontrola(/FAKTURA\s+#\s*7377-3/.test(txtFa) && /Variabilní symbol:\s+73773/.test(txtFa) && /9 050,00 Kč/.test(txtFa) && /Likvidace kapalin/.test(txtFa) && /Odečet zálohy 7377-5\s+-13 325/.test(txtFa) && /13 325/.test(txtFa), "PDF faktury: 7377-3, VS 73773, materiál 13 325, odečet zálohy −13 325, k úhradě 9 050,00 Kč");
  const txtZa = require("child_process").execFileSync("pdftotext", ["-layout", path.join(OUT, "7377-5-zalohova-faktura.pdf"), "-"]).toString();
  kontrola(/ZÁLOHOVÁ FAKTURA\s+#\s*7377-5/.test(txtZa) && /13 325,00 Kč/.test(txtZa) && /Zúčtování zálohy/.test(txtZa), "PDF zálohové faktury: 7377-5, 13 325,00 Kč, zadní strana o zúčtování zálohy");
  const txtNa = require("child_process").execFileSync("pdftotext", ["-l", "1", "-layout", path.join(OUT, "7377-2-cenova-nabidka.pdf"), "-"]).toString();
  kontrola(/CENOVÁ NABÍDKA/.test(txtNa) && /Datum platnosti:/.test(txtNa), "PDF nabídky: CENOVÁ NABÍDKA s datem platnosti");
  await p.click("text=Detail zakázky");
  await p.waitForSelector("[data-zaplaceno]");
  await p.click("[data-zaplaceno]");
  await p.waitForFunction(() => document.querySelectorAll(".doklad").length && !document.querySelector("[data-zaplaceno]"));
  kontrola(true, "faktura označena jako zaplacená (vydaná faktura zůstala zamčená)");
  // omylem zaplaceno → vrátit zpět
  await p.click('.doklad:has(b:text-is("7377-3")) [data-nezaplaceno]');
  await p.waitForSelector('.doklad:has(b:text-is("7377-3")) [data-zaplaceno]');
  kontrola(await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; return !T.doklady.find(d => d.cislo === "7377-3").zaplaceno && T.zakazky[0].stav === "fakturovano"; }), "„Zrušit úhradu“ vrátí fakturu na nezaplacenou a zakázku na Fakturováno");
  kontrola(await p.isVisible('.doklad:has(b:text-is("7377-3")) [data-smazat-doklad]') && !(await p.isVisible('.doklad:has(b:text-is("7377-5")) [data-smazat-doklad]')) && !(await p.isVisible('.doklad:has(b:text-is("7377-1")) [data-smazat-doklad]')),
    "koš: u nezaplacené faktury ano, u zálohy odečtené ve faktuře a u zakázkového listu ne");
  await p.click('.doklad:has(b:text-is("7377-3")) [data-zaplaceno]');
  await p.waitForSelector('.doklad:has(b:text-is("7377-3")) [data-nezaplaceno]');
  await p.click("text=🔑 Předávací protokol");
  await p.waitForSelector("#co-chybi:not([hidden])");
  kontrola(!/stav tachometru/.test(await p.textContent("#co-chybi")) && /podpis zákazníka/.test(await p.textContent("#co-chybi")) && await p.inputValue('[data-d="km"]') === "123456", "protokol: km předvyplněné z příjmu a nepovinné, chce podpis zákazníka");
  await p.fill('[data-d="km"]', "123890");
  await p.click("[data-cip-stav] >> nth=0");
  await p.click('[data-seg="kola"] >> text=Ano');
  await p.locator("#podpis").scrollIntoViewIfNeeded();
  const cp = await p.locator("#podpis").boundingBox();
  await p.mouse.move(cp.x + 60, cp.y + 120); await p.mouse.down();
  for (let i = 0; i <= 40; i++) await p.mouse.move(cp.x + 60 + i * 7, cp.y + 110 - Math.sin(i / 3) * 30);
  await p.mouse.up();
  await p.waitForSelector("#vystavit:not([disabled])");
  await p.click("#vystavit");
  await p.waitForSelector(".velke-cislo >> text=7377-4", { timeout: 10000 }).catch(async e => { console.log("HLÁŠKA:", await p.textContent("#hlaska"), chyby, p.url()); await p.screenshot({ path: path.join(OUT, "chyba.png") }); throw e; });
  const up = await p.evaluate(() => ({ z: window.__ULOZENO__.tabulky.zakazky[0], v: window.__ULOZENO__.tabulky.vozidla[0], pdf: Object.entries(window.__ULOZENO__.soubory).filter(([k]) => /7377-4-/.test(k)).map(([k, v]) => Array.from(v)) }));
  kontrola(up.z.stav === "predano" && up.z.km_predani === 123890 && up.z.kola_dotazena === true && up.v.km_posledni === 123890, "po protokolu: zakázka předána, km 123 890 u zakázky i auta");
  fs.writeFileSync(path.join(OUT, "7377-4.pdf"), Buffer.from(up.pdf[0]));
  const txtPp = require("child_process").execFileSync("pdftotext", ["-layout", path.join(OUT, "7377-4.pdf"), "-"]).toString();
  kontrola(/PŘEDÁVACÍ PROTOKOL/.test(txtPp) && /7377-4/.test(txtPp) && /Kontrola dotažení kol/.test(txtPp), "PDF protokolu: číslo 7377-4, text o dotažení kol na zadní straně");
  await p.click("text=Detail zakázky");
  await p.waitForSelector("text=7377-4");
  await foto("13-detail-doklady");
  // přehled dokladů
  await p.click(".lista-vpravo >> text=Doklady");
  await p.waitForSelector(".dlazdice-k");
  const dl = (await p.textContent("#dlazdice")).replace(/\s/g, "");
  kontrola(/Faktury9050Kč1ks\+zálohové13325Kč/.test(dl) && /Nezaplaceno0Kč0ks/.test(dl), "přehled dokladů: faktury 9 050 Kč + zálohové 13 325 Kč, nic nezaplaceného");
  await p.click('#f-druh >> text=Vše');
  kontrola(await p.locator("#seznam-dokladu .doklad").count() === 5, "přehled dokladů: všech 5 dokladů zakázky 7377");
  await foto("14-prehled-dokladu");
  kontrola(!(await p.isVisible('.doklad:has(b:text-is("7377-3")) [data-smazat-doklad]')) && await p.isVisible('.doklad:has(b:text-is("7377-2")) [data-smazat-doklad]'), "přehled: zaplacená faktura bez koše, nabídka s košem");
  await p.click('.doklad:has(b:text-is("7377-2")) [data-smazat-doklad]');
  await p.waitForFunction(() => document.querySelectorAll("#seznam-dokladu .doklad").length === 4);
  kontrola(await p.evaluate(() => !window.__ULOZENO__.tabulky.doklady.some(d => d.cislo === "7377-2")), "koš smaže chybnou nabídku 7377-2 (zbývají 4 doklady)");
  // opravný doklad k faktuře 7377-3
  await p.click('.doklad:has(b:text-is("7377-3")) a[href^="#/zakazka/"]');
  await p.waitForSelector('a[href$="/opravny"]');
  await p.click('a[href$="/opravny"]');
  await p.waitForSelector("#co-chybi:not([hidden])");
  kontrola(/důvod opravy/.test(await p.textContent("#co-chybi")), "opravný doklad chce důvod a položku");
  await p.fill('[data-d="duvod"]', "Sleva dohodnutá se zákazníkem");
  await p.click('[data-opr-cip="Sleva z ceny"]');
  await p.fill('[data-or="castka"] >> nth=0', "-1000");
  await p.waitForSelector("#vystavit:not([disabled])");
  kontrola((await p.textContent("#k-uhrade")).replace(/\s/g, "") === "-1000Kč" && (await p.textContent("#vystavit")).includes("7377-6"), "opravný doklad 7377-6 na −1 000 Kč");
  await p.click("#vystavit");
  await p.waitForSelector(".velke-cislo >> text=7377-6", { timeout: 10000 });
  const op = await p.evaluate(() => ({ d: window.__ULOZENO__.tabulky.doklady.find(d => d.cislo === "7377-6"), pdf: Object.entries(window.__ULOZENO__.soubory).filter(([k]) => /7377-6-opravny/.test(k)).map(([, v]) => Array.from(v))[0] }));
  kontrola(op.d && op.d.celkem === -1000 && op.d.variabilni_symbol === "73776" && op.d.zamceno, "opravný doklad uložen: −1 000 Kč, VS 73776, uzamčený");
  fs.writeFileSync(path.join(OUT, "7377-6.pdf"), Buffer.from(op.pdf));
  const txtOp = require("child_process").execFileSync("pdftotext", ["-layout", path.join(OUT, "7377-6.pdf"), "-"]).toString();
  kontrola(/OPRAVNÝ DOKLAD/.test(txtOp) && /Oprava faktury 7377-3 ze dne/.test(txtOp) && /Důvod: Sleva dohodnutá se zákazníkem/.test(txtOp) && /-1 000,00 Kč/.test(txtOp), "PDF opravného dokladu: odkaz na fakturu 7377-3, důvod, −1 000,00 Kč");

  // faktura / záloha s opravným dokladem už nejde smazat (ani když se zruší úhrada)
  {
    await p.evaluate(() => window.__ULOZENO__.tabulky.doklady.filter(d => ["7377-3", "7377-5"].includes(d.cislo)).forEach(d => { d._zapl = d.zaplaceno; d.zaplaceno = null; }));
    await p.evaluate(() => { location.hash = "#/doklady"; }); await p.waitForSelector(".doklad >> text=7377-6");
    kontrola(!(await p.isVisible('.doklad:has(b:text-is("7377-3")) [data-smazat-doklad]')) && !(await p.isVisible('.doklad:has(b:text-is("7377-5")) [data-smazat-doklad]')), "faktura i záloha s opravným dokladem nemají koš");
    const chyba = await p.evaluate(async () => { const d = window.__ULOZENO__.tabulky.doklady.find(x => x.cislo === "7377-3"); try { await window.__WERK_DB__.smazatDoklad(d.id); return ""; } catch (e) { return e.message; } });
    kontrola(/opravný doklad/.test(chyba), "server odmítne smazat fakturu s opravným dokladem");
    await p.evaluate(() => window.__ULOZENO__.tabulky.doklady.forEach(d => { if ("_zapl" in d) { d.zaplaceno = d._zapl; delete d._zapl; } }));
  }

  // ---------- příjem 2: stejné auto, stávající zákazník přes hledání ----------
  await p.goto(URL0 + "#/novy");
  await p.fill("#hledat", "nov");
  await p.waitForSelector(".vysledek >> text=Jan Novák");
  await p.click(".vysledek >> text=Jan Novák");
  await p.waitForSelector("text=Auta zákazníka");
  await p.click('[data-auto="0"]');
  await p.waitForSelector("text=Auto známe");
  kontrola(await p.isVisible("text=naposledy zakázka #7377"), "auto poznáno podle VIN (naposledy #7377)");
  kontrola(await p.inputValue('[data-pole="vozidlo.model"]') === "300 SE", "údaje auta se doplnily");
  await p.fill('[data-pole="zakazka.km_prijem"]', "123700");
  await p.click('[data-segment="zakaznik.jazyk"] >> text=English');
  await p.click('.cip[data-cip="zavady"] >> nth=0');
  await p.click('.cip[data-cip="stav_prijem"] >> nth=0');
  await foto("06-druhy-prijem-en");
  await p.click("#k-podpisu");
  await p.waitForFunction(() => document.querySelector("#nahled").contentDocument?.querySelector("section.page"));
  await p.locator("#podpis").scrollIntoViewIfNeeded();
  const c2 = await p.locator("#podpis").boundingBox();
  await p.mouse.move(c2.x + 60, c2.y + 130); await p.mouse.down();
  for (let i = 0; i <= 40; i++) await p.mouse.move(c2.x + 60 + i * 8, c2.y + 110 - Math.cos(i / 3) * 30);
  await p.mouse.up(); await p.waitForTimeout(300);
  await p.click("#ulozit");
  await p.waitForSelector("text=Zakázkový list uložen");
  kontrola(await p.isVisible("text=7378-1"), "druhá zakázka 7378-1 (anglicky)");
  const u2 = await p.evaluate(() => ({ t: window.__ULOZENO__.tabulky, pdf: Object.entries(window.__ULOZENO__.soubory).filter(([k]) => k.includes("7378") && k.endsWith(".pdf")).map(([k, v]) => [k, Array.from(v)]) }));
  kontrola(u2.t.zakaznici.length === 1 && u2.t.vozidla.length === 1 && u2.t.vlastnictvi.length === 1, "zákazník i auto jen jednou (nic zdvojeného)");
  fs.writeFileSync(path.join(OUT, "7378-1.pdf"), Buffer.from(u2.pdf[0][1]));
  await p.evaluate(() => { location.hash = "#/"; });
  await p.waitForSelector(".dlazdice-k");
  kontrola(await p.isVisible("h1 >> text=Přehled") && await p.isVisible(".dlazdice-k >> text=V dílně") && await p.isVisible(".dlazdice-k >> text=Nezaplaceno"), "úvodní přehled: dlaždice V dílně, Nezaplaceno");
  kontrola(await p.locator(".uvod-mrizka .zakazka-radek").count() >= 1, "úvodní přehled ukazuje zakázky");
  await foto("06-uvod");
  await p.click('.lista-vpravo a[href="#/zakazky"]');
  await p.waitForSelector("#f-stav"); await p.waitForSelector("#seznam .zakazka-radek");
  kontrola(await p.locator(".zakazka-radek").count() === 2, "přehled ukazuje 2 zakázky");
  await p.selectOption("#f-razeni", "cislo+");
  kontrola(/7377/.test(await p.locator(".zakazka-radek").first().textContent()), "řazení: nejstarší zakázka první");
  const stavy = await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky.map(z => z.stav));
  const hot = stavy.filter(x => ["hotovo", "fakturovano", "zaplaceno", "predano"].includes(x)).length;
  await p.selectOption("#f-stav", "hotove");
  kontrola(await p.locator(".zakazka-radek").count() === hot && new RegExp(`${hot} z 2|2 zakázek`).test(await p.textContent("#f-pocet")), "filtr Hotové / předané");
  await p.selectOption("#f-stav", "otevrene");
  kontrola(await p.locator(".zakazka-radek").count() === 2 - hot - stavy.filter(x => x === "zruseno").length, "filtr Rozpracované");
  await p.selectOption("#f-stav", ""); await p.selectOption("#f-razeni", "cislo-");
  await foto("07-prehled");

  await p.click(".zakazka-radek >> text=7378"); await p.waitForSelector("#sekce-udaje");
  kontrola(await p.evaluate(() => !document.getElementById("sekce-udaje").open && ["Zákazník", "Vozidlo", "Příjem"].every(t => document.getElementById("sekce-udaje").textContent.includes(t))
    && document.getElementById("sekce-servis").compareDocumentPosition(document.getElementById("sekce-dily")) & Node.DOCUMENT_POSITION_FOLLOWING),
    "zákazník, vozidlo a příjem jsou v jedné sbalené sekci; Servisní úkony jsou nad Díly");
  await p.click("#sekce-udaje > summary"); await p.waitForSelector(".kontakt-tlacitka");
  kontrola(await p.getAttribute('.kontakt-tlacitka a[href^="https://wa.me/"]', "href") === "https://wa.me/420600111222" && await p.isVisible('.kontakt-tlacitka >> text=Zavolat'), "zákazník v zakázce: Zavolat a WhatsApp (+420 600 111 222)");
  kontrola(!(await p.isVisible(".rychle-foto")), "iPad: rychlé focení nahoře se neukazuje (jen iPhone)");
  await p.evaluate(() => { location.hash = "#/zakazky"; }); await p.waitForSelector("#seznam .zakazka-radek");

  // ---------- import dílů z e-mailu dodavatele ----------
  await p.click(".zakazka-radek >> text=7378");
  await p.waitForSelector("#import-dilu");
  await p.evaluate(() => { const d = document.getElementById("sekce-dily"); if (d) d.open = true; }); await p.click("#import-dilu");
  await p.fill("#imp-text", "LKQ CZ s.r.o., pobočka HRADECZ - faktura 4126028275\nNázev   ks      DPH     Kč/ks bez DPH   Kč s DPH\n1.              LO 00596 / Sada ložiska kola STARLINE   1       21%     319.00  385.99\n2.\tMH KC22 / Palivový filtr KNECHT\t3\t21%\t200.00\t726.00\nCelkem s DPH 1111.99 Kč");
  await p.click("#imp-rozpoznat");
  await p.waitForSelector(".import-tabulka");
  kontrola(await p.locator(".import-tabulka tbody tr").count() === 2 && await p.inputValue("#imp-dodavatel") === "d1", "import: z faktury Auto Kelly rozpoznány 2 díly, dodavatel Auto Kelly");
  await foto("19-import-dilu");
  await p.uncheck('tr[data-ip="1"] [data-if="vybrano"]');
  await p.click("#imp-pridat");
  await p.waitForSelector("#stav-dilu >> text=✓ Uloženo");
  const di = await p.evaluate(() => window.__ULOZENO__.tabulky.dily.filter(d => d.cislo_mb === "LO 00596"));
  kontrola(di.length === 1 && di[0].nakupni_cena === 385.99 && di[0].dodavatel_id === "d1" && di[0].puvod === "aftermarket" && di[0].stav === "objednano" && di[0].prodejni_cena === 502 && di[0].nazev === "Sada ložiska kola STARLINE",
    "import: přidán jen vybraný díl – nákup 385,99 s DPH, prodej 502 Kč, Auto Kelly, Aftermarket, objednáno");
  kontrola(await p.evaluate(() => !document.getElementById("sekce-dily").open) && /díl.* · .*Kč/.test(await p.textContent("#souhrn-dilu")), "po importu se sekce Díly sbalí (v nadpisu počet dílů a částka)");
  { const t = (await p.textContent("#souhrn")).replace(/[\u00a0\u202f]/g, " ");
    kontrola(/z toho marže/.test(t) && /z toho marže 30,1 %/.test(t) && /116 Kč/.test(t), "součet ukazuje celkovou marži na dílech (30,1 % vlevo, 116 Kč vpravo)"); }
  // PDF faktura Granexu (vyrobená pro test, stejné rozložení řádků)
  {
    const { PDFDocument } = require("pdf-lib"), fontkit = require("@pdf-lib/fontkit");
    const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
    const font = await doc.embedFont(fs.readFileSync("dokumenty/sablony/assets/fonts/LiberationSans-Regular.ttf"));
    const pg = doc.addPage([595, 842]); let y = 800;
    const radek = t => { pg.drawText(t, { x: 40, y, size: 8, font }); y -= 12; };
    ["Faktura – Daňový doklad 26569121", "Granex.cz", "Označení dodávky Počet M.J. Cena za M.J. DPH % bez DPH DPH Celkem s DPH",
     "Pouzdro, řadicí tyč FEBI BILSTEIN 08224 12 ks 23,14 Kč 21 % 277,69 Kč 58,31 Kč 336 Kč",
     "Montážní sada, řídicí mechanismus MEYLE 014", "033 0001", "2 ks 236,36 Kč 21 % 472,73 Kč 99,27 Kč 572 Kč",
     "DPD – Zásilková služba 1 ks 114,88 Kč 21 % 114,88 Kč 24,12 Kč 139 Kč", "Základ Výše DPH Celkem s DPH"].forEach(radek);
    fs.writeFileSync(path.join(OUT, "granex-test.pdf"), await doc.save());
  }
  await p.evaluate(() => { const d = document.getElementById("sekce-dily"); if (d) d.open = true; }); await p.click("#import-dilu");
  await p.setInputFiles("#imp-soubor", path.join(OUT, "granex-test.pdf"));
  await p.waitForSelector(".import-tabulka", { timeout: 15000 });
  const radkyPdf = await p.$$eval(".import-tabulka tbody tr", tr => tr.map(r => [...r.querySelectorAll("input.vstup")].map(i => i.value)));
  kontrola(radkyPdf.length === 2 && radkyPdf[1][0] === "Montážní sada, řídicí mechanismus MEYLE" && radkyPdf[1][1] === "014 033 0001" && radkyPdf[1][3] === "286" && await p.inputValue("#imp-dodavatel") === "d2",
    "import z PDF faktury Granexu: 2 díly, název přes 2 řádky, 286 Kč/ks, dodavatel Granex " + JSON.stringify(radkyPdf));
  await p.click("#imp-zavrit");
  // společná marže pro všechny díly
  kontrola(!(await p.isVisible("#marze-vse")) && await p.isVisible("#marze-sbal > summary"), "marže pro všechny díly je schovaná pod rozbalovací šipkou");
  await p.click("#marze-sbal > summary");
    kontrola(await p.inputValue("#marze-vse") === "30", "master marže ukazuje 30 % (marže dílů zakázky)");
  await p.fill("#marze-vse", "40 %"); await p.click("#marze-pouzit");                  // i se znakem procenta
  await p.waitForSelector("#stav-dilu >> text=✓ Uloženo");
  const dm = await p.evaluate(() => window.__ULOZENO__.tabulky.dily.find(d => d.cislo_mb === "LO 00596"));
  kontrola(dm.marze_pct === 40 && dm.prodejni_cena === 540 && await p.inputValue('.dil[data-i="0"] [data-f="marze_pct"]') === "40", "„Použít na všechny díly“: marže 40 % → prodej 540 Kč");
  await p.locator('.dil[data-i="0"] [data-f="marze_pct"]').fill("50");
  kontrola(await p.inputValue('.dil[data-i="0"] [data-f="prodejni_cena"]') === "579", "marže jednoho dílu jde dál změnit zvlášť (50 % → 579 Kč)");
  await foto("20-marze-vse");
  await p.locator('.dil[data-i="0"] [data-f="marze_pct"]').fill("abc");
  kontrola(await p.evaluate(() => document.querySelector('.dil[data-i="0"] [data-f="marze_pct"]').classList.contains("chybi")) && await p.inputValue('.dil[data-i="0"] [data-f="prodejni_cena"]') === "579", "nesmyslná marže zčervená a cena se nezmění");
  await p.locator('.dil[data-i="0"] [data-f="marze_pct"]').fill("50");
  // úpravy příjmu, stav zakázky, fotky během opravy
  await p.click("#upravit-prijem");
  await p.fill('[data-uf="km_prijem"]', "123750");
  await p.fill('[data-uf="odhad_ceny"]', "45000");
  await p.click('[data-up="zavady"]');
  await p.locator('[data-ur="zavady"]').last().fill("Replace front shock absorbers");
  await p.click('[data-useg="nadrz_prijem"] >> text=3/4');
  await p.click("#ulozit-prijem");
  await p.waitForSelector("#upravit-prijem");
  const zu = await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky.find(z => z.cislo === 7378));
  kontrola(zu.km_prijem === 123750 && zu.odhad_ceny === 45000 && zu.nadrz_prijem === "3/4" && zu.zavady.includes("Replace front shock absorbers") && zu.zavady.length === 2
    && /Replace front shock absorbers/.test(await p.textContent("#sekce-prijem-detail")), "úprava příjmu: km, odhad, nádrž a nová závada uloženy a zobrazeny");
  await p.selectOption("#stav-zakazky", "v_praci");
  await p.waitForFunction(() => window.__ULOZENO__.tabulky.zakazky.find(z => z.cislo === 7378).stav === "v_praci");
  kontrola(true, "stav zakázky jde ručně změnit (V práci)");
  await p.evaluate(() => { document.getElementById("sekce-fotky-detail").open = true; });
  await p.setInputFiles("#sekce-fotky-detail [data-nahrat] >> nth=2", ["testy/auto-1.jpg"]);
  await p.waitForSelector('#sekce-fotky-detail [data-faze="prubeh"] .fotka img', { timeout: 15000 });
  kontrola(await p.evaluate(() => window.__ULOZENO__.tabulky.soubory.some(f => f.faze === "prubeh" && f.druh === "foto")) && /Během opravy/.test(await p.textContent("#sekce-fotky-detail")),
    "fotka přidaná během opravy se uloží do skupiny „Během opravy“");
  await foto("21-uprava-prijmu-fotky");
  await p.click('#sekce-fotky-detail [data-profil]');
  await p.waitForFunction(() => window.__ULOZENO__.tabulky.soubory.some(f => f.druh === "foto" && f.faze === "profil"));
  await p.waitForSelector('#sekce-fotky-detail [data-faze="profil"] .fotka img', { timeout: 15000 });
  kontrola(/Profilové/.test(await p.textContent("#sekce-fotky-detail")) && await p.locator('#faze-fotek option[value="profil"]').count() === 1,
    "fotka jde označit ⭐ jako profilová (E-serviska nahoře) a jde rovnou nahrát jako profilová");
  await p.click('#sekce-fotky-detail [data-faze="profil"] [data-verejne]');
  await p.waitForSelector('#sekce-fotky-detail [data-faze="skryte"] .fotka img', { timeout: 15000 });
  kontrola(await p.locator('#sekce-fotky-detail [data-faze="profil"]').count() === 0 && /Neveřejné/.test(await p.textContent("#sekce-fotky-detail")), "skrytá fotka (🚫) se přesune do skupiny Neveřejné");
  await p.click('#sekce-fotky-detail [data-faze="skryte"] [data-verejne]');
  await p.waitForSelector('#sekce-fotky-detail [data-faze="profil"] .fotka img', { timeout: 15000 });
  kontrola(/mercedesrestorations\.cz\/e-serviska\?k=[0-9a-f]{20}$/.test(await p.getAttribute("#odkaz-eservisky", "href")), "detail zakázky má tajný odkaz do E-servisky (VIN sám nestačí)");
  await p.evaluate(() => { navigator.share = async d => { window.__SDILENO__ = d.url; }; });
  await p.click("#sdilet-eservisku");
  kontrola(await p.evaluate(() => window.__SDILENO__) === await p.getAttribute("#odkaz-eservisky", "href"), "ikona 🔗 vedle E-servisky pošle zákazníkovi tajný odkaz (Sdílet)");
  await p.check('#sekce-servis [data-servis="olej"]');
  await p.waitForSelector("#stav-servisu >> text=✓ Uloženo");
  await p.check('#sekce-servis [data-servis="brzdy"]');
  await p.waitForFunction(() => (window.__ULOZENO__.tabulky.zakazky.find(z => z.cislo === 7378).servisni_ukony || []).length === 2);
  kontrola(JSON.stringify(await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky.find(z => z.cislo === 7378).servisni_ukony)) === '["olej","brzdy"]', "servisní úkony se zaškrtnou a uloží k zakázce");
  kontrola(await p.evaluate(() => ["sekce-prace", "sekce-servis"].every(i => document.getElementById(i)?.open) && !["sekce-vozidlo", "sekce-archiv", "postup-prace", "sekce-poznamky"].some(i => document.getElementById(i)?.open)),
    "v zakázce jsou rozbalené jen Práce k fakturaci, Díly a Servisní úkony, ostatní sekce sbalené");
  kontrola(/z toho marže [\d,]+ %/.test(await p.textContent("#souhrn")) && /^Cena/.test(await p.textContent("#souhrn")), "souhrn má nadpis „Cena“ a procento marže je vlevo u popisu");
  kontrola(await p.evaluate(() => document.getElementById("souhrn").open && /Zisk/.test(document.getElementById("souhrn").textContent) && !!document.getElementById("souhrn-zisk")), "sekce Cena je sbalovací, výchozí rozbalená, a ukazuje Zisk");
  await p.click("#sekce-archiv > summary");
  // archiv (legacy): původní PDF jen jako příloha zakázky
  await p.setInputFiles("#archiv-nahrat", [{ name: "Zakazkovy_list_stary.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") }]);
  await p.waitForSelector("#sekce-archiv [data-archiv-otevrit]", { timeout: 15000 });
  const ar = await p.evaluate(() => window.__ULOZENO__.tabulky.soubory.filter(f => f.druh === "archiv"));
  kontrola(ar.length === 1 && /^archiv\/7378\/.+\.pdf$/.test(ar[0].klic) && ar[0].nazev === "Zakazkovy_list_stary.pdf" && !ar[0].doklad_id && /Zakazkovy_list_stary\.pdf/.test(await p.textContent("#sekce-archiv")),
    "archivní PDF se přiloží k zakázce (druh archiv, bez dokladu) a zobrazí v Ostatních dokumentech");
  await p.evaluate(() => { window.__MAILTO__ = u => { window.__MAIL__ = u; }; window.__MAIL__ = null; });
  await p.click("#sekce-archiv [data-archiv-podpis]");
  await p.waitForSelector("#sekce-archiv >> text=čeká na podpis zákazníka");
  { const m = decodeURIComponent(await p.evaluate(() => window.__MAIL__ || ""));
    kontrola(await p.evaluate(() => !!window.__ULOZENO__.tabulky.soubory.find(f => f.druh === "archiv").podpis_pozadan) && /^mailto:jan\.novak@example\.cz\?subject=/.test(m) && /e-serviska\?k=[0-9a-f]{20}/.test(m) && /(Děkujeme za důvěru|Thank you for your trust)/.test(m),
      "„Nechat podepsat“ označí PDF k podpisu a připraví zákazníkovi e-mail s odkazem do E-servisky"); }
  await p.click("#sekce-archiv [data-archiv-podpis-zrusit]");
  await p.waitForSelector("#sekce-archiv [data-archiv-podpis]");
  await p.click("#sekce-archiv [data-archiv-smazat]");
  await p.waitForSelector("#sekce-archiv >> text=Zatím žádné dokumenty");
  // Ostatní dokumenty: i fotka dokumentu (HEIC z iPhonu)
  await p.setInputFiles("#archiv-nahrat", [{ name: "Servisni_knizka.HEIC", mimeType: "", buffer: Buffer.from("heic") }]);
  await p.waitForSelector("#sekce-archiv .doklad >> text=Servisni_knizka.HEIC", { timeout: 15000 });
  { const h = await p.evaluate(() => window.__ULOZENO__.tabulky.soubory.find(f => f.nazev === "Servisni_knizka.HEIC"));
    kontrola(h && h.mime === "image/heic" && /\.heic$/.test(h.klic) && /🖼/.test(await p.textContent("#sekce-archiv")), "Ostatní dokumenty: jde nahrát i fotka dokumentu (HEIC) – uloží se jako obrázek"); }
  await p.click("#sekce-archiv [data-archiv-smazat]"); await p.waitForSelector("#sekce-archiv >> text=Zatím žádné dokumenty");
  // dlouhý název bez mezer (jako skutečné archivní PDF) – na iPhonu nesmí roztáhnout stránku
  await p.setInputFiles("#archiv-nahrat", [{ name: "Zakázkový_list_W126_300SE_Jan_Novák_Cenová_nabídka_materiál.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") }]);
  await p.waitForSelector("#sekce-archiv [data-archiv-otevrit]", { timeout: 15000 });
  kontrola(await p.evaluate(() => !window.__ULOZENO__.tabulky.soubory.some(f => f.druh === "archiv" && f.nazev === "Zakazkovy_list_stary.pdf") && (window.__SMAZANE_SOUBORY__ || []).some(t => (t.klice || []).some(k => k.startsWith("archiv/")))), "odebrané archivní PDF zmizí i z úložiště");
  {
    const h = await p.evaluate(() => location.hash);
    await p.click("#sekce-servis > summary");
    await p.evaluate(() => { location.hash = "#/zakazky"; }); await p.waitForTimeout(400);
    await p.evaluate(x => { location.hash = x; }, h); await p.waitForSelector("#sekce-archiv");
    kontrola(await p.evaluate(() => document.getElementById("sekce-archiv").open && !document.getElementById("sekce-servis").open && document.getElementById("sekce-prace").open),
      "aplikace si u zakázky pamatuje, které sekce byly sbalené a rozbalené");
    await p.click("#sekce-servis > summary");
  }
  // smazat všechny díly (s potvrzením)
  await p.click("#smazat-dily");
  await p.waitForSelector("#stav-dilu >> text=✓ Uloženo");
  kontrola(await p.locator(".dil[data-i]").count() === 0 && await p.evaluate(() => !window.__ULOZENO__.tabulky.dily.some(d => d.cislo_mb === "LO 00596")) && !(await p.isVisible("#smazat-dily")),
    "„Smazat všechny díly“ po potvrzení vymaže seznam dílů zakázky");

  // ---------- Lidé v dílně (majitel) ----------
  kontrola(await p.locator('.lista-vpravo a[href="#/lide"]').count() === 0, "Lidé už nejsou v horním menu");
  await p.click(".lista-vpravo .uzivatel-tl"); await p.waitForSelector('[data-zal="#/lide"]');
  await p.click('[data-zal="#/lide"]');
  await p.waitForSelector("#seznam-lidi >> text=Petr Mechanik");
  kontrola(true, "Lidé jsou podzáložka v Můj účet");
  await p.fill('#pridat [name="jmeno"]', "Jan Učeň"); await p.fill('#pridat [name="email"]', "ucen@example.cz"); await p.fill('#pridat [name="heslo"]', "docasne-heslo-123");
  await p.click('#pridat button[type="submit"]');
  await p.waitForSelector("#seznam-lidi >> text=Jan Učeň");
  kontrola(true, "majitel přidal nového člověka");
  await foto("09-lide");

  // ---------- mechanik bez uloženého podpisu ----------
  const mc = await b.newContext({ ...devices["iPad Pro 11"], locale: "cs-CZ", timezoneId: "Europe/Prague" });
  await mc.addInitScript({ content: `window.__TEST_UZIVATEL__ = "u2";` + fs.readFileSync("testy/mock-db.js", "utf8") });
  const m = await mc.newPage();
  m.on("pageerror", e => chyby.push("pageerror (mechanik): " + e.message));
  await m.goto(URL0 + "#/novy");
  await m.waitForSelector('[data-pole="zakaznik.jmeno"]');
  kontrola(await m.isDisabled("#k-podpisu"), "prázdný formulář: Náhled a podpis nejde stisknout");
  kontrola(/jméno zákazníka.*telefon nebo e-mail.*VIN.*model.*stav tachometru.*závada/.test(await m.textContent("#co-chybi")), "ukazuje, co chybí (jméno, kontakt, VIN, model, km, závada)");
  await m.fill('[data-pole="zakaznik.jmeno"]', "Eva Zkušební");
  await m.fill('[data-pole="zakaznik.email"]', "eva@example.cz");
  await m.fill('[data-pole="vozidlo.vin"]', "WDB1230931A000002");
  await m.fill('[data-pole="vozidlo.model"]', "300 TD");
  await m.fill('[data-pole="zakazka.km_prijem"]', "250000");
  await m.click('.cip[data-cip="zavady"] >> nth=0');
  kontrola(!(await m.isDisabled("#k-podpisu")), "po vyplnění povinných polí jde dál");
  await m.click("#k-podpisu");
  await m.waitForSelector("#muj-podpis-sekce:not([hidden])");
  kontrola(true, "mechanik bez podpisu: zobrazí se pole pro jeho podpis");
  for (const sel of ["#podpis", "#muj-podpis"]) {
    await m.locator(sel).scrollIntoViewIfNeeded(); const bb = await m.locator(sel).boundingBox();
    await m.mouse.move(bb.x + 50, bb.y + 120); await m.mouse.down();
    for (let i = 0; i <= 40; i++) await m.mouse.move(bb.x + 50 + i * 7, bb.y + 110 - Math.sin(i / 3) * 30);
    await m.mouse.up(); await m.waitForTimeout(250);
    if (sel === "#podpis") kontrola(await m.isDisabled("#ulozit"), "jen s podpisem zákazníka ještě nejde uložit");
  }
  kontrola(!(await m.isDisabled("#ulozit")), "s oběma podpisy jde uložit");
  await m.evaluate(() => { const b = document.querySelector("#ulozit"); b.click(); b.click(); });   // dvojí klepnutí
  await m.waitForSelector("text=Zakázkový list uložen");
  const um = await m.evaluate(() => ({ lide: window.__ULOZENO__.lide, podpisy: window.__ULOZENO__.tabulky.podpisy, pdf: Object.entries(window.__ULOZENO__.soubory).filter(([k]) => k.endsWith(".pdf")).map(([, v]) => Array.from(v)) }));
  kontrola(/^data:image\/png/.test(um.lide.find(u => u.id === "u2").podpis_obrazek), "podpis mechanika uložen do jeho profilu");
  kontrola(await m.evaluate(() => window.__ULOZENO__.tabulky.zakazky.length) === 1, "dvojí klepnutí na Podepsat a uložit založí jen jednu zakázku");
  kontrola(um.podpisy.some(x => x.role === "vyhotovil" && x.jmeno === "Petr Mechanik" && x.uzivatel_id === "u2" && x.zpusob === "ipad"), "podpis Vyhotovil = Petr Mechanik");
  fs.writeFileSync(path.join(OUT, "mechanik.pdf"), Buffer.from(um.pdf[0]));
  const txt = require("child_process").execFileSync("pdftotext", ["-l", "1", path.join(OUT, "mechanik.pdf"), "-"]).toString();
  kontrola(/Petr Mechanik/.test(txt) && !/Václav Macháň\s*\n.*Eva/.test(txt), "na zakázkovém listu je Vyhotovil: Petr Mechanik");
  await m.evaluate(() => { location.hash = "#/ucet"; });
  await m.waitForSelector('#podpis-nahled img');
  kontrola(true, "Můj účet ukazuje uložený podpis");
  kontrola(await m.isVisible("#odhlasit") && await m.locator('[data-zal="#/lide"]').count() === 0, "mechanik: Odhlásit v Můj účet, bez záložky Lidé");
  {
    const mz = await m.evaluate(() => window.__ULOZENO__.tabulky.zakazky[0].id);
    await m.evaluate(id => { location.hash = "#/zakazka/" + id; }, mz); await m.waitForSelector("#sekce-fotky-detail");
    kontrola(await m.locator('a[href$="/faktura"]').count() === 0 && await m.locator('a[href$="/zaloha"]').count() === 0 && await m.locator("#marze-sbal").count() === 0 && await m.locator('[data-f="marze_pct"]').count() === 0 && await m.isVisible('a[href$="/nabidka"]'),
      "mechanik: nevidí Fakturu, Zálohovou fakturu ani marže; nabídku vystavit může");
    await m.evaluate(id => { location.hash = `#/zakazka/${id}/faktura`; }, mz); await m.waitForSelector("text=vystavuje majitel");
    kontrola(true, "mechanik: fakturu přímým odkazem nevystaví");
  }
  await m.screenshot({ path: path.join(OUT, "10-muj-ucet.png"), fullPage: true });

  // ---------- uložit zákazníka a vozidlo samostatně (bez příjmu), TP ----------
  await p.evaluate(() => { location.hash = "#/novy"; });
  await p.waitForSelector("#ulozit-zakaznika");
  await p.fill('[data-pole="zakaznik.jmeno"]', "Karel Samostatný");
  await p.fill('[data-pole="zakaznik.telefon"]', "+420 777 000 111");
  await p.click("#ulozit-zakaznika");
  await p.waitForSelector("text=Stávající zákazník");
  kontrola(await p.evaluate(() => window.__ULOZENO__.tabulky.zakaznici.some(z => z.jmeno === "Karel Samostatný")), "tlačítko Uložit zákazníka uloží zákazníka bez zakázky");
  await p.fill('[data-pole="vozidlo.vin"]', "WDB1070481A000003");
  await p.fill('[data-pole="vozidlo.model"]', "560 SL");
  await p.click('[data-segment="zakazka.tp_prilozen"] >> text=Ne');
  kontrola(await p.locator(".tp-strany").count() === 0, "TP přiložen: Ne → pole pro TP se skryjí");
  await p.click('[data-segment="zakazka.tp_prilozen"] >> text=Ano');
  await p.waitForSelector('[data-tp-vstup="predni"]', { state: "attached" });
  await p.setInputFiles('[data-tp-vstup="predni"]', "testy/auto-1.jpg");
  await p.setInputFiles('[data-tp-vstup="zadni"]', path.join(OUT, "7377-1.pdf"));
  await p.waitForFunction(() => document.querySelectorAll(".tp-strana.nahrano").length === 2);
  kontrola(await p.locator(".tp-strana.nahrano >> text=✓ Nahráno").count() === 2, "TP přední (fotka) i zadní (PDF) nahrány s fajfkou");
  await p.click("#ulozit-vozidlo");
  await p.waitForFunction(() => window.__ULOZENO__.tabulky.soubory.filter(s => s.druh === "tp").length === 2);
  const uv = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; const v = T.vozidla.find(x => x.vin === "WDB1070481A000003"); const k = T.zakaznici.find(z => z.jmeno === "Karel Samostatný");
    return { v: !!v, typ: v?.typ, vl: T.vlastnictvi.some(x => x.vozidlo_id === v?.id && x.zakaznik_id === k?.id), tp: T.soubory.filter(s => s.druh === "tp" && s.vozidlo_id === v?.id && s.verejne).length, zak: T.zakazky.length }; });
  kontrola(uv.v && uv.typ === "107" && uv.vl && uv.tp === 2 && uv.zak === 2, "Uložit vozidlo: auto 107 560 SL uloženo, přiřazeno Karlovi, 2 strany TP (veřejné do E-servisky), žádná nová zakázka");
  await foto("15-ulozit-zakaznika-vozidlo");
  await p.click("#zahodit");
  await p.waitForSelector(".zakazka-radek");

  // ---------- zákazníci a vozidla: seznamy a úpravy ----------
  await p.click(".lista-vpravo >> text=Zákazníci");
  await p.waitForSelector("#seznam >> text=Karel Samostatný");
  kontrola(await p.locator("#seznam .doklad").count() === 2, "seznam zákazníků: Jan Novák a Karel Samostatný");
  await p.fill("#filtr", "karel"); kontrola(await p.locator("#seznam .doklad").count() === 1, "hledání v zákaznících");
  await p.click("#seznam >> text=Karel Samostatný");
  await p.waitForSelector('#f [name="telefon"]');
  await p.fill('#f [name="telefon"]', "+420 777 999 888"); await p.fill('#f [name="mesto"]', "Hradec Králové");
  await p.click('#f button[type="submit"]'); await p.waitForSelector("#stav >> text=✓ Uloženo");
  kontrola(await p.evaluate(() => window.__ULOZENO__.tabulky.zakaznici.find(z => z.jmeno === "Karel Samostatný").telefon === "+420 777 999 888"), "úprava zákazníka se uloží");
  await p.click(".lista-vpravo >> text=Zákazníci");
  await p.waitForSelector('#seznam a[href="tel:+420777999888"]');
  kontrola(await p.locator('#seznam a[href^="mailto:"]').count() >= 1, "seznam zákazníků: telefon je odkaz tel: a e-mail mailto:");
  await foto("16-zakaznici-kontakty");
  await p.click("#seznam >> text=Karel Samostatný");
  await p.waitForSelector('#f [name="telefon"]');
  kontrola(await p.isVisible("text=560 SL"), "karta zákazníka ukazuje jeho auto");
  await foto("16-zakaznik");
  await p.click(".lista-vpravo >> text=Vozidla");
  await p.waitForSelector("#seznam >> text=560 SL");
  await p.click("#seznam >> text=560 SL");
  await p.waitForSelector("#dokumenty-vozidla .dokument");
  kontrola(await p.locator("#dokumenty-vozidla .dokument").count() === 2, "karta vozidla ukazuje 2 strany TP");
  await p.fill('#f [name="spz"]', "5H4 1234"); await p.click('#f button[type="submit"]'); await p.waitForSelector("#stav >> text=✓ Uloženo");
  await p.fill("#hledat-majitele", "nov"); await p.waitForSelector("#vysledky-majitel >> text=Jan Novák");
  await p.click("#vysledky-majitel >> text=Jan Novák");
  await p.waitForSelector("text=současný");
  await p.waitForFunction(() => { const T = window.__ULOZENO__.tabulky; const v = T.vozidla.find(x => x.vin === "WDB1070481A000003"); return T.vlastnictvi.filter(x => x.vozidlo_id === v.id).length === 2; }, null, { timeout: 5000 });
  const vl = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; const v = T.vozidla.find(x => x.vin === "WDB1070481A000003");
    return T.vlastnictvi.filter(x => x.vozidlo_id === v.id).map(x => [T.zakaznici.find(c => c.id === x.zakaznik_id).jmeno, !!x.vlastni_do]); });
  kontrola(vl.length === 2 && vl.some(([j, konec]) => j === "Karel Samostatný" && konec) && vl.some(([j, konec]) => j === "Jan Novák" && !konec) , "změna majitele: Karel ukončen, Jan Novák současný; SPZ uložena");
  await foto("17-vozidlo");

  // ---------- mazání ----------
  await p.click("#smazat");
  await p.waitForSelector("#seznam");
  kontrola(await p.evaluate(() => !window.__ULOZENO__.tabulky.vozidla.some(v => v.vin === "WDB1070481A000003")), "vozidlo bez zakázek smazáno (i s TP)");
  await p.click(".lista-vpravo >> text=Zákazníci"); await p.waitForSelector("#seznam >> text=Karel Samostatný");
  await p.click("#seznam >> text=Karel Samostatný"); await p.waitForSelector("#smazat");
  await p.click("#smazat"); await p.waitForSelector("#seznam");
  kontrola(await p.evaluate(() => !window.__ULOZENO__.tabulky.zakaznici.some(z => z.jmeno === "Karel Samostatný")), "zákazník bez zakázek smazán");
  await p.click("#seznam >> text=Jan Novák"); await p.waitForSelector("#smazat"); await p.click("#smazat");
  await p.waitForSelector("#hlaska >> text=nejdřív je smažte");
  kontrola(true, "zákazníka se zakázkami smazat nejde (upozornění)");
  const id7378 = await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky.find(z => z.cislo === 7378).id);
  await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, id7378); await p.waitForSelector("#smazat-zakazku");
  odpovedPrompt = "7378"; await p.click("#smazat-zakazku"); await p.waitForSelector(".zakazka-radek");
  const po = await p.evaluate(() => ({ n: window.__ULOZENO__.tabulky.zakazky.length, c: window.__ULOZENO__.citac }));
  kontrola(po.n === 1 && po.c === 7377, "zakázka #7378 smazána (potvrzení číslem) a číslo 7378 je zase volné");
  const id7377 = await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky[0].id);
  await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, id7377); await p.waitForSelector("#zrusit-zakazku");
  kontrola(await p.locator("#smazat-zakazku").count() === 0, "zakázka s fakturou nejde smazat, jen zrušit");
  await p.click("#zrusit-zakazku"); await p.waitForFunction(() => document.querySelector("#stav-zakazky")?.value === "zruseno");
  kontrola(true, "zakázka s fakturou označena jako zrušená");
  odpovedPrompt = "2026-11-05";

  // ---------- F5: poznámky k zakázce a k autu (sbalené, ukládají se samy) ----------
  {
    const zid = await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky[0].id);
    await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, zid); await p.waitForSelector("details.poznamky");
    kontrola(!(await p.isVisible('textarea[data-poznamka="zakazky"]')), "poznámky jsou sbalené (nezabírají místo)");
    await p.click("details.poznamky > summary");
    await p.fill('textarea[data-poznamka="vozidla"]', "Pozor: zadní levé kolo – zrezlý šroub");
    await p.waitForSelector("[data-stav-poznamek] >> text=✓ Uloženo");
    kontrola(await p.evaluate(() => window.__ULOZENO__.tabulky.vozidla.some(v => v.poznamky === "Pozor: zadní levé kolo – zrezlý šroub")), "poznámka k autu se uloží k autu");
  }

  // ---------- Práce: odrážky z inspekce, odklikávání a lišta s procenty ----------
  {
    const zid = await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky[0].id);
    await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, zid); await p.waitForSelector("details.postup-prace");
    if (!(await p.isVisible('textarea[data-ukol="0"]'))) await p.click("details.postup-prace > summary");
    const zav = await p.locator("[data-ukol-zavady]").count();
    kontrola(zav === 1, "Práce: jde převzít závady ze zakázkového listu");
    await p.fill('textarea[data-ukol="0"]', "Vyměnit přední brzdové destičky");
    await p.press('textarea[data-ukol="0"]', "Enter");
    await p.keyboard.type("Seřídit ventily");
    await p.press('textarea[data-ukol="1"]', "Enter");
    await p.keyboard.type("Nový olej");
    await p.press('textarea[data-ukol="2"]', "Enter");
    await p.keyboard.type("Zkušební jízda");
    kontrola(await p.locator(".ukol").count() === 4, "Práce: Enter založí další odrážku (jako v Poznámkách)");
    await p.check('[data-ukol-h="0"]');
    await p.waitForSelector("[data-stav-ukolu] >> text=✓ Uloženo");
    const u = await p.evaluate(id => window.__ULOZENO__.tabulky.zakazky.find(z => z.id === id).ukoly, zid);
    kontrola(u.length === 4 && u[0].h && !u[1].h && u[3].t === "Zkušební jízda", "Práce: odrážky i odškrtnutí se uloží");
    kontrola((await p.textContent("#ukoly .postup b")).trim() === "25 %", "Práce: lišta ukazuje 25 % (1 ze 4)");
    await p.check('[data-ukol-h="1"]');
    kontrola((await p.textContent("#ukoly .postup b")).trim() === "50 %", "Práce: po odkliknutí další odrážky 50 %");
    await p.press('textarea[data-ukol="3"]', "End"); for (let i = 0; i < 14; i++) await p.press('textarea[data-ukol="3"]', "Backspace");
    await p.press('textarea[data-ukol="3"]', "Backspace");
    kontrola(await p.locator(".ukol").count() === 3 && (await p.textContent("#ukoly .postup b")).trim() === "67 %", "Práce: Backspace na prázdném řádku ho smaže (2 ze 3 = 67 %)");
    await p.screenshot({ path: "testy/vystup-app/prace-postup.png", fullPage: false });
  }

  // ---------- Dopodepsání zakázkového listu z E-servisky ----------
  {
    const zid = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; const d = T.doklady.find(x => x.druh === "zakazkovy_list"); d.data = { ...d.data, cekaPodpis: true }; return d.zakazka_id; });
    await p.evaluate(id => { location.hash = "#/zakazky"; location.hash = "#/zakazka/" + id; }, zid);
    await p.waitForSelector("#odkaz-k-podpisu");
    kontrola(true, "zakázka ukazuje, že list čeká na podpis zákazníka (+ odkaz k podpisu)");
    await p.evaluate(async () => {        // zákazník podepsal v E-servisce (to dělá serverová funkce)
      const T = window.__ULOZENO__.tabulky, d = T.doklady.find(x => x.druh === "zakazkovy_list");
      const c = document.createElement("canvas"); c.width = 200; c.height = 60; const x = c.getContext("2d"); x.strokeStyle = "#1372e8"; x.lineWidth = 3; x.beginPath(); x.moveTo(10, 40); x.bezierCurveTo(60, 0, 120, 70, 190, 20); x.stroke();
      const b = await new Promise(r => c.toBlob(r, "image/png")), klic = "zakazky/eserviska/podpis.png";
      window.__ULOZENO__.soubory[klic] = new Uint8Array(await b.arrayBuffer());
      T.soubory.push({ id: "sf-dalkovy", zakazka_id: d.zakazka_id, druh: "podpis", klic, mime: "image/png", verejne: false });
      T.dalkove_podpisy.push({ id: "dp1", doklad_id: d.id, soubor_id: "sf-dalkovy", podepsano: new Date().toISOString(), vystaveny_doklad_id: null });
    });
    await p.evaluate(id => { location.hash = "#/zakazky"; location.hash = "#/zakazka/" + id; }, zid);
    await p.waitForSelector("#vystavit-podepsany"); await p.click("#vystavit-podepsany");
    await p.waitForSelector("#hlaska >> text=Podepsaný zakázkový list");
    const r = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky, d = T.doklady.find(x => x.cislo === "7377-1-2"); return d && { verze: d.verze, pod: d.data.podepsanoDalkove, ceka: d.data.cekaPodpis, zp: T.podpisy.filter(x => x.doklad_id === d.id).map(x => x.role + ":" + x.zpusob).join(","), dp: T.dalkove_podpisy[0].vystaveny_doklad_id === d.id }; });
    kontrola(r && r.verze === 2 && /Podepsáno online v E-servisce/.test(r.pod) && !r.ceka && /zakaznik:dalkove/.test(r.zp) && r.dp, "z podpisu v E-servisce se vystaví podepsaný list 7377-1-2 (podpis zákazníka + poznámka o el. podpisu)");
    kontrola(await p.locator("#vystavit-podepsany, #odkaz-k-podpisu").count() === 0, "po vystavení už zakázka na podpis nečeká");
    { const b = await p.evaluate(() => Array.from(Object.entries(window.__ULOZENO__.soubory).find(([k]) => /7377-1-2-zakazkovy-list\.pdf$/.test(k))?.[1] || [])); if (b.length) require("fs").writeFileSync("testy/vystup-app/podepsany-list.pdf", Buffer.from(b)); }
  }

  // ---------- Díly: statistika ze zakázek ----------
  {
    const d0 = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; const d = T.dily.find(x => x.stav !== "nepouzito" && x.nazev); return d && { nazev: d.nazev, n: T.dily.filter(x => x.nazev === d.nazev && x.stav !== "nepouzito").length }; });
    await p.evaluate(() => { location.hash = "#/dily"; }); await p.waitForSelector(".dil-stat, .prazdne");
    kontrola(await p.locator(`.dil-stat >> text=${d0.nazev}`).count() >= 1, "Díly: díl ze zakázky je v přehledu dílů");
    const txt = await p.textContent(".dil-stat");
    kontrola(/W126 300 SE \(1989\)/.test(txt) && /M103/.test(txt), "Díly: u dílu je vidět, na jaké auto (W126 300 SE 1989, motor M103)");
    await p.click(".dil-stat .dil-hlava"); await p.waitForSelector(".dil-pouziti a");
    kontrola(/#7377/.test(await p.textContent(".dil-pouziti")), "Díly: rozkliknutí ukáže zakázky, kde byl díl použit");
    await p.screenshot({ path: "testy/vystup-app/dily.png", fullPage: false });
    await p.fill("#filtr-dilu", "zzzz-nic"); await p.waitForSelector("text=Nic nenalezeno.");
    kontrola(true, "Díly: hledání");
  }

  // ---------- výchozí řazení zakázek podle stavu; smazání řádku práce se potvrzuje ----------
  {
    await p.evaluate(() => { localStorage.setItem("werk-filtr-zakazek", JSON.stringify({ stav: "", typ: "", razeni: "cislo-" })); location.hash = "#/"; location.hash = "#/zakazky"; });
    await p.waitForSelector("#seznam .zakazka-radek, #seznam .prazdne");
    kontrola(await p.inputValue("#f-razeni") === "stav", "zakázky jsou ve výchozím stavu řazené „Podle stavu“ (rozpracované nahoře)");
    const zid = await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky.find(z => window.__ULOZENO__.tabulky.polozky.some(x => x.zakazka_id === z.id)).id);
    await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, zid); await p.waitForSelector('[data-smaz="0"]');
    const n0 = await p.locator(".radek-pol[data-i]").count();
    odmitnoutDialog = true; await p.click('[data-smaz="0"]'); await p.waitForTimeout(200); odmitnoutDialog = false;
    kontrola(await p.locator(".radek-pol[data-i]").count() === n0, "smazání řádku práce se nejdřív zeptá (Zrušit = nic se nesmaže)");
  }

  // ---------- daň zapnutá → nabídka má práci i díly s daní (bez řádku „daň“) ----------
  {
    const zid = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; const z = T.zakazky.find(x => T.polozky.some(y => y.zakazka_id === x.id && Number(y.sazba) > 0)); z.dan_zapnuto = true; z.dan_pct = 50; return z.id; });
    const sazba = await p.evaluate(id => Number(window.__ULOZENO__.tabulky.polozky.find(y => y.zakazka_id === id && Number(y.sazba) > 0).sazba), zid);
    await p.evaluate(id => { location.hash = "#/zakazka/" + id + "/nabidka"; }, zid);
    await p.waitForFunction(() => document.querySelector("#nahled")?.contentDocument?.body?.innerText?.length > 200, null, { timeout: 15000 });
    const txt = (await p.evaluate(() => document.querySelector("#nahled").contentDocument.body.innerText)).replace(/[\u00a0\u202f\s]/g, "");
    const cil = Math.round(sazba * 1.5).toLocaleString("cs-CZ").replace(/[\u00a0\u202f\s]/g, "");
    kontrola(txt.includes(cil) && !/daň/i.test(txt), `daň zapnutá: na nabídce je sazba práce ${cil} Kč (${sazba} × 1,5) a žádný řádek „daň“`);
    await p.evaluate(id => { window.__ULOZENO__.tabulky.zakazky.find(z => z.id === id).dan_zapnuto = false; location.hash = "#/zakazky"; }, zid);
  }

  // ---------- Kalendář v Přehledu ----------
  {
    await p.evaluate(() => { location.hash = "#/"; }); await p.waitForSelector("#kalendar .kal-den");
    kontrola(await p.locator("#kalendar .kal-den.dnes .kal-prijem").count() === 0, "kalendář: zrušená zakázka se v kalendáři neukazuje");
    await p.evaluate(() => { const z = window.__ULOZENO__.tabulky.zakazky[0]; z.stav = "v_praci"; z.predpoklad_dokonceni = z.datum_prijmu; location.hash = "#/zakazky"; });
    await p.evaluate(() => { location.hash = "#/"; }); await p.waitForSelector("#kalendar .kal-den.dnes .kal-prijem");
    kontrola(await p.locator("#kalendar .kal-den.dnes .kal-termin").count() === 1 && await p.locator(".kal-udalost >> text=Příjem #").count() === 1, "kalendář: příjem a termín dokončení zakázky jsou v kalendáři");
    await p.evaluate(() => { window.__ULOZENO__.tabulky.zakazky[0].stav = "zruseno"; });
    await p.fill("#kal-novy input[name=text]", "Přivezou 280 SL na prohlídku"); await p.fill("#kal-novy input[name=cas]", "09:30");
    await p.click("#kal-novy button"); await p.waitForSelector(".kal-udalost >> text=Přivezou 280 SL");
    kontrola(await p.evaluate(() => window.__ULOZENO__.tabulky.kalendar.some(k => k.text === "Přivezou 280 SL na prohlídku" && k.cas === "09:30")), "kalendář: vlastní termín s časem se uloží");
    await p.click("#kalendar [data-kal='1']"); await p.waitForSelector("#kalendar [data-kal='0']");
    kontrola(true, "kalendář: jde listovat po měsících");
    await p.click("#kalendar [data-kal='0']"); await p.waitForSelector(".kal-udalost >> text=Přivezou 280 SL");
    await p.screenshot({ path: "testy/vystup-app/kalendar.png", fullPage: true });
    await p.click("[data-kal-smazat]"); await p.waitForFunction(() => !window.__ULOZENO__.tabulky.kalendar.length);
    kontrola(true, "kalendář: vlastní termín jde smazat");
  }

  // ---------- Fotky zákazníkovi: výběr a odeslání přes Sdílet (WhatsApp) ----------
  {
    const zf = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; const f = T.soubory.find(x => x.druh === "foto" && x.zakazka_id && !x.smazano); return f && f.zakazka_id; });
    await p.evaluate(id => { window.__SDILENO__ = null; navigator.canShare = d => !!(d && d.files && d.files.length); navigator.share = async d => { window.__SDILENO__ = { n: d.files.length, typ: d.files[0].type, nazev: d.files[0].name, text: d.text }; }; location.hash = "#/zakazka/" + id; }, zf);
    await p.waitForSelector("#poslat-fotky");
    kontrola(await p.evaluate(() => document.querySelector('a[href$="/zaloha"]')?.classList.contains("tl-hlavni")), "tlačítko Zálohová faktura je modré jako Nabídka a Faktura");
    // skrytá fotka (🚫) se při „Vybrat vše“ nevybere
    const skryta = await p.evaluate(id => { const f = window.__ULOZENO__.tabulky.soubory.filter(x => x.zakazka_id === id && (x.druh === "foto" || x.druh === "video") && !x.smazano); f[0].verejne = false; return { n: f.length, id: f[0].id }; }, zf);
    await p.evaluate(id => { location.hash = "#/zakazky"; location.hash = "#/zakazka/" + id; }, zf); await p.waitForSelector("#poslat-fotky");
    await p.click("#poslat-fotky"); await p.waitForSelector(".fotka[data-vybrat]");
    await p.click("#vybrat-vse"); await p.waitForSelector(".fotka.vybrana");
    kontrola((await p.textContent("#pocet-vybranych")).trim() === String(skryta.n - 1) && !(await p.evaluate(id => document.querySelector(`.fotka[data-vybrat="${id}"]`).classList.contains("vybrana"), skryta.id)), "„Vybrat vše“ nevybere fotku skrytou v E-servisce (🚫)");
    await p.evaluate(id => { window.__ULOZENO__.tabulky.soubory.find(x => x.id === id).verejne = true; }, skryta.id);
    await p.evaluate(id => { location.hash = "#/zakazky"; location.hash = "#/zakazka/" + id; }, zf); await p.waitForSelector("#poslat-fotky");
    await p.click("#poslat-fotky");
    await p.waitForSelector(".fotka[data-vybrat]");
    kontrola(await p.isDisabled("#odeslat-fotky"), "bez vybrané fotky nejde nic poslat");
    await p.click(".fotka[data-vybrat] >> nth=0");
    kontrola((await p.textContent("#pocet-vybranych")).trim() === "1", "klepnutím se fotka vybere (1)");
    await p.click("#odeslat-fotky");
    await p.waitForFunction(() => window.__SDILENO__);
    const sd = await p.evaluate(() => window.__SDILENO__);
    kontrola(sd.n === 1 && /^image\//.test(sd.typ) && /E-servisní knížce: http/.test(sd.text), "vybraná fotka jde do nabídky Sdílet (WhatsApp) i s odkazem na E-servisku");
    await p.waitForFunction(() => !document.querySelector(".fotka[data-vybrat]"));
  }

  // ---------- E2 + D1: fotku jde skrýt v E-servisce; smazaná fotka zmizí i z úložiště ----------
  {
    const zf = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; const f = T.soubory.find(x => x.druh === "foto" && x.zakazka_id && !x.smazano); return f && { z: f.zakazka_id, id: f.id, klic: f.klic }; });
    await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, zf.z); await p.waitForSelector(`[data-verejne="${zf.id}"]`);
    await p.click(`[data-verejne="${zf.id}"]`); await p.waitForSelector(`.fotka.skryto [data-verejne="${zf.id}"]`);
    kontrola(await p.evaluate(id => window.__ULOZENO__.tabulky.soubory.find(x => x.id === id).verejne === false, zf.id), "fotku jde jedním klepnutím skrýt v E-servisce (🚫)");
    await p.click(`[data-verejne="${zf.id}"]`); await p.waitForSelector(`.fotka:not(.skryto) [data-verejne="${zf.id}"]`);
    await p.click(`[data-smazat-fotku="${zf.id}"]`); await p.waitForSelector("#hlaska >> text=Smazáno");
    kontrola(await p.evaluate(id => !window.__ULOZENO__.tabulky.soubory.some(x => x.id === id), zf.id) && await p.evaluate(k => (window.__SMAZANE_SOUBORY__ || []).some(t => (t.klice || []).includes(k)), zf.klic), "smazaná fotka zmizí ze zakázky i z úložiště");
  }

  // ---------- C1/D3: přijel nový majitel známého auta → aplikace se zeptá „Auto změnilo majitele?“ ----------
  {
    await p.evaluate(() => { location.hash = "#/novy"; }); await p.waitForSelector('[data-pole="zakaznik.jmeno"]');
    await p.fill('[data-pole="zakaznik.jmeno"]', "Petr Nový");
    await p.fill('[data-pole="vozidlo.vin"]', "WDB1260241A000001");
    await p.waitForSelector("#zmena-majitele >> text=Auto změnilo majitele?");
    kontrola(/Jan Novák/.test(await p.textContent("#zmena-majitele")) && /změnilo auto majitele/.test(await p.textContent("#co-chybi")), "známé auto, jiný zákazník: otázka „Auto změnilo majitele?“ a bez odpovědi nejde dál");
    await p.click('#zmena-majitele [data-zmena="1"]');
    kontrola(await p.evaluate(() => JSON.parse(localStorage.getItem("werk-koncept-prijmu")).zmenaMajitele === true) && !/změnilo auto majitele/.test(await p.textContent("#co-chybi")), "„Ano – nový majitel“ se zapamatuje");
    await p.evaluate(() => localStorage.removeItem("werk-koncept-prijmu"));
  }

  // ---------- nová verze aplikace: uprostřed práce jen lišta, obnoví se až v klidu ----------
  {
    const zid = await p.evaluate(() => window.__ULOZENO__.tabulky.zakazky[0].id);
    await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, zid); await p.waitForSelector("#sekce-fotky-detail");
    await p.evaluate(() => { window.__OBNOVENO__ = 0; window.__OBNOVIT__ = () => { window.__OBNOVENO__++; }; window.__TEST_NOVA_VERZE__(); });
    kontrola(await p.isVisible("#nova-verze >> text=Je k dispozici nová verze") && await p.evaluate(() => window.__OBNOVENO__) === 0, "nová verze uprostřed práce: jen lišta „Obnovit“, stránka se sama neobnoví");
    await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(500);
    kontrola(await p.evaluate(() => window.__OBNOVENO__) === 1, "po návratu na Přehled se nová verze načte sama");
    await p.evaluate(() => document.getElementById("nova-verze")?.remove());
  }

  // ---------- nabídka nad 13 řádků nejde vystavit (jinak by PDF řádky i částku ořízlo) ----------
  {
    const zid = await p.evaluate(() => { const T = window.__ULOZENO__.tabulky; const z = T.zakazky.find(x => x.stav !== "zruseno") || T.zakazky[0];
      window.__ZALOHA_POL__ = T.polozky; T.polozky = T.polozky.filter(x => x.zakazka_id !== z.id).concat(Array.from({ length: 14 }, (_, i) => ({ zakazka_id: z.id, poradi: i + 1, typ: "prace", popis: "Práce " + (i + 1), mnozstvi: 1, jednotka: "h", sazba: 1500, castka: 1500 }))); return z.id; });
    await p.evaluate(id => { location.hash = `#/zakazka/${id}/nabidka`; }, zid);
    await p.waitForSelector("#vystavit"); await p.waitForTimeout(1200);
    kontrola(await p.isDisabled("#vystavit") && /méně řádků/.test(await p.textContent("#co-chybi")), "nabídka se 14 řádky nejde vystavit (max. 13)");
    await p.evaluate(() => { window.__ULOZENO__.tabulky.polozky = window.__ZALOHA_POL__; });
  }

  // ---------- iPhone: žádná stránka se nesmí posouvat do stran ----------
  {
    const st = await p.evaluate(() => ({ z: window.__ULOZENO__.tabulky.zakazky.map(x => x.id), c: window.__ULOZENO__.tabulky.zakaznici.map(x => x.id), v: window.__ULOZENO__.tabulky.vozidla.map(x => x.id) }));
    await p.setViewportSize({ width: 390, height: 844 });
    const trasy = ["#/", "#/zakazky", "#/doklady", "#/zakaznici", "#/vozidla", "#/ucet", "#/lide", "#/zakaznik/novy",
      ...st.z.flatMap(id => [`#/zakazka/${id}`, `#/zakazka/${id}/nabidka`, `#/zakazka/${id}/faktura`, `#/zakazka/${id}/protokol`, `#/zakazka/${id}/zaloha`, `#/zakazka/${id}/opravny`]),
      ...st.c.map(id => `#/zakaznik/${id}`), ...st.v.map(id => `#/vozidlo/${id}`)];
    const spatne = [];
    for (const h of trasy) {
      await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(900);
      const r = await p.evaluate(() => {
        const W = window.innerWidth; if (document.documentElement.scrollWidth <= W + 1) return null;
        const pres = [...document.querySelectorAll("body *")].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > W + 1 && getComputedStyle(e).position !== "fixed"; })
          .filter(e => ![...e.children].some(ch => ch.getBoundingClientRect().right > W + 1))
          .slice(0, 6).map(e => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${String(e.className).split(" ").join(".")} → ${Math.round(e.getBoundingClientRect().right)}px`);
        return { sw: document.documentElement.scrollWidth, pres };
      });
      if (r) spatne.push(h.replace(/[0-9a-f-]{36}/, "ID") + ` (${r.sw}px): ` + r.pres.join(" | "));
    }
    if (spatne.length) console.log("PRETEKA:\n" + [...new Set(spatne)].join("\n"));
    kontrola(!spatne.length, "iPhone: žádná stránka se neposouvá do stran (" + trasy.length + " stránek)");
    await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, st.z[0]); await p.waitForSelector("#stav-zakazky");
    const male = await p.evaluate(() => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=file]):not([hidden]), select, textarea")]
      .filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => (e.id || e.name || e.dataset.f || e.className) + " " + getComputedStyle(e).fontSize));
    if (male.length) console.log("MALE PISMO:", male.join(", "));
    kontrola(!male.length, "iPhone: v detailu zakázky žádné pole pod 16 px (iPhone by přibližoval)");
    await p.setViewportSize({ width: 834, height: 1194 });
  }

  // ---------- iPhone: žádná stránka se nesmí posouvat do stran ----------
  {
    const st = await p.evaluate(() => ({ z: window.__ULOZENO__.tabulky.zakazky.map(x => x.id), c: window.__ULOZENO__.tabulky.zakaznici.map(x => x.id), v: window.__ULOZENO__.tabulky.vozidla.map(x => x.id) }));
    await p.setViewportSize({ width: 390, height: 844 });
    const trasy = ["#/", "#/zakazky", "#/doklady", "#/zakaznici", "#/vozidla", "#/ucet", "#/lide", ...st.z.map(id => `#/zakazka/${id}`), ...st.c.map(id => `#/zakaznik/${id}`), ...st.v.map(id => `#/vozidlo/${id}`)];
    const spatne = [];
    for (const h of trasy) {
      await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const W = window.innerWidth; if (document.documentElement.scrollWidth <= W + 1) return null;
        const pres = [...document.querySelectorAll("body *")].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > W + 1; })
          .filter(e => ![...e.children].some(ch => ch.getBoundingClientRect().right > W + 1))
          .slice(0, 6).map(e => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${String(e.className).split(" ").join(".")} → ${Math.round(e.getBoundingClientRect().right)}px`);
        return { sw: document.documentElement.scrollWidth, pres };
      });
      if (r) spatne.push(h.replace(/[0-9a-f-]{36}/, "ID") + ` (${r.sw}px): ` + r.pres.join(" | "));
    }
    if (spatne.length) console.log("PRETEKA:\n" + [...new Set(spatne)].join("\n"));
    kontrola(!spatne.length, "iPhone: žádná stránka se neposouvá do stran (" + trasy.length + " stránek)");
    await p.evaluate(id => { location.hash = "#/zakazka/" + id; }, st.z[0]); await p.waitForSelector("#stav-zakazky");
    const male = await p.evaluate(() => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=file]):not([hidden]), select, textarea")]
      .filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => (e.id || e.name || e.dataset.f || e.className) + " " + getComputedStyle(e).fontSize));
    if (male.length) console.log("MALE PISMO:", male.join(", "));
    kontrola(!male.length, "iPhone: v detailu zakázky žádné pole pod 16 px (iPhone by přibližoval)");
    await p.setViewportSize({ width: 834, height: 1194 });
  }

  // ---------- iPhone ----------
  const ph = await b.newContext({ ...devices["iPhone 14"], locale: "cs-CZ" });
  await ph.addInitScript({ content: fs.readFileSync("testy/mock-db.js", "utf8") });
  const q = await ph.newPage(); await q.goto(URL0 + "#/novy"); await q.waitForSelector('[data-pole="zakaznik.jmeno"]');
  await q.screenshot({ path: path.join(OUT, "08-iphone.png"), fullPage: false });
  const sirka = await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  kontrola(sirka, "na iPhonu se stránka nevodorovně neposouvá");
  const vyskaListy = await q.evaluate(() => document.querySelector(".lista").getBoundingClientRect().height);
  kontrola(vyskaListy < 80 && await q.isVisible(".menu-tl") && !(await q.isVisible('.menu-odkazy a[href="#/zakazky"]')), `iPhone: horní lišta jen s ☰ (${Math.round(vyskaListy)} px)`);
  const vyskaDole = await q.evaluate(() => document.querySelector(".akce-dole").getBoundingClientRect().height);
  kontrola(vyskaDole < 90 && /Chybí \d+ údaj/.test(await q.evaluate(() => getComputedStyle(document.querySelector("#co-chybi"), "::after").content)), `iPhone: spodní lišta příjmu na jeden řádek (${Math.round(vyskaDole)} px)`);
  await q.click(".menu-tl"); await q.waitForSelector('.menu-odkazy a[href="#/zakazky"]', { state: "visible" });
  await q.screenshot({ path: path.join(OUT, "08-iphone-menu.png"), fullPage: false });
  await q.fill("#menu-hledat", "xyz123"); await q.waitForSelector("#menu-vysledky >> text=Nic nenalezeno");
  kontrola(true, "iPhone: hledání v menu");
  await q.click('.menu-odkazy a[href="#/"]'); await q.waitForSelector(".dlazdice-k, .prazdne");
  kontrola(!(await q.isVisible('.menu-odkazy a[href="#/zakazky"]')), "iPhone: menu se po výběru zavře");
  await q.screenshot({ path: path.join(OUT, "08-iphone-prehled.png"), fullPage: false });

  // ---------- odkaz „zapomenuté heslo“ z e-mailu ----------
  const ob = await ph.newPage(); await ob.goto(URL0 + "#access_token=x&expires_in=3600&refresh_token=y&token_type=bearer&type=recovery");
  await ob.waitForSelector("text=Nové heslo");
  await ob.evaluate(() => { location.hash = ""; });          // Supabase si token z adresy hned smaže – formulář musí zůstat
  await ob.waitForTimeout(300);
  kontrola(await ob.isVisible("text=Nové heslo") && await ob.isVisible('input[autocomplete="new-password"]'), "odkaz pro obnovu hesla: formulář „Nové heslo“ zůstane i po smazání tokenu z adresy");
  await ob.fill('input[name="heslo"]', "nove-heslo-1234"); await ob.click("button[type=submit]");
  await ob.waitForSelector("a[href=\"#/novy\"]");
  kontrola(true, "po uložení nového hesla je uživatel přihlášený v aplikaci");
  const ex = await ph.newPage(); await ex.goto(URL0 + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await ex.waitForSelector("text=vypršel");
  kontrola(true, "prošlý odkaz z e-mailu ukáže srozumitelnou hlášku");

  // ---------- dvoufázové přihlášení (Google Authenticator) ----------
  for (const rezim of ["nastavit", "overit"]) {
    const m = await ph.newPage(); await m.addInitScript(r => { window.__TEST_MFA__ = r; }, rezim); await m.goto(URL0);
    await m.waitForSelector(".mfa-kod");
    kontrola(rezim === "nastavit" ? await m.isVisible(".mfa-qr img") : !(await m.isVisible(".mfa-qr")), rezim === "nastavit" ? "2FA: bez nastavení se nejde dostat k datům – ukáže QR kód pro Google Authenticator" : "2FA: po 30 dnech chce aplikace znovu kód");
    kontrola(await m.locator("a[href='#/novy']").count() === 0, "2FA: před ověřením kódem nejsou vidět žádná data");
    await m.fill(".mfa-kod", "111111"); await m.waitForSelector("#zprava2 >> text=Kód nesedí");
    kontrola(true, "2FA: špatný kód – srozumitelná hláška");
    await m.fill(".mfa-kod", "123456"); await m.waitForSelector("a[href=\"#/novy\"]");
    kontrola(await m.evaluate(r => window.__MFA_OVERENO__ === (r === "nastavit" ? "f-novy" : "f1"), rezim), "2FA: správný kód pustí do aplikace (" + rezim + ")");
    await m.close();
  }

  kontrola(chyby.length === 0, "bez chyb v konzoli" + (chyby.length ? ": " + chyby.join(" | ") : ""));
  await b.close(); server.close();
})().catch(e => { console.error(e.message); server.close(); process.exit(1); });
