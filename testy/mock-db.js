/* Zkušební databáze v paměti prohlížeče – stejné funkce jako skutečné napojení na Supabase (app.js → vytvorDb).
   Používá se jen v testech, do aplikace se nedostane. */
window.__ULOZENO__ = { soubory: {}, tabulky: { zakaznici: [], vozidla: [], vlastnictvi: [], zakazky: [], soubory: [], doklady: [], podpisy: [], polozky: [], dily: [], nabidky: [], kalendar: [], dalkove_podpisy: [] }, citac: 7376 };
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
    async servisniKatalog() {
      return { motory: [{ kod: "M110", palivo: "benzin", serizovani_ventilu: true, popis: "6válec DOHC 2.8" }, { kod: "M117", palivo: "benzin", serizovani_ventilu: false, popis: "V8" }, { kod: "OM617", palivo: "diesel", serizovani_ventilu: true, popis: "5válec" }],
        typy: [{ klic: "107.048", motor: "M117" }, { klic: "560 SL", motor: "M117" }, { klic: "126.022", motor: "M110" }],
        ukony: [["olej", "Motorový olej + filtr"], ["servis", "Velký servis (prohlídka)"], ["atf", "Olej + filtr automatu"], ["vzduch", "Vzduchový filtr"], ["svicky", "Zapalovací svíčky", "benzin"], ["palivo", "Palivový filtr"],
          ["brzdy", "Brzdová kapalina"], ["chladici", "Chladicí kapalina"], ["diferencial", "Olej diferenciálu"], ["servo", "Olej servořízení"], ["ventily", "Seřízení ventilů", null, true]]
          .map(([ukon, nazev, jen_palivo = null, jen_serizovani_ventilu = false], i) => ({ ukon, nazev, poradi: i + 1, jen_palivo, jen_serizovani_ventilu })) };
    },
    async dalsiCisloOdhad() { return window.__ULOZENO__.citac + 1; },
    async kalendar(od, doo) { await cekej(); return kopie(T.kalendar.filter(k => k.datum >= od && k.datum <= doo)); },
    async smazatRadek(tab, rid) { await cekej(); T[tab] = T[tab].filter(x => x.id !== rid); window.__ULOZENO__.tabulky[tab] = T[tab]; return [{ id: rid }]; },
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
    async zmenitMajitele(vid, zid) { await cekej(); return this.zapsatVlastnictvi(vid, zid, true); },
    async zapsatVlastnictvi(vid, zid, zmena) {         // jako zapsat_vlastnictvi v databázi
      if (!zid || T.vlastnictvi.some(x => x.vozidlo_id === vid && x.zakaznik_id === zid && !x.vlastni_do)) return;
      const dnes = new Date().toISOString().slice(0, 10);
      if (zmena) { T.vlastnictvi.filter(x => x.vozidlo_id === vid && !x.vlastni_do).forEach(x => { x.vlastni_do = dnes; });
        T.vlastnictvi.push({ id: id(), vozidlo_id: vid, zakaznik_id: zid, vlastni_od: dnes, vlastni_do: null });
        const a = T.vozidla.find(x => x.id === vid); if (a) a.eserviska_kod = id().replace(/-/g, "").slice(0, 20); }
      else if (!T.vlastnictvi.some(x => x.vozidlo_id === vid && !x.vlastni_do)) T.vlastnictvi.push({ id: id(), vozidlo_id: vid, zakaznik_id: zid, vlastni_od: dnes, vlastni_do: null });
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
      else { a = { ...v, vin, id: id(), km_posledni: k.km_prijem, eserviska_kod: id().replace(/-/g, "").slice(0, 20) }; T.vozidla.push(a); }
      await this.zapsatVlastnictvi(a.id, zid, p.zmena_majitele);
      const cislo = ++window.__ULOZENO__.citac;
      const zk = { id: id(), cislo, vozidlo_id: a.id, zakaznik_id: zid, stav: "prijato", ...k };
      T.zakazky.push(zk);
      return { zakazka_id: zk.id, cislo, zakaznik_id: zid, vozidlo_id: a.id };
    },
    async polozky(zid) { return kopie(T.polozky.filter(p => p.zakazka_id === zid).sort((a, b) => a.poradi - b.poradi)); },
    async ulozitPolozky(zid, pol) { await cekej(); if (window.__OFFLINE__) throw new Error("Failed to fetch"); T.polozky = T.polozky.filter(p => p.zakazka_id !== zid).concat(pol.map((p, i) => ({ ...p, zakazka_id: zid, poradi: i + 1 }))); return pol.length; },
    async dily(zid) { return kopie(T.dily.filter(d => d.zakazka_id === zid).sort((a, b) => a.poradi - b.poradi)); },
    async ulozitDily(zid, dily) { await cekej(); if (window.__OFFLINE__) throw new Error("Failed to fetch"); T.dily = T.dily.filter(d => d.zakazka_id !== zid).concat(dily.map((d, i) => ({ ...d, zakazka_id: zid, poradi: i + 1 }))); return dily.length; },
    async dodavatele() { return [{ id: "d1", nazev: "Auto Kelly" }, { id: "d2", nazev: "Granex" }, { id: "d3", nazev: "MB (original)" }, { id: "d4", nazev: "Jiný" }]; },
    async smazatZakazku(zid) {
      const z = T.zakazky.find(x => x.id === zid);
      if (T.doklady.some(d => d.zakazka_id === zid && ["faktura", "zalohova", "opravny"].includes(d.druh))) throw new Error(`Zakázka #${z.cislo} má vystavenou fakturu`);
      for (const t of ["doklady", "polozky", "dily", "nabidky"]) T[t] = T[t].filter(x => x.zakazka_id !== zid);
      T.soubory = T.soubory.filter(x => x.zakazka_id !== zid || x.druh === "tp"); T.zakazky = T.zakazky.filter(x => x.id !== zid);
      if (window.__ULOZENO__.citac === z.cislo) window.__ULOZENO__.citac = Math.max(7376, ...T.zakazky.map(x => x.cislo)); return z.cislo;
    },
    async smazatDoklad(did) {
      const d = T.doklady.find(x => x.id === did); if (!d) throw new Error("Doklad nenalezen");
      if (!["nabidka", "faktura", "zalohova", "predavaci_protokol"].includes(d.druh)) throw new Error("Doklad nejde smazat");
      if (T.doklady.some(x => x.zakazka_id === d.zakazka_id && x.druh === d.druh && x.verze > d.verze)) throw new Error("Smazat jde jen poslední verzi");
      if (d.zaplaceno) throw new Error(`Doklad ${d.cislo} je označený jako zaplacený – nejdřív zrušte úhradu`);
      if (d.druh === "zalohova" && T.doklady.some(x => x.zakazka_id === d.zakazka_id && x.druh === "faktura")) throw new Error(`Záloha ${d.cislo} je odečtená v konečné faktuře – nejdřív smažte fakturu`);
      if (["faktura", "zalohova"].includes(d.druh) && T.doklady.some(x => x.zakazka_id === d.zakazka_id && x.druh === "opravny")) throw new Error(`K zakázce existuje opravný doklad – doklad ${d.cislo} už nejde smazat`);
      T.doklady = T.doklady.filter(x => x.id !== did); T.soubory = T.soubory.filter(x => x.doklad_id !== did && x.id !== d.pdf_soubor_id);
      const z = T.zakazky.find(x => x.id === d.zakazka_id);
      if (!T.doklady.some(x => x.zakazka_id === d.zakazka_id && x.druh === d.druh)) {
        if (d.druh === "faktura" && ["fakturovano", "zaplaceno"].includes(z.stav)) z.stav = "v_praci";
        if (d.druh === "nabidka" && z.stav === "nabidka") z.stav = "prijato";
      }
      return d.cislo;
    },
    async smazatZakaznika(zid) { if (T.zakazky.some(k => k.zakaznik_id === zid)) throw new Error("Zákazník má zakázky"); T.vlastnictvi = T.vlastnictvi.filter(x => x.zakaznik_id !== zid); T.zakaznici = T.zakaznici.filter(x => x.id !== zid); },
    async smazatVozidlo(vid) { if (T.zakazky.some(k => k.vozidlo_id === vid)) throw new Error("Vozidlo má zakázky"); T.vlastnictvi = T.vlastnictvi.filter(x => x.vozidlo_id !== vid); T.soubory = T.soubory.filter(x => x.vozidlo_id !== vid || x.zakazka_id); T.vozidla = T.vozidla.filter(x => x.id !== vid); },
    async ulozitZakaznika(z) {
      await cekej(); if (!z.jmeno) throw new Error("Chybí jméno zákazníka");
      if (z.id) { Object.assign(T.zakaznici.find(c => c.id === z.id), z); return z.id; }
      const nid = id(); T.zakaznici.push({ ...z, id: nid }); return nid;
    },
    async ulozitVozidlo(v, zid) {
      await cekej(); const vin = v.vin.toUpperCase().replace(/\s/g, "");
      let a = T.vozidla.find(x => x.vin === vin);
      if (a) { for (const k in v) if (v[k] != null && k !== "km") a[k] = v[k]; if (v.km != null) a.km_posledni = v.km; }
      else { a = { ...v, vin, id: id(), km_posledni: v.km ?? null, eserviska_kod: id().replace(/-/g, "").slice(0, 20) }; delete a.km; T.vozidla.push(a); }
      if (zid) await this.zapsatVlastnictvi(a.id, zid, v.zmena_majitele);
      return a.id;
    },
    async dokumentyVozidla(vid) { return kopie(T.soubory.filter(s => s.vozidlo_id === vid && s.druh === "tp")); },
    async seznamZakazniku() { return kopie(T.zakaznici.map(z => ({ ...z, vlastnictvi: T.vlastnictvi.filter(v => v.zakaznik_id === z.id).map(v => ({ ...v, vozidla: T.vozidla.find(a => a.id === v.vozidlo_id) })), zakazky: [{ count: T.zakazky.filter(k => k.zakaznik_id === z.id).length }] }))); },
    async zakaznik(zid) { const z = T.zakaznici.find(x => x.id === zid); if (!z) return null;
      return kopie({ ...z, vlastnictvi: T.vlastnictvi.filter(v => v.zakaznik_id === zid).map(v => ({ ...v, vozidla: T.vozidla.find(a => a.id === v.vozidlo_id) })),
        zakazky: T.zakazky.filter(k => k.zakaznik_id === zid).map(k => ({ ...k, vozidla: T.vozidla.find(a => a.id === k.vozidlo_id) })) }); },
    async seznamVozidel() { return kopie(T.vozidla.map(v => ({ ...v, vlastnictvi: T.vlastnictvi.filter(x => x.vozidlo_id === v.id).map(x => ({ ...x, zakaznici: T.zakaznici.find(c => c.id === x.zakaznik_id) })), zakazky: [{ count: T.zakazky.filter(k => k.vozidlo_id === v.id).length }] }))); },
    async vozidlo(vid) { const v = T.vozidla.find(x => x.id === vid); if (!v) return null;
      return kopie({ ...v, vlastnictvi: T.vlastnictvi.filter(x => x.vozidlo_id === vid).map(x => ({ ...x, zakaznici: T.zakaznici.find(c => c.id === x.zakaznik_id) })), zakazky: T.zakazky.filter(k => k.vozidlo_id === vid) }); },
    async vsechnyDoklady() {
      return kopie(T.doklady.map(d => { const z = T.zakazky.find(x => x.id === d.zakazka_id);
        return { ...d, zakazky: z && { id: z.id, cislo: z.cislo, zakaznici: T.zakaznici.find(c => c.id === z.zakaznik_id), vozidla: T.vozidla.find(v => v.id === z.vozidlo_id) },
          soubory: T.soubory.find(s => s.id === d.pdf_soubor_id) }; }).sort((a, b) => b.cislo.localeCompare(a.cislo)));
    },
    async sazby() { return [{ nazev: "Inspekce", kc_za_hodinu: 1200 }, { nazev: "Ostatní práce", kc_za_hodinu: 1500 }]; },
    async nahrat(klic, blob, typ, prubeh) {
      if (S[klic]) throw new Error("The resource already exists");
      if (prubeh) { prubeh(0.4); await new Promise(r => setTimeout(r, 60)); prubeh(0.8); }
      S[klic] = new Uint8Array(await blob.arrayBuffer()); return { path: klic };
    },
    async odkaz(klic) { return URL.createObjectURL(new Blob([S[klic]], { type: klic.endsWith(".pdf") ? "application/pdf" : "image/jpeg" })); },
    async odkazy(klice) { return Promise.all(klice.map(async k => ({ path: k, signedUrl: await this.odkaz(k) }))); },
    async stahnout(klic) { return new Blob([S[klic]]); },
    async kurzEur() { return { kurz: 24.335, datum: "29.10.2026" }; },
    async smazatZaznamSouboru(sid) { await cekej(); T.soubory = T.soubory.filter(x => x.id !== sid); return [{ id: sid }]; },
    async smazatSoubory(telo) { (window.__SMAZANE_SOUBORY__ ||= []).push(telo); return { smazano: (telo.klice || []).length }; },
    async vystavitDoklad(p) {                       // jako vystavit_doklad v databázi: všechno najednou, nebo nic
      await cekej(); if (window.__OFFLINE_DOKLAD__) throw new Error("Failed to fetch");
      const uz = T.doklady.find(x => x.cislo === p.cislo); if (uz) return { ...kopie(uz), uz_existoval: true };
      const ted = new Date().toISOString(), sb = p.soubory.map(x => ({ id: id(), vytvoreno: ted, zakazka_id: p.zakazka_id, vozidlo_id: p.vozidlo_id, druh: x.druh, klic: x.klic, nazev: x.nazev, velikost: x.velikost, mime: x.mime, verejne: false, _role: x.role }));
      const pdf = sb.find(x => x._role === "pdf"), podpis = sb.find(x => x._role === "podpis");
      const d = { id: id(), vytvoreno: ted, zakazka_id: p.zakazka_id, nabidka_id: p.nabidka_id || null, druh: p.druh, verze: p.verze, cislo: p.cislo, variabilni_symbol: p.variabilni_symbol,
        jazyk: p.jazyk, vystaveno: p.vystaveno, splatnost: p.splatnost, data: p.data, pdf_soubor_id: pdf?.id || null, zamceno: true, celkem: p.celkem ?? null, zaplaceno: null, odeslano_uol: null };
      for (const x of sb) { if (x._role === "pdf" || x._role === "priloha") x.doklad_id = d.id; delete x._role; }
      T.soubory.push(...sb); T.doklady.push(d);
      T.podpisy.push(...p.podpisy.map(x => ({ id: id(), doklad_id: d.id, ...x, obrazek_soubor_id: x.role === "zakaznik" ? podpis?.id : null })));
      if (window.__PO_VYSTAVENI_CHYBA__) { window.__PO_VYSTAVENI_CHYBA__ = false; throw new Error("Failed to fetch"); }   // odpověď se ztratila, doklad ale vznikl
      return kopie(d);
    },
    async vlozit(tab, radky) {
      const out = radky.map(r => ({ id: id(), vytvoreno: new Date().toISOString(), ...r }));
      if (tab === "doklady") for (const d of out) if (T.doklady.some(x => x.cislo === d.cislo)) throw new Error("duplicate key value violates unique constraint");
      T[tab].push(...out); return kopie(out);
    },
    async upravit(tab, rid, zmeny) {
      const r = T[tab].find(x => x.id === rid); if (!r) throw new Error("nenalezeno " + tab);
      if (tab === "doklady" && r.zamceno && Object.keys(zmeny).some(k => !["pdf_soubor_id", "odeslano_uol", "zaplaceno"].includes(k))) throw new Error("Doklad je vydaný a nelze ho měnit");
      Object.assign(r, zmeny); return [kopie(r)];
    },
    async detail(zid) {
      await cekej();
      const z = T.zakazky.find(x => x.id === zid); if (!z) return null;
      return kopie({ ...z, vozidla: T.vozidla.find(v => v.id === z.vozidlo_id), zakaznici: T.zakaznici.find(c => c.id === z.zakaznik_id),
        doklady: T.doklady.filter(d => d.zakazka_id === zid).map(d => ({ ...d, soubory: T.soubory.find(s => s.id === d.pdf_soubor_id),
          dalkove_podpisy: T.dalkove_podpisy.filter(x => x.doklad_id === d.id).map(x => ({ ...x, soubory: T.soubory.find(f => f.id === x.soubor_id) })) })),
        soubory: T.soubory.filter(s => s.zakazka_id === zid) });
    }
  };
})();
