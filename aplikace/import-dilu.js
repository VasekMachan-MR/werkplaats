/* Import dílů z e-mailů dodavatelů – pevný převodník (bez AI, zdarma, funguje i bez internetu).
   Umí:
   1. Auto Kelly / LKQ – CSV příloha faktury (4126…csv)          → nejpřesnější, skutečně zaplacené ceny
   2. Auto Kelly / LKQ – text e-mailu „Faktura 4126…“
   3. Auto Kelly – e-mail „Přijali jsme Vaši objednávku…“ (e-shop)
   4. Landsmann – e-mail „informace o objednávce č. Z…“
   5. cokoli dalšího po řádcích: tabulka zkopírovaná z Excelu / webu, nebo „číslo název 2 ks 450 Kč“ (odhad – zkontrolovat)
   Ceny se berou S DPH – firma není plátce DPH, takže DPH je pro ni náklad.
   Výsledek: { dodavatel: "Auto Kelly" | null, format, polozky: [{ nazev, cislo, mnozstvi, cena (za 1 ks), mena, odhad }] } */

(function (koren) {
  const cislo = s => {
    if (s == null) return null;
    let t = String(s).replace(/[\s ]/g, "").replace(/(Kč|CZK|EUR|€|,-)$/i, "");
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "");      // 1.234,50
    t = t.replace(",", ".");
    const n = Number(t);
    return t === "" || !isFinite(n) ? null : n;
  };
  const zaokr = n => Math.round(n * 100) / 100;
  const cistyRadek = s => s.replace(/\[([^\]]*)\]\((https?:[^)]*)\)/g, "$1")          // [text](url) → text
                           .replace(/\[?https?:\/\/\S+\]?/g, "")                       // holé odkazy
                           .replace(/\*\*/g, "").replace(/ /g, " ").trim();

  function poznejDodavatele(t) {
    if (/auto\s?kelly|lkq/i.test(t)) return "Auto Kelly";
    if (/granex/i.test(t)) return "Granex";
    if (/landsmann/i.test(t)) return "Landsmann";
    if (/pneuboss/i.test(t)) return "Pneuboss";
    return null;
  }

  /* 1) LKQ CSV: hlavička „Cislo;Kod;Nazev;Mnozstvi;…;Celkem s DPH;…“ */
  function lkqCsv(t) {
    const radky = t.split(/\r?\n/);
    const h = radky.findIndex(r => /^\s*Cislo;Kod;Nazev;Mnozstvi/i.test(r));
    if (h < 0) return null;
    const sl = radky[h].split(";").map(s => s.trim().toLowerCase());
    const k = n => sl.findIndex(s => s === n);
    const iKod = k("kod"), iNaz = k("nazev"), iMn = k("mnozstvi"), iCelk = k("celkem s dph"), iKs = k("cena/ks"), iDph = k("dph (%)");
    const out = [];
    for (const r of radky.slice(h + 1)) {
      if (!/^\s*\d+;/.test(r)) break;
      const c = r.split(";");
      const mn = cislo(c[iMn]) || 1;
      let cena = iCelk >= 0 ? cislo(c[iCelk]) / mn : null;
      if (cena == null && iKs >= 0) cena = cislo(c[iKs]) * (1 + (cislo(c[iDph]) || 0) / 100);
      out.push({ nazev: c[iNaz].trim(), cislo: c[iKod].trim(), mnozstvi: mn, cena: cena == null ? null : zaokr(cena), mena: "CZK" });
    }
    return out.length ? { format: "Auto Kelly – CSV faktury", polozky: out } : null;
  }

  /* 2) LKQ faktura v těle e-mailu: „1.  LO 00596 / Sada ložiska kola STARLINE  1  21%  319.00  385.99“ */
  function lkqFaktura(t) {
    const re = /^\s*\d+\.\s+(.+?)\s+\/\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+)\s*%\s+(\d[\d\s]*[.,]\d{2})\s+(\d[\d\s]*[.,]\d{2})\s*$/;
    const out = [];
    for (const r of t.split(/\r?\n/)) {
      const m = r.match(re); if (!m) continue;
      const mn = cislo(m[3]) || 1;
      out.push({ nazev: m[2].trim(), cislo: m[1].trim(), mnozstvi: mn, cena: zaokr(cislo(m[6]) / mn), mena: "CZK" });
    }
    return out.length ? { format: "Auto Kelly – faktura z e-mailu", polozky: out } : null;
  }

  /* 3) Auto Kelly e-shop: bloky  název / kód / ks / „386 Kč“ / dostupné od  (po řádcích nebo buňkách tabulky) */
  function akObjednavka(t) {
    if (!/Cena s DPH/i.test(t) || !/Ks/.test(t)) return null;
    const b = t.split(/\r?\n|\t/).map(cistyRadek).filter(Boolean);
    const jeKs = s => /^\d+(?:[.,]\d+)?$/.test(s);
    const jeKc = s => /^\d[\d\s]*(?:,\d+)?\s*Kč$/.test(s);
    const out = [];
    for (let i = 0; i + 3 < b.length; i++) {
      if (jeKs(b[i + 2]) && jeKc(b[i + 3]) && !/^(Název|Ks|Cena)/i.test(b[i]) && !jeKc(b[i]) && !jeKs(b[i])) {
        out.push({ nazev: b[i], cislo: b[i + 1], mnozstvi: cislo(b[i + 2]) || 1, radkova: cislo(b[i + 3]), mena: "CZK" });
        i += 3;
      }
    }
    if (!out.length) return null;
    // je „Cena s DPH“ za kus, nebo za řádek? Rozhodne součet „Cena celkem“.
    const celkem = cislo((t.match(/Cena celkem:?\**\s*\**\s*([\d\s]+(?:,\d+)?)\s*Kč/i) || [])[1]);
    const sumaRadku = out.reduce((s, p) => s + p.radkova, 0), sumaKusu = out.reduce((s, p) => s + p.radkova * p.mnozstvi, 0);
    const zaKus = celkem != null && Math.abs(sumaKusu - celkem) < 1 && Math.abs(sumaRadku - celkem) >= 1;
    return { format: "Auto Kelly – potvrzení objednávky", polozky: out.map(({ radkova, ...p }) => ({ ...p, cena: zaokr(zaKus ? radkova : radkova / p.mnozstvi) })) };
  }

  /* 4) Landsmann: „Kód Popis Počet Mj Cena s DPH Celkem s DPH  880-423030M  Hlavice … 1.00 ks 371.03 371.03“ */
  function landsmann(t) {
    const z = t.search(/Kód\s+Popis\s+Počet/i); if (z < 0) return null;
    let usek = t.slice(z).replace(/^Kód\s+Popis\s+Počet\s+Mj\s+Cena s DPH\s+Celkem s DPH/i, "");
    const k = usek.search(/Celková hodnota/i); if (k > 0) usek = usek.slice(0, k);
    usek = cistyRadek(usek.split(/\r?\n/).map(cistyRadek).join(" ")).replace(/\s+/g, " ");
    const re = /(\S*\d\S*)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(ks|l|kg|m|sada|pár|bal|kpl)\s+(\d[\d ]*[.,]\d{2})\s+(\d[\d ]*[.,]\d{2})/gi;
    const out = []; let m;
    while ((m = re.exec(usek))) out.push({ nazev: m[2].trim(), cislo: m[1], mnozstvi: cislo(m[3]) || 1, cena: zaokr(cislo(m[5])), mena: "CZK" });
    return out.length ? { format: "Landsmann – objednávka", polozky: out } : null;
  }

  /* 5) obecně po řádcích – odhad */
  const RE_MB = /\b[AN]\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2}(?:\s?\d{2})?\b|\b[AN]\d{10,12}\b/;
  function obecne(t) {
    const out = [];
    for (let r of t.split(/\r?\n/)) {
      r = cistyRadek(r); if (!r) continue;
      if (/^(celkem|mezisoučet|doprava|dph|total|subtotal|sum)/i.test(r)) continue;
      const cells = r.split(/\t|;|\s{3,}/).map(s => s.trim()).filter(Boolean);
      // cena: poslední částka na řádku (s Kč/€ nebo s desetinnou částí)
      const ceny = [...r.matchAll(/(\d[\d  .]*(?:[.,]\d{1,2})?)\s*(Kč|CZK|EUR|€|,-)|(\d[\d  ]*[.,]\d{2})(?!\d)/gi)];
      if (!ceny.length) continue;
      const posl = ceny[ceny.length - 1];
      const cena = cislo(posl[1] || posl[3]);
      if (cena == null || cena <= 0) continue;
      const mena = /EUR|€/i.test(posl[2] || r) ? "EUR" : "CZK";
      let zbytek = r.slice(0, posl.index).trim();
      // množství: „2 ks“ / „2x“ / „2 ×“, nebo samostatná malá celá buňka
      let mn = null;
      const mk = zbytek.match(/(\d+(?:[.,]\d+)?)\s*(ks|x|×|pcs|pc|kus[uůy]?)\b/i);
      if (mk) { mn = cislo(mk[1]); zbytek = (zbytek.slice(0, mk.index) + " " + zbytek.slice(mk.index + mk[0].length)).trim(); }
      else {
        const sam = cells.find(c => /^\d{1,3}$/.test(c));
        if (sam && cells.length >= 3) { mn = Number(sam); zbytek = zbytek.replace(new RegExp(`(^|\\s)${sam}(\\s|$)`), " ").trim(); }
      }
      // předchozí částky na řádku (např. cena za ks před celkem) – když sedí s množstvím, vezmi cenu za ks
      let cenaKs = cena;
      if (ceny.length >= 2 && mn && mn > 1) {
        const pred = cislo(ceny[ceny.length - 2][1] || ceny[ceny.length - 2][3]);
        if (pred && Math.abs(pred * mn - cena) < 1) cenaKs = pred;
        else cenaKs = cena / mn;
      }
      zbytek = zbytek.replace(/(\d[\d  ]*[.,]\d{2})\s*(Kč|CZK|EUR|€)?/gi, " ").replace(/\b\d{1,2}\s?%/g, " ").replace(/\s+/g, " ").trim();
      // číslo dílu: MB formát, jinak první „slovo“ s číslicí
      let kod = "";
      const mb = zbytek.match(RE_MB);
      if (mb) kod = mb[0];
      else { const w = zbytek.split(/\s+/).find(s => /\d/.test(s) && /[A-Za-z-]/.test(s) && s.length >= 4); if (w) kod = w; }
      if (kod) zbytek = zbytek.replace(kod, " ");
      const nazev = zbytek.replace(/^[\s\/|,;:–-]+|[\s\/|,;:–-]+$/g, "").replace(/\s+/g, " ");
      if (!nazev && !kod) continue;
      out.push({ nazev, cislo: kod.replace(/\s+/g, " ").trim(), mnozstvi: mn || 1, cena: zaokr(cenaKs), mena, odhad: true });
    }
    return out.length ? { format: "obecný text – zkontrolujte", polozky: out } : null;
  }

  function rozeberDily(text) {
    const t = String(text || "").replace(/\r\n/g, "\n");
    const dodavatel = poznejDodavatele(t);
    for (const f of [lkqCsv, lkqFaktura, akObjednavka, landsmann, obecne]) {
      const r = f(t);
      if (r) return { dodavatel, ...r };
    }
    return { dodavatel, format: null, polozky: [] };
  }

  koren.rozeberDily = rozeberDily;
  if (typeof module !== "undefined") module.exports = { rozeberDily };
})(typeof window !== "undefined" ? window : globalThis);
