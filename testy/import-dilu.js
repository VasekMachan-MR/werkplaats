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

console.log(chyb ? `\n${chyb} chyb` : "\nVše v pořádku");
process.exit(chyb ? 1 : 0);
