/* Testy pevného převodníku dílů (formáty podle skutečných e-mailů dodavatelů, bez osobních údajů). Spuštění: node testy/import-dilu.js */
const { rozeberDily } = require("../aplikace/import-dilu.js");
let chyb = 0;
const ok = (podminka, popis, detail) => { console.log(`${podminka ? "✓" : "✗"} ${popis}`); if (!podminka) { chyb++; if (detail) console.log("   ", JSON.stringify(detail)); } };

// 1) Auto Kelly – CSV příloha faktury
const csv = `Verze formatu;1.10\r\nLKQ CZ s.r.o., pobočka HRADECZ - faktura c.;4126028275\r\nDatum vystaveni;26.10.2026\r\nMena;Kč\r\n` +
  `Cislo;Kod;Nazev;Mnozstvi;MOC bez DPH/ks;VOC bez DPH/ks;Sleva (%);DPH (%);Cena/ks;Celkem s DPH;Merne mnozstvi;Merna velicina;poznámka zákazníka\r\n` +
  `1;LO 00596;Sada ložiska kola STARLINE;1;319.00;319.00;0.00;21;319.00;385.99;1.00;ks;\r\n` +
  `2;BO 1457429970;Vzduchový filtr BOSCH;2;290.00;290.00;0.00;21;290.00;701.80;1.00;ks;\r\n` +
  `Sazba DPH (%);Bez DPH;DPH;Cena s DPH\r\n21;609.00;127.89;736.89\r\n`;
let r = rozeberDily(csv);
ok(r.format === "Auto Kelly – CSV faktury" && r.dodavatel === "Auto Kelly", "CSV faktury Auto Kelly – poznán formát i dodavatel", r);
ok(r.polozky.length === 2, "CSV: 2 položky");
ok(r.polozky[0].cislo === "LO 00596" && r.polozky[0].nazev === "Sada ložiska kola STARLINE" && r.polozky[0].cena === 385.99, "CSV: ložisko 385,99 Kč s DPH", r.polozky[0]);
ok(r.polozky[1].mnozstvi === 2 && r.polozky[1].cena === 350.9, "CSV: 2 ks filtru → 350,90 Kč/ks", r.polozky[1]);

// 2) Auto Kelly – faktura v těle e-mailu
const fa = `[www.autokelly.cz]\n\nLKQ CZ s.r.o., pobočka HRADECZ - faktura 4126028275, vystavena 26.10.2026 13:02\n________________________________\n` +
  `Název   ks      DPH     Kč/ks bez DPH   Kč s DPH\n1.              LO 00596 / Sada ložiska kola STARLINE   1       21%     319.00  385.99\n` +
  `2.\tMH KC22 / Palivový filtr KNECHT\t3\t21%\t200.00\t726.00\nCelkem bez DPH 919.00 Kč\nCelkem s DPH 1111.99 Kč\n`;
r = rozeberDily(fa);
ok(r.format === "Auto Kelly – faktura z e-mailu" && r.polozky.length === 2, "faktura z e-mailu: 2 položky", r);
ok(r.polozky[1].cislo === "MH KC22" && r.polozky[1].nazev === "Palivový filtr KNECHT" && r.polozky[1].mnozstvi === 3 && r.polozky[1].cena === 242, "faktura: 3 ks palivového filtru → 242 Kč/ks", r.polozky[1]);

// 3) Auto Kelly – potvrzení objednávky z e-shopu (tak, jak ho vrací pošta)
const obj = `www.autokelly.cz\n\nVážený zákazníku,\n\nVaše objednávka:\n\nNázev\n\nKs\n\nCena s DPH\n\nDostupné od\n\n` +
  `[Sada ložiska kola STARLINE](https://www.autokelly.cz/Product/LO-00596/3184053)\nLO 00596\n\n1\n\n386 Kč\n\n26.10.2026\n12:00\n\n` +
  `[Vzduchový filtr BOSCH](https://www.autokelly.cz/Product/BO-1457429970/8409462)\nBO 1457429970\n\n2\n\n1 402 Kč\n\n09.10.2026\n11:40\n\n` +
  `**Cena celkem:**\n\n**1 788 Kč s DPH**\n`;
r = rozeberDily(obj);
ok(r.format === "Auto Kelly – potvrzení objednávky" && r.polozky.length === 2, "objednávka Auto Kelly: 2 položky", r);
ok(r.polozky[1].nazev === "Vzduchový filtr BOSCH" && r.polozky[1].cislo === "BO 1457429970" && r.polozky[1].cena === 701, "objednávka: řádková cena 1 402 / 2 ks = 701 Kč/ks (podle součtu)", r.polozky[1]);
// stejná objednávka zkopírovaná jako tabulka (tabulátory)
const objTab = `Název\tKs\tCena s DPH\tDostupné od\nSada ložiska kola STARLINE\nLO 00596\t1\t386 Kč\t26.10.2026 12:00\nCena celkem:\t386 Kč s DPH`;
r = rozeberDily(objTab);
ok(r.polozky.length === 1 && r.polozky[0].cena === 386 && r.polozky[0].cislo === "LO 00596", "objednávka zkopírovaná jako tabulka", r);

// 4) Landsmann
const land = `Seznam objednaných položek:\n\nKód Popis   Počet Mj Cena s DPH Celkem s DPH 880-423030M\n[http://www.landsmann.cz/default.asp?cls=stoitem&stiid=93803] Hlavice nástrčná -\n` +
  `ořech 1/2" prodloužená 12-ti hranná 30mm Typ 4230M   1.00 ks 371.03 371.03\n\n  Celková hodnota objednaného zboží s DPH včetně dopravy: 372.00 Kč\n\nLandsmann s.r.o.`;
r = rozeberDily(land);
ok(r.format === "Landsmann – objednávka" && r.dodavatel === "Landsmann" && r.polozky.length === 1, "Landsmann: 1 položka", r);
ok(r.polozky[0].cislo === "880-423030M" && /^Hlavice nástrčná/.test(r.polozky[0].nazev) && r.polozky[0].cena === 371.03, "Landsmann: kód, název, 371,03 Kč", r.polozky[0]);

// 5) obecný text / tabulka z Excelu
const obec = `A 126 420 12 20\tBrzdové destičky přední\t1\t2 450 Kč\nTěsnění víka ventilů A1160160221 2 ks 380,00 Kč\nCelkem 3 210 Kč`;
r = rozeberDily(obec);
ok(r.polozky.length === 2 && r.polozky.every(p => p.odhad), "obecný text: 2 řádky jako odhad", r);
ok(r.polozky[0].cislo === "A 126 420 12 20" && r.polozky[0].nazev === "Brzdové destičky přední" && r.polozky[0].cena === 2450, "obecný: MB číslo, název, 2 450 Kč", r.polozky[0]);
ok(r.polozky[1].cislo === "A1160160221" && r.polozky[1].mnozstvi === 2 && r.polozky[1].nazev === "Těsnění víka ventilů", "obecný: 2 ks těsnění", r.polozky[1]);
ok(rozeberDily("Dobrý den, posílám fotky auta.").polozky.length === 0, "běžný e-mail bez dílů → nic");

// 6) Granex – e-mail s objednávkou
const gx = `Vaše nová objednávka\nVážený zákazníku,\npotvrzujeme přijetí Vaší objednávky 572918.\nGranex.cz <https://granex.cz/?utm_source=x>\n\n+420608862512\nKontakt <https://granex.cz/kontakt>\n` +
  `Obchodní podmínky <https://granex.cz/informace/obchodni-podminky> 12× Pouzdro, řadicí tyč FEBI BILSTEIN 08224 <https://granex.cz/front/product/default/52024>\nSkladem > 5 ks.\n• 336 Kč (12× 28 Kč)\n` +
  `2× Tlumič pérování BILSTEIN 24-011839 <https://granex.cz/tlumic>\nSkladem > 5 ks.\n• 5 008 Kč (2× 2 504 Kč)\n` +
  `4× ATE 03.9901-8110.2 Čistič brzd 500ml <https://granex.cz/x>\nSkladem na prodejně.\n• 276 Kč (4× 69 Kč)\n` +
  `2× Valvoline ALL Climate 15W‑40 4L <https://granex.cz/x>\nKatalogové číslo VA872785\n• Skladem > 5 ks.\n• 1 848 Kč (2× 924 Kč)\n` +
  `1× Olejový filtr MANN-FILTER PF 1055/1 x <https://granex.cz/x>\nSkladem 1 ks.\n• 324 Kč\n` +
  `1× K2 NANO SPRYSK Zimní kapalina do ostřikovačů -40°C 5L <https://granex.cz/x>\nSkladem > 5 ks.\n• 181 Kč\n` +
  `1× DPD – Zásilková služba\n139 Kč\n1× Apple Pay\n\nObjednávka je zaplacena. Celková cena 8 073 Kč včetně DPH`;
r = rozeberDily(gx);
ok(r.format === "Granex – objednávka" && r.dodavatel === "Granex" && r.polozky.length === 6, "Granex objednávka: 6 dílů (bez dopravy a platby)", r);
const g = Object.fromEntries(r.polozky.map(p => [p.cislo || p.nazev, p]));
ok(g["08224"]?.nazev === "Pouzdro, řadicí tyč FEBI BILSTEIN" && g["08224"].mnozstvi === 12 && g["08224"].cena === 28, "Granex: 12× pouzdro FEBI 08224 po 28 Kč", r.polozky[0]);
ok(g["24-011839"]?.cena === 2504 && g["03.9901-8110.2"]?.nazev === "ATE Čistič brzd 500ml" && g["03.9901-8110.2"].cena === 69, "Granex: tlumič 2 504 Kč/ks, ATE čistič – číslo ze začátku názvu", r.polozky);
ok(g["VA872785"]?.cena === 924 && g["PF 1055/1 x"]?.cena === 324 && r.polozky.some(p => /K2 NANO/.test(p.nazev) && p.cislo === "" && p.cena === 181), "Granex: katalogové číslo oleje, MANN PF 1055/1 x, kapalina bez čísla", r.polozky);

// 7) Granex – text PDF faktury (název přes víc řádků, zalomení stránky)
const gf = `Faktura – Daňový doklad 26569121\nOznačení dodávky Počet M.J. Cena za M.J. DPH % bez DPH DPH Celkem s DPH\n` +
  `Pouzdro, řadicí tyč FEBI BILSTEIN 08224 12 ks 23,14 Kč 21 % 277,69 Kč 58,31 Kč 336 Kč\n` +
  `Tlumič pérování BILSTEIN 24-011839 2 ks 2 069,42 Kč 21 % 4 138,84 Kč 869,16 Kč 5 008 Kč\n` +
  `Montážní sada, řídicí mechanismus MEYLE 014\n033 0001\n2 ks 236,36 Kč 21 % 472,73 Kč 99,27 Kč 572 Kč\n\n` +
  `Veškeré zboží je určeno k odborné montáži. Dodavatel neručí za škody.\nFakturu vygeneroval e-shop od kvikshop.com\n` +
  `Brzdová hadice TRW PHB136 2 ks 212,40 Kč 21 % 424,79 Kč 89,21 Kč 514 Kč\nDPD – Zásilková služba 1 ks 114,88 Kč 21 % 114,88 Kč 24,12 Kč 139 Kč\n` +
  `Apple Pay 1 ks 0 Kč 21 % 0 Kč 0 Kč 0 Kč\nZáklad Výše DPH Celkem s DPH\n21 % 22 714,88 Kč 4 770,12 Kč\n`;
r = rozeberDily(gf + "\ngranex.cz");
ok(r.format === "Granex – faktura (PDF)" && r.polozky.length === 4, "Granex faktura: 4 díly (bez DPD, Apple Pay, patičky)", r);
ok(r.polozky[2].nazev === "Montážní sada, řídicí mechanismus MEYLE" && r.polozky[2].cislo === "014 033 0001" && r.polozky[2].cena === 286, "Granex faktura: název přes 2 řádky, MEYLE 014 033 0001, 286 Kč/ks", r.polozky[2]);
ok(r.polozky[3].cislo === "PHB136" && r.polozky[3].nazev === "Brzdová hadice TRW" && r.polozky[3].cena === 257, "Granex faktura: řádek po zalomení stránky (TRW PHB136, 257 Kč)", r.polozky[3]);

// 8) skutečný text objednávky Granex zkopírovaný z Mailu (36 položek, součet 27 346 Kč + doprava 139 = 27 485 Kč dle faktury)
const gxSkut = require("fs").readFileSync(__dirname + "/data-granex-objednavka.txt", "utf8");
for (const [nazev, uprava] of [["tak jak je", x => x], ["s pevnými a neviditelnými mezerami", x => x.replace(/ Kč/g, " Kč").replace(/(\d) (\d)/g, "$1 $2").replace(/\n/g, "​\n")], ["s prázdnými řádky", x => x.replace(/\n/g, "\n\n")], ["„12ד v samostatné buňce", x => x.replace(/×\t/g, "×\n")]]) {
  r = rozeberDily(uprava(gxSkut));
  ok(r.format === "Granex – objednávka" && r.dodavatel === "Granex" && r.polozky.length === 36 && r.polozky.reduce((s, p) => s + p.cena * p.mnozstvi, 0) === 27346, `Granex z Mailu (${nazev}): 36 dílů, součet 27 346 Kč`, r.polozky.slice(0, 3));
}
r = rozeberDily(gxSkut);
const kody = r.polozky.map(p => p.cislo);
ok(["08224", "VA872785", "W 719/13", "H 85", "C 41 173", "10731 01", "014 033 0001", "24.0128-0102.1", "13.0460-0197.2", "PHB136"].every(k => kody.includes(k)), "Granex z Mailu: čísla dílů (FEBI, Valvoline, MANN, LEMFÖRDER, MEYLE, ATE, TRW)", kody);
ok(r.polozky.find(p => p.cislo === "24.0128-0102.1").nazev === "Brzdový kotouč ATE" && r.polozky.every(p => !/Kč/.test(p.nazev)), "Granex z Mailu: v názvech není cena, ATE zůstává v názvu");
ok(rozeberDily("336 Kč (12× 28 Kč)\n5 008 Kč (2× 2 504 Kč)").polozky.length === 0, "samotné řádky s cenou nejsou díly");

console.log(chyb ? `\n${chyb} chyb` : "\nVše v pořádku");
process.exit(chyb ? 1 : 0);
