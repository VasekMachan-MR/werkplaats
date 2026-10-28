/* Šablona: parts list – příloha k nabídce a faktuře (seznam dílů pro zákazníka), vždy anglicky jako originály.
   Podle originálů „Parts list Miguel 560SL“ (sloupec PRICE a TOTAL) a „Parts list Bottinger“ (barvy Original / Aftermarket). */
const PL = {
  ramec: { x0: 50, x1: 535, y0: 56, y1: 780 },
  sloupce: [51, 213, 243, 339, 418, 535],          // svislé čáry tabulky
  stredy: { nazev: 132, qty: 228, cislo: 291, cena: 378.5, pozn: 476.5 },
  hlavicka: { y: 127, text: 130.1 },
  radek0: 141, krok: 13, radku: 30,                  // 30 řádků po 13 pt (141 → 531)
  barvy: { original: "#8ea9db", aftermarket: "#f4b084" }
};

const czk = n => `${cislo2(n)} CZK`;                   // 4 710,00 CZK

window.render = async function (d) {
  await nactiPisma();
  const P = PL, R = P.ramec;
  let pruhy = "", cary = "", h = "";
  const dily = (d.dily || []).slice(0, P.radku);
  const yRadek = i => P.radek0 + i * P.krok;
  // barevné pruhy řádků (původ dílu)
  dily.forEach((x, i) => { if (P.barvy[x.puvod]) pruhy += L(R.x0, yRadek(i), R.x1, yRadek(i) + P.krok + 1, P.barvy[x.puvod]); });
  // rámeček
  cary += L(R.x0, R.y0, R.x0 + 1, R.y1) + L(R.x0 + 1, R.y0, R.x1, R.y0 + 1) + L(R.x1 - 1, R.y0 + 1, R.x1, R.y1) + L(R.x0 + 1, R.y1 - 1, R.x1, R.y1);
  if (d.cislo != null) cary += L(417, 69, 418, 89);                      // oddělovač před číslem
  // tabulka
  const yKonec = yRadek(P.radku), yTotal = yKonec + 1, yTotalKonec = yTotal + P.krok + 1;
  cary += L(51, P.hlavicka.y, R.x1, P.hlavicka.y + 1) + L(51, P.radek0 - 1, R.x1, P.radek0);
  for (let i = 1; i <= P.radku; i++) cary += L(51, yRadek(i) - 1, R.x1, yRadek(i));
  P.sloupce.slice(1, -1).forEach((x, i) => cary += L(x - 1, P.hlavicka.y + 1, x, i >= 2 ? yTotalKonec : yKonec));
  cary += L(51, yTotalKonec - 1, R.x1, yTotalKonec);
  h += SVG(pruhy + cary);

  // hlavička
  h += T(63.0, 73.7, "PARTS LIST", { b: true, size: 16 });
  if (d.cislo != null) h += T(430.0, 73.7, `#${d.cislo}`, { b: true, size: 16 });
  const S = P.stredy, yh = P.hlavicka.text;
  h += T(S.nazev, yh - 1.0, "PART", { b: true, size: 10, c: true }) + T(S.qty, yh, "QTY", { b: true, size: 10, c: true });
  h += T(S.cislo, yh, "PART NUMBER", { b: true, size: 10, c: true });
  if (d.ceny !== false) h += T(S.cena, yh, "PRICE", { b: true, size: 10, c: true });
  h += T(S.pozn, yh - 0.4, "REMARKS", { b: true, size: 10, c: true, calibri: true });

  // řádky dílů
  let total = 0;
  dily.forEach((x, i) => {
    const y = yRadek(i) + 1.1;
    h += T(S.nazev, y, x.nazev, { b: true, size: 10, c: true, maxW: 158, minSize: 7 });
    if (x.mnozstvi != null && x.mnozstvi !== "") h += T(S.qty, y + 1.0, typeof x.mnozstvi === "number" ? mnozstvi(x.mnozstvi) : String(x.mnozstvi), { b: true, size: 10, c: true, maxW: 28, minSize: 7 });
    if (x.cislo) h += T(S.cislo, y + 1.0, x.cislo, { size: 10, c: true, maxW: 93, minSize: 7 });
    if (d.ceny !== false && x.cena != null && x.cena !== "") { total += Number(x.cena); h += T(S.cena, y + 1.0, czk(x.cena), { size: 10, c: true, maxW: 77, minSize: 7 }); }
    if (x.poznamka) h += T(S.pozn, y + 1.3, x.poznamka, { size: 9, c: true, calibri: true, maxW: 113, minSize: 6.5 });
  });
  if (d.ceny !== false) {
    h += T(194.5, yTotal + 2.1, "TOTAL", { b: true, size: 10, c: true });
    h += T(S.cena, yTotal + 3.1, czk(d.total ?? total), { b: true, size: 10, c: true });
  }

  // legenda barev (jen když je u dílů vyplněný původ)
  if (dily.some(x => P.barvy[x.puvod])) {
    const yl = 702;
    h += SVG(L(R.x0, yl, 212, yl + 13, P.barvy.original) + L(R.x0, yl + 13, 212, yl + 26, P.barvy.aftermarket)
      + L(212, yl, 214, yl + 27, "#000") + L(R.x0, yl + 26, 214, yl + 27.5, "#000"));
    h += T(131.5, yl + 3.1, "Original part", { size: 10, c: true }) + T(131.5, yl + 16.1, "Aftermarket part", { size: 10, c: true });
  }

  // patička bez čísla strany (jako originál)
  h += T(51.0, 810.7, FIRMA.web, { serif: true, size: 8, ink: true }) + T(545.5, 810.7, FIRMA.mail, { serif: true, size: 8, ink: true, r: true });
  document.getElementById("doc").innerHTML = `<section class="page">${h}</section>`;
  return { celkem: d.total ?? total };
};
