/* Převod vykreslené šablony (HTML s absolutními pozicemi v pt) na skutečné vektorové PDF – přímo v prohlížeči.
   Funguje stejně na iPadu (Safari) i v počítači, bez serveru a bez internetu.
   Potřebuje globální PDFLib (pdf-lib 1.17.1) a fontkit (@pdf-lib/fontkit 1.1.1).

   Postup: projde každou stránku <section class="page"> v pořadí, v jakém jsou prvky v HTML, a přenese
   - čáry (SVG <rect>, souřadnice už jsou v pt),
   - obrázky (<img>, včetně object-fit: contain u podpisů),
   - texty (.t) znak po znaku přesně tam, kde je prohlížeč vykreslil – tedy i s mřížkou 0,98 pt jako Excel. */

(function () {
  const PX = 0.75;                 // 1 CSS px = 0,75 pt
  const VYSKA = 842;               // A4 na výšku v pt

  function barva(css) {
    const m = String(css).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (m) return PDFLib.rgb(m[1] / 255, m[2] / 255, m[3] / 255);
    const h = String(css).replace("#", "");
    if (/^[0-9a-f]{6}$/i.test(h)) return PDFLib.rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
    return PDFLib.rgb(0, 0, 0);
  }

  async function bajty(url, base) {
    if (url.startsWith("data:")) {
      const b64 = url.slice(url.indexOf(",") + 1);
      const bin = atob(b64), out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    const r = await fetch(new URL(url, base));
    if (!r.ok) throw new Error(`Nelze načíst ${url}`);
    return new Uint8Array(await r.arrayBuffer());
  }

  /* doc = Document s vykreslenou šablonou; meta = { nazev, predmet } */
  async function dokumentDoPdf(doc, meta = {}) {
    const { PDFDocument } = PDFLib;
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const base = doc.baseURI;

    await doc.fonts.ready;
    await Promise.all([...doc.images].map(i => i.complete ? null : i.decode().catch(() => null)));

    const pisma = {};
    const soubor = { "sans-400": "LiberationSans-Regular", "sans-700": "LiberationSans-Bold", "serif-400": "LiberationSerif-Regular", "serif-700": "LiberationSerif-Regular",
                     "calibri-400": "Carlito-Regular", "calibri-700": "Carlito-Bold" };
    async function pismo(rodina, vaha) {
      const r = /calibri/i.test(rodina) ? "calibri" : /serif/i.test(rodina) && !/sans/i.test(rodina) ? "serif" : "sans";
      const k = `${r}-${Number(vaha) >= 600 ? 700 : 400}`;
      // Carlito se při podmnožině písma rozbije (chybějící znaky) → vkládá se celé
      if (!pisma[k]) pisma[k] = pdf.embedFont(await bajty(`assets/fonts/${soubor[k]}.ttf`, base), { subset: r !== "calibri" });
      return pisma[k];
    }
    const obrazky = {};
    async function obrazek(src) {
      if (!obrazky[src]) obrazky[src] = (async () => {
        const b = await bajty(src, base);
        const jpg = b[0] === 0xff && b[1] === 0xd8;
        return jpg ? pdf.embedJpg(b) : pdf.embedPng(b);
      })();
      return obrazky[src];
    }

    for (const sekce of doc.querySelectorAll("section.page")) {
      const strana = pdf.addPage([595, VYSKA]);
      const p0 = sekce.getBoundingClientRect();
      const X = px => (px - p0.left) * PX;
      const Y = px => VYSKA - (px - p0.top) * PX;

      for (const el of sekce.querySelectorAll("svg, img, .t")) {
        if (el.tagName.toLowerCase() === "svg") {
          for (const r of el.querySelectorAll("rect")) {
            const x = +r.getAttribute("x"), y = +r.getAttribute("y"), w = +r.getAttribute("width"), h = +r.getAttribute("height");
            strana.drawRectangle({ x, y: VYSKA - y - h, width: w, height: h, color: barva(r.getAttribute("fill")) });
          }
        } else if (el.tagName.toLowerCase() === "img") {
          if (!el.naturalWidth) continue;                       // obrázek se nenačetl → vynechat
          const r = el.getBoundingClientRect();
          let x = X(r.left), w = r.width * PX, h = r.height * PX, yTop = (r.top - p0.top) * PX;
          if (getComputedStyle(el).objectFit === "contain") {   // podpis: zachovat poměr stran, na střed
            const s = Math.min(w / el.naturalWidth, h / el.naturalHeight);
            const w2 = el.naturalWidth * s, h2 = el.naturalHeight * s;
            x += (w - w2) / 2; yTop += (h - h2) / 2; w = w2; h = h2;
          }
          strana.drawImage(await obrazek(el.getAttribute("src")), { x, y: VYSKA - yTop - h, width: w, height: h });
        } else {
          // účaří řádku: prázdný inline-block sedí spodkem přesně na účaří
          const m = doc.createElement("span");
          m.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
          el.appendChild(m);
          const ucari = Y(m.getBoundingClientRect().bottom);
          m.remove();
          for (const s of el.querySelectorAll("span")) {
            if (s.children.length) continue;
            const ch = s.textContent.replace(/ /g, " ");
            if (!ch.trim()) continue;
            const cs = getComputedStyle(s);
            strana.drawText(ch, {
              x: X(s.getBoundingClientRect().left), y: ucari,
              size: parseFloat(cs.fontSize) * PX,
              font: await pismo(cs.fontFamily, cs.fontWeight),
              color: barva(cs.color)
            });
          }
        }
      }
    }

    pdf.setTitle(meta.nazev || doc.title || "Mercedes Restorations");
    pdf.setAuthor("Mercedes Restorations, s. r. o.");
    pdf.setCreator("Werkplaats");
    pdf.setProducer("Werkplaats");
    if (meta.predmet) pdf.setSubject(meta.predmet);
    return pdf.save();
  }

  /* SHA-256 otisk PDF (pro podpisy – dokazuje, že se dokument po podpisu nezměnil) */
  async function otisk(bytes) {
    const h = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  window.dokumentDoPdf = dokumentDoPdf;
  window.otiskPdf = otisk;
})();
