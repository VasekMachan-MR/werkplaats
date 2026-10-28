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
  await ctx.addInitScript({ content: `window.__TEST_PODPIS__ = ${JSON.stringify(podpisVasek)};` + fs.readFileSync("testy/mock-db.js", "utf8") });
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
  await p.fill('[data-pole="vozidlo.model"]', "300 SE");
  await p.fill('[data-pole="vozidlo.rok"]', "1989");
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
  await p.waitForSelector("#fotky-detail video");
  kontrola(await p.locator("#fotky-detail video").count() === 1 && await p.locator("#fotky-detail img").count() === 2, "detail ukazuje 2 fotky a přehrávatelné video");
  await foto("05-detail");

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
  await p.waitForSelector(".zakazka-radek");
  kontrola(await p.locator(".zakazka-radek").count() === 2, "přehled ukazuje 2 zakázky");
  await foto("07-prehled");

  // ---------- iPhone ----------
  const ph = await b.newContext({ ...devices["iPhone 14"], locale: "cs-CZ" });
  await ph.addInitScript({ content: fs.readFileSync("testy/mock-db.js", "utf8") });
  const q = await ph.newPage(); await q.goto(URL0 + "#/novy"); await q.waitForSelector('[data-pole="zakaznik.jmeno"]');
  await q.screenshot({ path: path.join(OUT, "08-iphone.png"), fullPage: false });
  const sirka = await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  kontrola(sirka, "na iPhonu se stránka nevodorovně neposouvá");

  kontrola(chyby.length === 0, "bez chyb v konzoli" + (chyby.length ? ": " + chyby.join(" | ") : ""));
  await b.close(); server.close();
})().catch(e => { console.error(e.message); server.close(); process.exit(1); });
