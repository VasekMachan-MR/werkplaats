/* Zkušební databáze v paměti prohlížeče – stejné funkce jako skutečné napojení na Supabase (app.js → vytvorDb).
   Používá se jen v testech, do aplikace se nedostane. */
window.__ULOZENO__ = { soubory: {}, tabulky: { zakaznici: [], vozidla: [], vlastnictvi: [], zakazky: [], soubory: [], doklady: [], podpisy: [], polozky: [], dily: [], nabidky: [], kalendar: [], dalkove_podpisy: [], sklad: [], sklad_pohyby: [], preklady: [] }, citac: 7376 };
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
  // sklad jako v databázi (033_sklad.sql): klíč = číslo dílu bez mezer, jinak název
  const klicSkladu = p => { const c = String(p.cislo_mb || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return c ? "c:" + c : "n:" + String(p.nazev || "").trim().toLowerCase(); };
  function pohyb(p) {
    const s = T.sklad.find(x => x.id === p.sklad_id); if (!s) return;
    T.sklad_pohyby.push({ id: id(), cas: new Date().toISOString(), ...p });
    s.mnozstvi = Math.round(((Number(s.mnozstvi) || 0) + Number(p.zmena)) * 100) / 100;
    if (p.druh === "prijem" && p.cena != null) s.nakupni_cena = p.cena;
    if (p.druh === "inventura") s.inventura = new Date().toISOString().slice(0, 10);
  }
  function katalogZDilu(d, o) {                        // trigger dil_do_katalogu
    if (!d.ze_skladu || !d.sklad_id) {
      const k = klicSkladu(d);
      if (k === "n:" || k === "n:(bez názvu)") { d.sklad_id = null; return d; }
      let s = T.sklad.find(x => x.klic === k);
      if (!s) { s = { id: id(), nazev: String(d.nazev).trim(), cislo_mb: d.cislo_mb || null, vyrobce: d.vyrobce || null, puvod: d.puvod || null, jednotka: d.jednotka || "ks", mnozstvi: 0, klic: k }; T.sklad.push(s); }
      d.sklad_id = s.id;
    }
    const s = T.sklad.find(x => x.id === d.sklad_id);
    if (s && !d.ze_skladu && (!o || o.nakupni_cena !== d.nakupni_cena || o.dodavatel_id !== d.dodavatel_id || o.sklad_id !== d.sklad_id)) {
      if (d.nakupni_cena > 0) s.nakupni_cena = Math.round(d.nakupni_cena * (Number(d.kurz) || 1) * 100) / 100;
      s.dodavatel_id = d.dodavatel_id || s.dodavatel_id; s.vyrobce = s.vyrobce || d.vyrobce || null; s.puvod = s.puvod || d.puvod || null;
    }
    return d;
  }
  return {
    async relace() { return { user: { id: window.__TEST_UZIVATEL__ || "u1" } }; },
    naZmenuPrihlaseni() {},
    async prihlasit() { return {}; },
    // dvoufázové přihlášení: výchozí = ověřeno; testy přepnou přes window.__TEST_MFA__ ("nastavit" | "overit")
    async mfaStav() { const r = window.__TEST_MFA__; return { uroven: r ? "aal1" : "aal2", overeno: r === "nastavit" ? null : { id: "f1" }, neovereno: [], naposledy: r ? 0 : Date.now() }; },
    async mfaNastavit() { return { id: "f-novy", totp: { qr_code: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/Werkplaats?secret=JBSWY3DPEHPK3PXP" } }; },
    async mfaOverit(fid, kod) { if (kod !== "123456") throw new Error("Invalid TOTP code entered"); window.__TEST_MFA__ = null; window.__MFA_OVERENO__ = fid; return {}; }, async odhlasit() {}, async obnovitHeslo() {}, async noveHeslo() {},
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
        ukony: [["olej", "Motorový olej + filtr"], ["servis", "Velký servis (prohlídka)"], ["atf", "Olej automatické převodovky + filtr", null, false, "automat"], ["manual", "Olej manuální převodovky", null, false, "manual"], ["vzduch", "Vzduchový filtr"], ["svicky", "Zapalovací svíčky", "benzin"], ["palivo", "Palivový filtr"],
          ["brzdy", "Brzdová kapalina"], ["chladici", "Chladicí kapalina"], ["diferencial", "Olej diferenciálu"], ["servo", "Olej servořízení"], ["ventily", "Seřízení ventilů", null, true]]
          .map(([ukon, nazev, jen_palivo = null, jen_serizovani_ventilu = false, jen_prevodovka = null], i) => ({ ukon, nazev, poradi: i + 1, jen_palivo, jen_serizovani_ventilu, jen_prevodovka })) };
    },
    // koncept příjmu „na serveru“: přežije obnovení stránky (sessionStorage), jako skutečná databáze
    async koncept() { await cekej(); if (window.__OFFLINE__) throw new Error("Failed to fetch"); const k = sessionStorage.getItem("mock-koncept"); return k ? JSON.parse(k) : null; },
    async ulozitKoncept(data) { await cekej(); if (window.__OFFLINE__) throw new Error("Failed to fetch"); sessionStorage.setItem("mock-koncept", JSON.stringify({ data, upraveno: new Date().toISOString() })); return [{}]; },
    async smazatKoncept() { await cekej(); sessionStorage.removeItem("mock-koncept"); },
    async odeslatEmail(doklad_id) { await cekej(); const d = T.doklady.find(x => x.id === doklad_id); const z = d && T.zakazky.find(x => x.id === d.zakazka_id); const c = z && T.zakaznici.find(x => x.id === z.zakaznik_id);
      const podepsano = T.podpisy.some(x => x.doklad_id === doklad_id && x.role === "zakaznik") || T.dalkove_podpisy.some(x => x.doklad_id === doklad_id);
      const ucel = d?.druh + (!podepsano && d?.data?.cekaPodpis ? "_podpis" : "");
      (window.__ULOZENO__.emaily ||= []).push({ doklad_id, komu: c?.email || null, ucel, stav: c?.email ? "odeslano" : "chyba", zmeneno: new Date().toISOString() });
      return c?.email ? { ok: true, komu: c.email, stav: "odeslano" } : { ok: false, stav: "chyba", chyba: "Zákazník nemá platný e-mail." }; },
    odeslatZakazkovyList(doklad_id) { return this.odeslatEmail(doklad_id); },
    async dalsiCisloOdhad() { return window.__ULOZENO__.citac + 1; },
    async katalogVozu() { return kopie(window.__KATALOG__ || []); },
    async vsechnyDily() {
      await cekej();
      return kopie(T.dily.filter(d => d.stav !== "nepouzito").map(d => { const z = T.zakazky.find(x => x.id === d.zakazka_id); return { ...d, zakazky: z && { ...z, vozidla: T.vozidla.find(v => v.id === z.vozidlo_id) } }; }));
    },
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
    async ulozitDily(zid, dily) {
      await cekej(); if (window.__OFFLINE__) throw new Error("Failed to fetch");
      const stare = T.dily.filter(d => d.zakazka_id === zid), nove = dily.map((d, i) => katalogZDilu({ ...d, zakazka_id: zid, poradi: i + 1 }, stare.find(x => x.id === d.id)));
      const vydej = d => d && d.ze_skladu && d.sklad_id && d.stav !== "nepouzito" ? Number(d.mnozstvi) || 0 : 0;   // jako trigger sklad_z_dilu
      for (const d of nove) { const o = stare.find(x => x.id === d.id), r = o && o.sklad_id === d.sklad_id ? vydej(o) - vydej(d) : 0;
        if (r) pohyb({ sklad_id: d.sklad_id, druh: "zakazka", zmena: r, zakazka_id: zid, dil_id: d.id });
        if (!o || o.sklad_id !== d.sklad_id) { if (vydej(o)) pohyb({ sklad_id: o.sklad_id, druh: "zakazka", zmena: vydej(o), zakazka_id: zid }); if (vydej(d)) pohyb({ sklad_id: d.sklad_id, druh: "zakazka", zmena: -vydej(d), zakazka_id: zid, dil_id: d.id }); } }
      for (const o of stare) if (!nove.some(d => d.id === o.id) && vydej(o)) pohyb({ sklad_id: o.sklad_id, druh: "zakazka", zmena: vydej(o), zakazka_id: zid });
      T.dily = T.dily.filter(d => d.zakazka_id !== zid).concat(nove); return dily.length;
    },
    async preklady() { await cekej(); return kopie(T.preklady.map(r => ({ klic: r.klic, en: r.en }))); },
    async ulozitPreklady(radky) { await cekej(); for (const r of radky) { T.preklady = T.preklady.filter(x => x.klic !== r.klic); T.preklady.push({ ...r }); } return radky.map(r => ({ klic: r.klic })); },
    async sklad() { await cekej(); return kopie(T.sklad).sort((a, b) => a.nazev.localeCompare(b.nazev, "cs")); },
    async pohybySkladu(sid) { await cekej(); return kopie(T.sklad_pohyby.filter(p => p.sklad_id === sid).map(p => ({ ...p, zakazky: T.zakazky.find(z => z.id === p.zakazka_id) || null, soubory: T.soubory.find(f => f.id === p.soubor_id) || null })).reverse()); },
    async prirazeniFakturyPrijmu(pid, fid) { await cekej(); const po = T.sklad_pohyby.find(x => x.id === pid && x.druh === "prijem"); if (!po) throw new Error("Příjem na sklad nenalezen"); po.soubor_id = fid; },
    async fakturySkladu() { await cekej(); return kopie(T.soubory.filter(f => f.druh === "nakupni_doklad" && f.faze === "sklad" && !f.smazano).reverse()); },
    async fakturyPrijmu() { await cekej(); return kopie(T.sklad_pohyby.filter(p => p.druh === "prijem" && p.soubor_id).map(p => ({ sklad_id: p.sklad_id, cas: p.cas, soubory: T.soubory.find(f => f.id === p.soubor_id) || null })).reverse()); },
    async novaPolozkaSkladu(p) { await cekej(); const k = klicSkladu(p); if (T.sklad.some(x => x.klic === k)) throw new Error('duplicate key value violates unique constraint "sklad_klic"');
      const r = { id: id(), jednotka: "ks", mnozstvi: 0, ...p, klic: k }; T.sklad.push(r); return kopie(r); },
    async pohybSkladu(p) { await cekej(); pohyb(p); return [{}]; },
    async inventura(sid, stav) { await cekej(); const s = T.sklad.find(x => x.id === sid), r = stav - s.mnozstvi; if (r) pohyb({ sklad_id: sid, druh: "inventura", zmena: r }); else s.inventura = new Date().toISOString().slice(0, 10); return r; },
    async dodavatele() { return [{ id: "d1", nazev: "Auto Kelly" }, { id: "d2", nazev: "Granex" }, { id: "d3", nazev: "MB (original)" }, { id: "d4", nazev: "Jiný" }]; },
    async smazatZakazku(zid) {
      const z = T.zakazky.find(x => x.id === zid);
      if (T.doklady.some(d => d.zakazka_id === zid && ["faktura", "zalohova", "opravny"].includes(d.druh))) throw new Error(`Zakázka #${z.cislo} má vystavenou fakturu`);
      for (const t of ["doklady", "polozky", "dily", "nabidky"]) T[t] = T[t].filter(x => x.zakazka_id !== zid);
      T.soubory.forEach(x => { if (x.zakazka_id === zid && x.druh === "foto" && x.faze === "profil") x.zakazka_id = null; });   // jako v databázi: profilovky zůstanou u auta
      T.soubory = T.soubory.filter(x => x.zakazka_id !== zid || x.druh === "tp"); T.zakazky = T.zakazky.filter(x => x.id !== zid);
      if (window.__ULOZENO__.citac === z.cislo) window.__ULOZENO__.citac = Math.max(7376, ...T.zakazky.map(x => x.cislo)); return z.cislo;
    },
    async nahraditNepodepsaneListy(zid) {           // jako 039 v databázi
      await cekej(); const ids = T.doklady.filter(d => d.zakazka_id === zid && d.druh === "zakazkovy_list"
        && d.data?.cekaPodpis && !T.podpisy.some(x => x.doklad_id === d.id && x.role === "zakaznik") && !T.dalkove_podpisy.some(x => x.doklad_id === d.id)).map(d => d.id);
      T.soubory.forEach(f => { if (ids.includes(f.doklad_id) || T.doklady.some(d => ids.includes(d.id) && d.pdf_soubor_id === f.id)) { f.doklad_id = null; f.smazano ||= new Date().toISOString(); } });
      T.podpisy = T.podpisy.filter(x => !ids.includes(x.doklad_id)); window.__ULOZENO__.tabulky.podpisy = T.podpisy;
      T.doklady = T.doklady.filter(d => !ids.includes(d.id)); window.__ULOZENO__.tabulky.doklady = T.doklady;
      return ids.length;
    },
    async kliceSouboruDokladu(did) { return T.soubory.filter(f => f.doklad_id === did).map(f => f.klic); },
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
    async profilovkyVozu(vid) { return kopie(T.soubory.filter(s => s.vozidlo_id === vid && s.druh === "foto" && s.faze === "profil" && !s.smazano)); },
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
    async prijateFaktury(od, doo) {
      await cekej();
      return kopie(T.soubory.filter(s => s.druh === "nakupni_doklad" && !s.smazano && String(s.vytvoreno) >= od && String(s.vytvoreno) < doo).map(s => {
        const z = T.zakazky.find(x => x.id === s.zakazka_id), d = T.dily.find(x => s.faze === "dil:" + x.id);
        return { ...s, zakazky: z && { cislo: z.cislo, zakaznici: T.zakaznici.find(c => c.id === z.zakaznik_id), vozidla: T.vozidla.find(v => v.id === z.vozidlo_id) },
          dil: d ? { id: d.id, nazev: d.nazev, cislo_mb: d.cislo_mb, nakupni_cena: d.nakupni_cena, mena: d.mena, dodavatele: [{ id: "d1", nazev: "Auto Kelly" }, { id: "d2", nazev: "Granex" }, { id: "d3", nazev: "MB (original)" }, { id: "d4", nazev: "Jiný" }].find(x => x.id === d.dodavatel_id) || null } : null };
      }));
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
    async kurzEur() { return { kurz: 24.335, datum: "29.10.2026", kurzy: { EUR: 24.335, USD: 21.05, GBP: 28.4, JPY: 0.15512, IDR: 0.0013838 } }; },
    async smazatZaznamSouboru(sid) { await cekej(); T.soubory = T.soubory.filter(x => x.id !== sid); return [{ id: sid }]; },
    async smazatSoubory(telo) { (window.__SMAZANE_SOUBORY__ ||= []).push(telo); return { smazano: (telo.klice || []).length }; },
    async vystavitDoklad(p) {                       // jako vystavit_doklad v databázi: všechno najednou, nebo nic
      if (!/^(\d+-[1-6](-\d+)?|\d{4,}\d{3}[1-6])$/.test(String(p.cislo)) || !/^\d{1,10}$/.test(String(p.variabilni_symbol))) throw new Error("new row violates check constraint \"doklady_cislo_tvar\"");   // jako 038
      await cekej(); if (window.__OFFLINE_DOKLAD__) throw new Error("Failed to fetch");
      for (const x of p.podpisy || []) if (!["ipad", "dalkove", "ulozeny"].includes(x.zpusob)) throw new Error('new row for relation "podpisy" violates check constraint "podpisy_zpusob_check"');   // jako v databázi
      if (window.__CIZI_DOKLAD__) { window.__CIZI_DOKLAD__ = null; T.doklady.push({ id: id(), zakazka_id: p.zakazka_id, druh: p.druh, verze: p.verze, cislo: p.cislo, variabilni_symbol: p.variabilni_symbol, data: { pokus: "jine-zarizeni" }, zamceno: true }); }   // test: číslo mezitím obsadil jiný doklad
      if (p.nahradit_nepodepsane && p.druh === "zakazkovy_list") {                // jako 042: nahrazení a vystavení jedním krokem (při kolizi se nic nesmaže)
        const jiny = T.doklady.find(x => x.cislo === p.cislo && x.data?.pokus !== p.data?.pokus && (!x.data?.cekaPodpis || T.dalkove_podpisy.some(y => y.doklad_id === x.id)));
        if (jiny) throw new Error(`Číslo ${p.cislo} už mezitím dostal jiný doklad – načtěte zakázku znovu`);
        await this.nahraditNepodepsaneListy(p.zakazka_id);
      }
      const uz = T.doklady.find(x => x.cislo === p.cislo); if (uz) return { ...kopie(uz), uz_existoval: true };
      const ted = new Date().toISOString(), sb = p.soubory.map(x => ({ id: id(), vytvoreno: ted, zakazka_id: p.zakazka_id, vozidlo_id: p.vozidlo_id, druh: x.druh, klic: x.klic, nazev: x.nazev, velikost: x.velikost, mime: x.mime, verejne: false, _role: x.role }));
      const pdf = sb.find(x => x._role === "pdf"), podpis = sb.find(x => x._role === "podpis");
      const d = { id: id(), vytvoreno: ted, zakazka_id: p.zakazka_id, nabidka_id: p.nabidka_id || null, druh: p.druh, verze: p.verze, cislo: p.cislo, variabilni_symbol: p.variabilni_symbol,
        jazyk: p.jazyk, vystaveno: p.vystaveno, splatnost: p.splatnost, data: p.data, pdf_soubor_id: pdf?.id || null, zamceno: true, celkem: p.celkem ?? null, zaplaceno: null, odeslano_uol: null };
      for (const x of sb) { if (x._role === "pdf" || x._role === "priloha") x.doklad_id = d.id; delete x._role; }
      T.soubory.push(...sb); T.doklady.push(d);
      T.podpisy.push(...p.podpisy.map(x => ({ id: id(), doklad_id: d.id, podepsano: new Date().toISOString(), ...x, obrazek_soubor_id: x.role === "zakaznik" ? podpis?.id : null })));
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
      if (tab === "sklad") { const k = klicSkladu({ ...r, ...zmeny }); if (T.sklad.some(x => x.klic === k && x.id !== rid)) throw new Error('duplicate key value violates unique constraint "sklad_klic"'); Object.assign(r, zmeny, { klic: k }); return [kopie(r)]; }
      Object.assign(r, zmeny); return [kopie(r)];
    },
    async detail(zid) {
      await cekej();
      const z = T.zakazky.find(x => x.id === zid); if (!z) return null;
      return kopie({ ...z, vozidla: T.vozidla.find(v => v.id === z.vozidlo_id), zakaznici: T.zakaznici.find(c => c.id === z.zakaznik_id),
        doklady: T.doklady.filter(d => d.zakazka_id === zid).map(d => ({ ...d, soubory: T.soubory.find(s => s.id === d.pdf_soubor_id),
          dalkove_podpisy: T.dalkove_podpisy.filter(x => x.doklad_id === d.id).map(x => ({ ...x, soubory: T.soubory.find(f => f.id === x.soubor_id) })),
          podpisy: T.podpisy.filter(x => x.doklad_id === d.id).map(x => ({ role: x.role, zpusob: x.zpusob, podepsano: x.podepsano || null })),
          emaily: (window.__ULOZENO__.emaily || []).filter(x => x.doklad_id === d.id) })),
        soubory: T.soubory.filter(s => s.zakazka_id === zid) });
    }
  };
})();
