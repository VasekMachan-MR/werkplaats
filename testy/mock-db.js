/* Zkušební databáze v paměti prohlížeče – stejné funkce jako skutečné napojení na Supabase (app.js → vytvorDb).
   Používá se jen v testech, do aplikace se nedostane. */
window.__ULOZENO__ = { soubory: {}, tabulky: { zakaznici: [], vozidla: [], vlastnictvi: [], zakazky: [], soubory: [], doklady: [], podpisy: [] }, citac: 7376 };
window.__WERK_DB__ = (() => {
  const T = window.__ULOZENO__.tabulky, S = window.__ULOZENO__.soubory;
  const id = () => crypto.randomUUID();
  const kopie = o => JSON.parse(JSON.stringify(o));
  const cekej = () => new Promise(r => setTimeout(r, 30));
  const PODPIS = window.__TEST_PODPIS__ || null;
  const LIDE = window.__ULOZENO__.lide = [
    { id: "u1", jmeno: "Václav Macháň", email: "info@example.cz", role: "majitel", aktivni: true, podpis_obrazek: null },
    { id: "u2", jmeno: "Petr Mechanik", email: "petr@example.cz", role: "mechanik", aktivni: true, podpis_obrazek: null }
  ];
  return {
    async relace() { return { user: { id: window.__TEST_UZIVATEL__ || "u1" } }; },
    naZmenuPrihlaseni() {},
    async prihlasit() { return {}; }, async odhlasit() {}, async obnovitHeslo() {}, async noveHeslo() {},
    async clen(uid) { return kopie(LIDE.find(u => u.id === uid) || null); },
    async uzivatele() { return kopie(LIDE); },
    async ulozitMujPodpis(uid, obrazek) { LIDE.find(u => u.id === uid).podpis_obrazek = obrazek; return [{ id: uid }]; },
    async ulozitMojeJmeno(uid, jmeno) { LIDE.find(u => u.id === uid).jmeno = jmeno; return [{ id: uid }]; },
    async sprava(b) {
      if (b.akce === "pridat") { if (LIDE.some(u => u.email === b.email)) throw new Error("Účet s tímto e-mailem už existuje"); LIDE.push({ id: id(), jmeno: b.jmeno, email: b.email, role: b.role, aktivni: true, podpis_obrazek: null }); return { ok: true }; }
      if (b.akce === "aktivni") { LIDE.find(u => u.id === b.id).aktivni = b.aktivni; return { ok: true }; }
      return { ok: true };
    },
    async podpisVyhotovil() { return PODPIS ? { jmeno: "Václav Macháň", obrazek: PODPIS } : null; },
    async dalsiCisloOdhad() { return window.__ULOZENO__.citac + 1; },
    async zakazky() {
      await cekej();
      return kopie(T.zakazky.map(z => ({ ...z, vozidla: T.vozidla.find(v => v.id === z.vozidlo_id), zakaznici: T.zakaznici.find(c => c.id === z.zakaznik_id) }))
        .sort((a, b) => b.cislo - a.cislo));
    },
    async hledatZakazniky(q) {
      await cekej(); const t = q.toLowerCase();
      return kopie(T.zakaznici.filter(z => [z.jmeno, z.telefon, z.email].some(x => String(x || "").toLowerCase().includes(t)))
        .map(z => ({ ...z, vlastnictvi: T.vlastnictvi.filter(v => v.zakaznik_id === z.id).map(v => ({ ...v, vozidla: T.vozidla.find(a => a.id === v.vozidlo_id) })) })));
    },
    async vozidloPodleVin(vin) {
      await cekej();
      const a = T.vozidla.find(v => v.vin === vin.toUpperCase().replace(/\s/g, ""));
      if (!a) return null;
      return kopie({ ...a, vlastnictvi: T.vlastnictvi.filter(v => v.vozidlo_id === a.id).map(v => ({ ...v, zakaznici: T.zakaznici.find(c => c.id === v.zakaznik_id) })),
        zakazky: T.zakazky.filter(z => z.vozidlo_id === a.id) });
    },
    async zalozitZakazku(p) {
      await cekej();
      const z = p.zakaznik, v = p.vozidlo, k = p.zakazka;
      let zid = z.id;
      if (zid) Object.assign(T.zakaznici.find(c => c.id === zid), z);
      else { zid = id(); T.zakaznici.push({ ...z, id: zid }); }
      const vin = v.vin.toUpperCase().replace(/\s/g, "");
      let a = T.vozidla.find(x => x.vin === vin);
      if (a) { for (const key in v) if (v[key] != null) a[key] = v[key]; if (k.km_prijem != null) a.km_posledni = k.km_prijem; }
      else { a = { ...v, vin, id: id(), km_posledni: k.km_prijem }; T.vozidla.push(a); }
      if (!T.vlastnictvi.some(x => x.vozidlo_id === a.id && x.zakaznik_id === zid && !x.vlastni_do)) T.vlastnictvi.push({ id: id(), vozidlo_id: a.id, zakaznik_id: zid, vlastni_od: k.datum_prijmu, vlastni_do: null });
      const cislo = ++window.__ULOZENO__.citac;
      const zk = { id: id(), cislo, vozidlo_id: a.id, zakaznik_id: zid, stav: "prijato", ...k };
      T.zakazky.push(zk);
      return { zakazka_id: zk.id, cislo, zakaznik_id: zid, vozidlo_id: a.id };
    },
    async nahrat(klic, blob, typ, prubeh) {
      if (S[klic]) throw new Error("The resource already exists");
      if (prubeh) { prubeh(0.4); await new Promise(r => setTimeout(r, 60)); prubeh(0.8); }
      S[klic] = new Uint8Array(await blob.arrayBuffer()); return { path: klic };
    },
    async odkaz(klic) { return URL.createObjectURL(new Blob([S[klic]], { type: klic.endsWith(".pdf") ? "application/pdf" : "image/jpeg" })); },
    async odkazy(klice) { return Promise.all(klice.map(async k => ({ path: k, signedUrl: await this.odkaz(k) }))); },
    async stahnout(klic) { return new Blob([S[klic]]); },
    async vlozit(tab, radky) {
      const out = radky.map(r => ({ id: id(), vytvoreno: new Date().toISOString(), ...r }));
      if (tab === "doklady") for (const d of out) if (T.doklady.some(x => x.cislo === d.cislo)) throw new Error("duplicate key value violates unique constraint");
      T[tab].push(...out); return kopie(out);
    },
    async upravit(tab, rid, zmeny) { const r = T[tab].find(x => x.id === rid); Object.assign(r, zmeny); return [kopie(r)]; },
    async detail(zid) {
      await cekej();
      const z = T.zakazky.find(x => x.id === zid); if (!z) return null;
      return kopie({ ...z, vozidla: T.vozidla.find(v => v.id === z.vozidlo_id), zakaznici: T.zakaznici.find(c => c.id === z.zakaznik_id),
        doklady: T.doklady.filter(d => d.zakazka_id === zid).map(d => ({ ...d, soubory: T.soubory.find(s => s.id === d.pdf_soubor_id) })),
        soubory: T.soubory.filter(s => s.zakazka_id === zid) });
    }
  };
})();
