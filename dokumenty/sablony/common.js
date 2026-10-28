/* Společné funkce pro všechny dokumenty Mercedes Restorations (zakázkový list, faktura, nabídka, protokol).
   Souřadnice jsou v bodech (pt) podle originálních PDF z Excelu, stránka A4 = 595 × 842 pt. */

const FIRMA = {
  nazev: "Mercedes Restorations, s. r. o.", ulice: "Vlčkovická 223/1A", mesto: "500 04 Hradec Králové",
  zeme: { cs: "Česká Republika", en: "Česká Republika" }, ico: "21108340", ucet: "131-2320340257/0100",
  swift: "KOMBCZPPXXX", banka: "Komerční banka", iban: "CZ7001000001312320340257", vyhotovil: "Václav Macháň",
  web: "WWW.MERCEDESRESTORATIONS.CZ", mail: "INFO@MERCEDESREST.CZ",
  /* zápis v obchodním rejstříku (ARES: oddíl C, vložka 52310, Krajský soud v Hradci Králové, zapsáno 10. 1. 2024) */
  rejstrik: {
    cs: { kratce: "Spisová značka: C 52310, KS Hradec Králové",
          dlouze: "Společnost je zapsána v obchodním rejstříku vedeném Krajským soudem v Hradci Králové, oddíl C, vložka 52310." },
    en: { kratce: "Reg. no.: C 52310, Regional Court Hradec Králové",
          dlouze: "The company is registered in the Commercial Register kept by the Regional Court in Hradec Králové, section C, file 52310." }
  }
};

const BARVA = "#092a4f";
/* Pozice v podkladech = horní hrana písma v PDF; CSS box začíná o kousek výš. */
const KAL = { sans: 0.043, serif: 0.033 };

const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/* Excel umisťuje každý znak na mřížku 0,98 pt – napodobujeme, aby šířky textů seděly s originálem. */
const Q = 0.98;
const _ctx = document.createElement("canvas").getContext("2d");
function adv(ch, size, bold, serif) {
  _ctx.font = `${bold ? 700 : 400} 100px ${serif ? '"MR Serif"' : '"MR Sans"'}`;
  const w = _ctx.measureText(ch).width / 100 * size;
  return Math.max(0, Math.round(w / Q)) * Q;
}
function spans(text, size, bold, serif) {
  return [...String(text ?? "")].map(ch =>
    `<span style="display:inline-block;width:${adv(ch, size, bold, serif).toFixed(3)}pt">${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("");
}
/* Šířka textu v pt (stejně jako ho vykreslí T) */
const sirka = (text, size, bold, serif) => [...String(text ?? "")].reduce((a, ch) => a + adv(ch, size, bold, serif), 0);
/* Když se text nevejde do maxW, zmenší písmo (min. 7,8 pt) a případně zkrátí se „…“ */
function vejdeSe(text, size, bold, maxW) {
  let s = size;
  while (s > 7.8 && sirka(text, s, bold) > maxW) s = Math.round((s - 0.2) * 10) / 10;
  let t = String(text);
  if (sirka(t, s, bold) > maxW) { while (t.length > 1 && sirka(t + "…", s, bold) > maxW) t = t.slice(0, -1); t += "…"; }
  return { text: t, size: s };
}
/* Zalomí text do řádků širokých max. maxW (pt) – po slovech */
function zalom(text, size, bold, maxW) {
  const slova = String(text ?? "").split(/\s+/).filter(Boolean), radky = [];
  let r = "";
  slova.forEach(w => { const z = r ? r + " " + w : w; if (r && sirka(z, size, bold) > maxW) { radky.push(r); r = w; } else r = z; });
  if (r) radky.push(r);
  return radky;
}
/* Odrážkový seznam: dlouhé položky se zalomí, další řádek je odsazený pod text. Vrací {html, radku} */
function odrazky(x, y, polozky, maxRadku, maxW = 278, krok = 12.75) {
  let h = "", n = 0;
  const odsaz = sirka("● ", 9.8, false);
  for (const p of polozky || []) {
    const radky = zalom(p, 9.8, false, maxW - odsaz);
    radky.forEach((r, i) => {
      if (n >= maxRadku) return;
      h += i === 0 ? T(x, y + n * krok, `● ${r}`) : T(x + odsaz, y + n * krok, r);
      n++;
    });
  }
  return { html: h, radku: n };
}
/* Text na pozici x,y (pt). opts: size, b (tučně), serif, c (na střed x), r (zarovnat vpravo k x), ink (černá) */
function T(x, y, text, opts = {}) {
  if (text == null || text === "") return "";
  if (opts.maxW) { const f = vejdeSe(text, opts.size || 9.8, !!opts.b, opts.maxW); text = f.text; opts = { ...opts, size: f.size }; }
  const size = opts.size || 9.8, serif = !!opts.serif, bold = !!opts.b;
  const dy = (serif ? KAL.serif : KAL.sans) * size;
  const cls = ["t", bold ? "b" : "", serif ? "serif" : "", opts.c ? "c" : "", opts.r ? "r" : "", opts.ink ? "ink" : ""].join(" ");
  return `<div class="${cls}" style="left:${x}pt;top:${(y - dy).toFixed(2)}pt;font-size:${size}pt">${spans(text, size, bold, serif)}</div>`;
}
const L = (x0, y0, x1, y1, fill = BARVA) =>
  `<rect x="${x0}" y="${y0}" width="${(x1 - x0).toFixed(2)}" height="${(y1 - y0).toFixed(2)}" fill="${fill}"/>`;
const SVG = rects => `<svg style="position:absolute;left:0;top:0;width:595pt;height:842pt" viewBox="0 0 595 842">${rects}</svg>`;
const IMG = (src, x0, y0, x1, y1) =>
  `<img class="abs" src="${src}" style="left:${x0}pt;top:${y0}pt;width:${(x1 - x0).toFixed(2)}pt;height:${(y1 - y0).toFixed(2)}pt">`;

/* Čísla a data */
const mezery = s => s.replace(/[  ]/g, " ");
const cislo0 = n => mezery(Math.round(Number(n)).toLocaleString("cs-CZ"));                     // 71 376
const cislo2 = n => mezery(Number(n).toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })); // 71 376,00
const mnozstvi = n => mezery(Number(n).toLocaleString("cs-CZ", { maximumFractionDigits: 2 }));   // 0,2 / 37,4
const datum = d => { const x = new Date(d); return `${x.getDate()}.${x.getMonth() + 1}.${x.getFullYear()}`; };

function paticka(strana, celkem) {
  return T(50.0, 801.4, FIRMA.web, { serif: true, size: 7.8, ink: true })
       + T(293.0, 801.4, `${strana}/${celkem}`, { serif: true, size: 7.8, ink: true })
       + T(544.9, 801.4, FIRMA.mail, { serif: true, size: 7.8, ink: true, r: true });
}

async function nactiPisma() {
  await Promise.all(['400 10px "MR Sans"', '700 10px "MR Sans"', '400 10px "MR Serif"'].map(f => document.fonts.load(f, "Aá")));
}
