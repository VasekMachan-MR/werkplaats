/* Šablona: parts list – příloha k nabídce a faktuře (seznam dílů pro zákazníka), anglicky.
   Vzhled sjednocený s nabídkou a fakturou: stejný rámeček, nadpis, „Mercedes Restorations“, modré zvýraznění #b9d1f9,
   patička s číslem strany. Data: { cislo, ceny, datum, odkaz: {druh, cislo}, vozidlo: {...}, zakaznik: {jmeno},
   dily: [{ nazev, mnozstvi, cislo, cenaKs, cena (za řádek), poznamka, puvod: "original" | "aftermarket" }] } */

const MODRA = "#b9d1f9";                                   // firemní světle modrá (řádek materiálu na faktuře)
const BARVY = { original: "#b9d1f9", aftermarket: "#f8cfae" };
const ZEBRA = "#f3f7fe", LINKA = "#d3ddee";
const RAM = { x0: 50.0, x1: 544.9, y0: 53.9, y1: 772.2 };
const DOLE = 758;                                          // poslední použitelný řádek uvnitř rámečku
const NAZVY_ODKAZU = { nabidka: "Quotation", faktura: "Invoice", zalohova: "Advance invoice" };

// 4 710 CZK (haléře jen když nějaké jsou)
const czk = n => `${Number.isInteger(Math.round(Number(n) * 100) / 100) ? cislo0(n) : cislo2(n)} CZK`;

/* sloupce: s cenami / bez cen */
function sloupce(ceny) {
  return ceny
    ? { cis: 60, dil: 73, dilW: 160, kod: 279, kodW: 84, puv: 352, puvL: 322, puvR: 382, ks: 397, ksW: 26, cenaKs: 466, cenaKsW: 56, celkem: 539.5, celkemW: 64 }
    : { cis: 60, dil: 73, dilW: 250, kod: 380, kodW: 104, puv: 462.5, puvL: 435, puvR: 490, ks: 517, ksW: 44 };
}

function ramecek() {
  return L(RAM.x0, RAM.y0, RAM.x0 + 1, RAM.y1) + L(RAM.x1 - 1, RAM.y0 + 1, RAM.x1, RAM.y1)
       + L(RAM.x0 + 1, RAM.y0, RAM.x1, RAM.y0 + 1) + L(RAM.x0 + 1, RAM.y1 - 0.9, RAM.x1, RAM.y1);
}

/* hlavička tabulky na pozici y; vrací {rect, html, y} */
function hlavickaTabulky(y, S, ceny) {
  const r = L(51, y, RAM.x1 - 1, y + 15, MODRA) + L(51, y + 15, RAM.x1 - 1, y + 16);
  const o = { b: true, size: 8.6 }, ty = y + 3.6;
  let h = T(S.cis, ty, "#", { ...o, c: true }) + T(S.dil, ty, "PART", o) + T(S.kod, ty, "PART NUMBER", { ...o, c: true })
        + T(S.puv, ty, "ORIGIN", { ...o, c: true }) + T(S.ks, ty, "QTY", { ...o, c: true });
  if (ceny) h += T(S.cenaKs, ty, "UNIT PRICE", { ...o, r: true }) + T(S.celkem, ty, "TOTAL", { ...o, r: true });
  return { rect: r, html: h, y: y + 16 };
}

window.render = async function (d) {
  await nactiPisma();
  const ceny = d.ceny !== false, S = sloupce(ceny);
  const dily = (d.dily || []).filter(x => x && (x.nazev || x.cislo));
  const stranky = [];                                     // { rect, html }
  let st = null, y = 0;

  const novaStrana = prvni => {
    st = { rect: ramecek(), html: "" };
    stranky.push(st);
    st.html += T(73.5, 64.4, "PARTS LIST", { b: true, size: 15.7 });
    if (d.cislo != null) st.html += T(450.8, 64.4, "#", { b: true, size: 15.7 }) + T(466.5, 64.4, String(d.cislo), { b: true, size: 15.7 });
    if (prvni) {
      st.html += T(186.2, 105.9, "Mercedes Restorations", { b: true, size: 21.6 });
      // vozidlo
      const v = d.vozidlo || {}, z = d.zakaznik || {};
      st.html += T(63.7, 146.0, "Vehicle:", { b: true, size: 10.8 });
      const auto = [v.znacka || "Mercedes-Benz", v.typ, v.model].filter(Boolean).join(" ");
      const vl = [auto, v.rok ? `Year: ${v.rok}` : "", v.vin ? `VIN: ${v.vin}` : "", v.spz ? `Reg. plate: ${v.spz}` : ""].filter(Boolean);
      vl.forEach((s, i) => st.html += T(63.7, 164.0 + i * 12.73, s, { maxW: 262 }));
      // zákazník a odkaz
      st.html += T(344.0, 146.0, "Customer:", { b: true, size: 10.8 });
      const pl = [z.jmeno || "",
        d.odkaz?.cislo ? `Reference: ${NAZVY_ODKAZU[d.odkaz.druh] || "Document"} ${d.odkaz.cislo}` : "",
        d.datum ? `Date: ${datum(d.datum)}` : ""].filter(Boolean);
      pl.forEach((s, i) => st.html += T(344.0, 164.0 + i * 12.73, s, { maxW: 190 }));
      st.rect += L(50.0, 222.0, RAM.x1, 223.0);
      y = 232;
    } else {
      st.rect += L(50.0, 86.0, RAM.x1, 87.0);
      y = 96;
    }
  };

  novaStrana(true);
  let hl = hlavickaTabulky(y, S, ceny); st.rect += hl.rect; st.html += hl.html; y = hl.y;

  // řádky dílů
  let total = 0; const souctyPuvodu = { original: 0, aftermarket: 0 };
  dily.forEach((x, i) => {
    const vyska = x.poznamka ? 25 : 16;
    if (y + vyska > DOLE) {                                // pokračování na další straně
      novaStrana(false);
      hl = hlavickaTabulky(y, S, ceny); st.rect += hl.rect; st.html += hl.html; y = hl.y;
    }
    if (i % 2 === 1) st.rect += L(51, y, RAM.x1 - 1, y + vyska, ZEBRA);
    st.rect += L(51, y + vyska - 0.6, RAM.x1 - 1, y + vyska, LINKA);
    const ty = y + 3.9;
    st.html += T(S.cis, ty, String(i + 1), { size: 8.6, c: true });
    st.html += T(S.dil, ty, x.nazev || "", { b: true, size: 9.4, maxW: S.dilW, minSize: 7 });
    if (x.poznamka) st.html += T(S.dil, ty + 10.6, x.poznamka, { size: 7.8, maxW: S.dilW, minSize: 6.5 });
    if (x.cislo) st.html += T(S.kod, ty, x.cislo, { size: 9.0, c: true, maxW: S.kodW, minSize: 6.8 });
    if (BARVY[x.puvod]) {                                  // štítek původu
      st.rect += L(S.puvL + 4, y + 2.4, S.puvR - 4, y + 13.6, BARVY[x.puvod]);
      st.html += T(S.puv, ty + 0.4, x.puvod === "original" ? "Original" : "Aftermarket", { size: 7.8, c: true });
    }
    if (x.mnozstvi != null && x.mnozstvi !== "") st.html += T(S.ks, ty, typeof x.mnozstvi === "number" ? mnozstvi(x.mnozstvi) : String(x.mnozstvi), { size: 9.0, c: true, maxW: S.ksW, minSize: 7 });
    if (ceny) {
      if (x.cenaKs != null && x.cenaKs !== "") st.html += T(S.cenaKs, ty, czk(x.cenaKs), { size: 8.6, r: true, maxW: S.cenaKsW, minSize: 6.8 });
      if (x.cena != null && x.cena !== "") {
        total += Number(x.cena); if (souctyPuvodu[x.puvod] != null) souctyPuvodu[x.puvod] += Number(x.cena);
        st.html += T(S.celkem, ty, czk(x.cena), { b: true, size: 8.6, r: true, maxW: S.celkemW, minSize: 6.8 });
      }
    }
    y += vyska;
  });
  st.rect += L(51, y, RAM.x1 - 1, y + 1);                  // konec tabulky

  // součty a vysvětlivky
  const maPuvod = dily.some(x => BARVY[x.puvod]);
  const radkuSouctu = ceny ? (souctyPuvodu.original && souctyPuvodu.aftermarket ? 3 : 1) : 0;
  const potreba = 14 + Math.max(radkuSouctu * 15, maPuvod ? 40 : 14);
  if (y + potreba > DOLE) { novaStrana(false); }
  let yS = y + 10;
  const pocet = dily.length;
  st.html += T(63.7, yS + 3.6, `${pocet} ${pocet === 1 ? "item" : "items"}`, { size: 8.6 });
  if (ceny) {
    const radky = [];
    if (souctyPuvodu.original && souctyPuvodu.aftermarket) radky.push(["Original parts", souctyPuvodu.original], ["Aftermarket parts", souctyPuvodu.aftermarket]);
    radky.forEach(([t, n], i) => {
      st.html += T(352, yS + 3.6 + i * 15, t, { size: 8.6 }) + T(S.celkem, yS + 3.6 + i * 15, czk(n), { size: 8.6, r: true });
    });
    const yT = yS + radky.length * 15;
    st.rect += L(344, yT, RAM.x1 - 1, yT + 18, MODRA);
    st.html += T(352, yT + 4.0, "TOTAL", { b: true, size: 10.8 }) + T(S.celkem, yT + 4.0, czk(d.total ?? total), { b: true, size: 10.8, r: true });
  }
  if (maPuvod) {
    const yl = yS + 18;
    st.rect += L(63.7, yl + 1, 71.7, yl + 9, BARVY.original) + L(63.7, yl + 14, 71.7, yl + 22, BARVY.aftermarket);
    st.html += T(76.5, yl + 1.6, "Original – genuine Mercedes-Benz part", { size: 7.8 })
             + T(76.5, yl + 14.6, "Aftermarket – quality replacement part", { size: 7.8 });
  }


  document.getElementById("doc").innerHTML = stranky.map((s, i) =>
    `<section class="page">${SVG(s.rect)}${s.html}${paticka(i + 1, stranky.length)}</section>`).join("");
  return { celkem: d.total ?? total, stran: stranky.length };
};
