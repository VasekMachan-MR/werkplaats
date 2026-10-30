/* Werkplaats – dílenská aplikace Mercedes Restorations
   Fáze 1: přihlášení, přehled zakázek, příjem vozu (zákazník → auto → závady → fotky → podpis → zakázkový list 7377-1), detail zakázky. */
(() => {
  "use strict";
  const K = window.WERK_KONFIG;
  const app = document.getElementById("app");
  /* Odkaz z e-mailu „zapomenuté heslo“: #access_token=…&type=recovery (Supabase ho po načtení z adresy smaže, proto si ho pamatujeme hned) */
  const H0 = location.hash;
  let obnovaHesla = /type=recovery/.test(H0);
  const chybaOdkazu = /error_code=otp_expired/.test(H0) ? "Odkaz pro nastavení hesla už vypršel nebo byl použit. Pošlete si prosím nový přes „Zapomenuté heslo“."
    : (H0.match(/error_description=([^&]+)/) || [])[1] ? "Odkaz z e-mailu nefunguje: " + decodeURIComponent(H0.match(/error_description=([^&]+)/)[1].replace(/\+/g, " ")) : null;

  /* ================= pomocné funkce ================= */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dnes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const plusDni = (d, n) => {                       // "2026-10-28" + 60 → "2026-12-27"
    const [y, m, dd] = String(d).split("-").map(Number); const x = new Date(y, m - 1, dd + n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const DNI_DOKONCENI = 60;                          // předpoklad dokončení = převzetí + 60 dní
  const datumCz = d => { if (!d) return ""; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : d; };
  const kc = n => { if (n == null || n === "") return ""; const x = Math.round(Number(n) * 100) / 100, cele = Number.isInteger(x);   // haléře jen když nějaké jsou (jako v PDF)
    return x.toLocaleString("cs-CZ", { minimumFractionDigits: cele ? 0 : 2, maximumFractionDigits: cele ? 0 : 2 }) + " Kč"; };
  // číslo z textu, jak ho píše člověk: „1 500“, „1.500“ (tisíce), „1 500,50“, „385.99“, „30 %“, „1 200 Kč“ → číslo; prázdné → null; nesmysl → NaN
  const cisloZ = s => {
    let t = String(s ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(/(%|kč|czk|eur|€|,-)$/i, "").replace(/^[−–]/, "-");
    if (t === "") return null;
    if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    else if (t.includes(",")) t = /^-?\d{1,3}(,\d{3}){2,}$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");                // 1.500 / 12.000 = tisíce
    return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN;
  };
  // číselné pole ve formuláři: nesmysl zčervená a neuloží se
  const ciselnyVstup = (inp, { min = -Infinity, max = Infinity } = {}) => {
    const v = cisloZ(inp.value), spatne = v != null && (!Number.isFinite(v) || v < min || v > max);
    inp.classList.toggle("chybi", spatne); inp.title = spatne ? (Number.isFinite(v) ? `Povolený rozsah ${min === -Infinity ? "" : min} až ${max === Infinity ? "" : max}` : "Tohle není číslo") : "";
    return spatne ? undefined : v;
  };
  // „blbuvzdorné“ kontroly polí: vrací text chyby, nebo "" (prázdné pole = bez chyby, povinnost hlídá jinde)
  const ROK_TED = new Date().getFullYear();
  const PRAVIDLA = {
    vin: v => { const t = String(v || "").replace(/\s/g, "").toUpperCase(); if (!t) return "";
      return !/^[A-Z0-9]+$/.test(t) ? "VIN smí obsahovat jen písmena a číslice" : t.length < 10 || t.length > 17 ? `VIN má 10–17 znaků (teď ${t.length})` : ""; },
    rok: v => { if (!String(v ?? "").trim()) return ""; const n = cisloZ(v); return Number.isInteger(n) && n >= 1900 && n <= ROK_TED + 1 ? "" : `Rok výroby 1900–${ROK_TED + 1}`; },
    km: v => { if (!String(v ?? "").trim()) return ""; const n = cisloZ(v); return Number.isFinite(n) && n >= 0 && n <= 2000000 ? "" : "Stav tachometru 0 – 2 000 000"; },
    telefon: v => { const t = String(v || "").trim(); if (!t) return ""; return /^[+\d][\d\s/().-]*$/.test(t) && t.replace(/\D/g, "").length >= 9 ? "" : "Telefon – aspoň 9 číslic, např. +420 777 123 456"; },
    email: v => { const t = String(v || "").trim(); return !t || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? "" : "Neplatný e-mail"; },
    psc: (v, zeme) => { const t = String(v || "").trim(); if (!t || (zeme && !/česk|czech|^cz$/i.test(zeme))) return ""; return /^\d{3}\s?\d{2}$/.test(t) ? "" : "PSČ má 5 číslic, např. 500 02"; },
    castka: v => { if (!String(v ?? "").trim()) return ""; const n = cisloZ(v); return Number.isFinite(n) && n >= 0 ? "" : "Částka musí být kladné číslo"; },
    datum: v => { if (!v) return ""; return v < "1950-01-01" || v > plusDni(dnes(), 366) ? "Zkontrolujte datum" : ""; }
  };
  const PRAVIDLO_POLE = { "vozidlo.vin": "vin", "vozidlo.rok": "rok", "zakazka.km_prijem": "km", "zakaznik.telefon": "telefon", "zakaznik.email": "email",
    "zakaznik.psc": "psc", "zakazka.odhad_ceny": "castka", "zakazka.datum_prijmu": "datum", "zakazka.predpoklad_dokonceni": "datum",
    vin: "vin", rok: "rok", km_posledni: "km", telefon: "telefon", email: "email", psc: "psc" };
  // označí pole červeně a pod něj napíše proč; vrací text chyby
  function oznacPole(inp, chyba) {
    inp.classList.toggle("neplatne", !!chyba);
    let el = inp.parentElement.querySelector(":scope > .chyba-pole");
    if (chyba && !el) { el = document.createElement("span"); el.className = "chyba-pole"; inp.insertAdjacentElement("afterend", el); }
    if (el) { el.textContent = chyba || ""; el.hidden = !chyba; }
    return chyba;
  }
  const zkontrolujPole = (inp, klic, zeme) => { const r = PRAVIDLA[PRAVIDLO_POLE[klic]]; return oznacPole(inp, r ? r(inp.value, zeme) : ""); };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now() + Math.random().toString(16).slice(2));
  const cekej = ms => new Promise(r => setTimeout(r, ms));
  function hlaska(text, chyba = false, ms = 3500) {
    const el = document.getElementById("hlaska");
    el.textContent = text; el.className = "hlaska" + (chyba ? " chyba" : ""); el.hidden = false;
    clearTimeout(hlaska.t); hlaska.t = setTimeout(() => (el.hidden = true), ms);
  }
  function prekryv(text) {
    const el = document.createElement("div");
    el.className = "prekryv";
    el.innerHTML = `<div class="karta"><div class="tocitko"></div><div class="text">${esc(text)}</div></div>`;
    document.body.appendChild(el);
    return { text: t => (el.querySelector(".text").textContent = t), zavri: () => el.remove() };
  }
  const uloz = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiště */ } };
  const nacti = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  // telefon / e-mail jako odkaz – na iPadu/iPhonu klik rovnou volá nebo otevře novou zprávu
  const telOdkaz = t => { const s = String(t || "").trim(); if (!s) return ""; const n = s.replace(/[^\d+]/g, "").replace(/^00/, "+");
    return n.replace(/\D/g, "").length >= 6 ? `<a class="kontakt-odkaz" href="tel:${esc(n)}">📞 ${esc(s)}</a>` : esc(s); };
  const mailOdkaz = m => { const s = String(m || "").trim(); if (!s) return "";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? `<a class="kontakt-odkaz" href="mailto:${esc(s)}">✉️ ${esc(s)}</a>` : esc(s); };
  // tlačítka Zavolat / WhatsApp / E-mail (číslo bez předvolby = české +420)
  function kontaktTlacitka(c) {
    if (!c) return "";
    const s = String(c.telefon || "").trim(); let n = s.replace(/[^\d+]/g, "").replace(/^00/, "+");
    if (!n.startsWith("+") && n.replace(/\D/g, "").length === 9) n = "+420" + n;
    const cisla = n.replace(/\D/g, ""), b = [];
    if (cisla.length >= 9) b.push(`<a class="tl tl-male" href="tel:${esc(n)}">📞 Zavolat</a>`, `<a class="tl tl-male" href="https://wa.me/${cisla}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
    const m = String(c.email || "").trim(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) b.push(`<a class="tl tl-male" href="mailto:${esc(m)}">✉️ E-mail</a>`);
    return b.length ? `<div class="radek-tlacitek kontakt-tlacitka">${b.join("")}</div>` : "";
  }
  const chybaText = e => (e && (e.message || e.error_description || e.msg)) || String(e);

  const STAVY = {
    poptavka: "Poptávka", prijato: "Přijato", nabidka: "Nabídka", schvaleno: "Schváleno", v_praci: "V práci",
    hotovo: "Hotovo", fakturovano: "Fakturováno", zaplaceno: "Zaplaceno", predano: "Předáno", zruseno: "Zrušeno"
  };
  const DRUHY = {
    zakazkovy_list: "Zakázkový list", nabidka: "Cenová nabídka", faktura: "Faktura",
    predavaci_protokol: "Předávací protokol", zalohova: "Zálohová faktura", opravny: "Opravný doklad"
  };
  const NADRZ = ["Rezerva", "1/4", "1/2", "3/4", "Plná"];
  const NADRZ_EN = { "Rezerva": "Reserve", "Plná": "Full" };
  const RYCHLE = {
    cs: {
      zavady: ["Inspekce vozidla a diagnostika", "Servis vozidla (výměna kapalin a filtrů)", "Řešení ostatních závad dle další domluvy"],
      stav: ["Auto pojízdné, startuje, jede", "Vnější poškození karoserie viz foto", "Interiér bez poškození"]
    },
    en: {
      zavady: ["Vehicle inspection and diagnostics", "Vehicle service (fluids and filters)", "Other repairs as agreed"],
      stav: ["Car drivable, starts and drives", "Exterior body damage – see photos", "Interior without damage"]
    }
  };

  /* Z VIN Mercedesu zjistí typ a kód modelu: WDB1260241A… → 126 / 126.024; starý podvozek 10806812… → 108 / 108.068 */
  function rozlustitVin(vin) {
    const v = String(vin || "").toUpperCase().replace(/\s/g, "");
    let m = v.match(/^WD[BDC](\d{3})(\d{3})/) || v.match(/^(\d{3})(\d{3})\d{2,}/);
    return m ? { typ: m[1], kod: `${m[1]}.${m[2]}` } : null;
  }

  /* ================= databáze ================= */
  function vytvorDb() {
    const sb = window.supabase.createClient(K.supabaseUrl, K.supabaseKlic, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "werkplaats-prihlaseni" }
    });
    sb.auth.onAuthStateChange(ud => { if (ud === "PASSWORD_RECOVERY") obnovaHesla = true; });
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const kos = () => sb.storage.from(K.kos);
    return {
      async relace() { return ok(await sb.auth.getSession()).session; },
      naZmenuPrihlaseni(fn) { sb.auth.onAuthStateChange((_u, s) => fn(s)); },
      async prihlasit(email, heslo) { return ok(await sb.auth.signInWithPassword({ email, password: heslo })); },
      // dvoufázové přihlášení (TOTP – Google Authenticator / Hesla na iPhonu)
      async mfaStav() {
        const a = ok(await sb.auth.mfa.getAuthenticatorAssuranceLevel()), f = ok(await sb.auth.mfa.listFactors());
        const totp = (f.all || f.totp || []).filter(x => x.factor_type === "totp");
        const kdy = Math.max(0, ...(a.currentAuthenticationMethods || []).filter(m => m.method === "totp").map(m => Number(m.timestamp) || 0));
        return { uroven: a.currentLevel, overeno: totp.find(x => x.status === "verified") || null, neovereno: totp.filter(x => x.status !== "verified"), naposledy: kdy ? kdy * 1000 : 0 };
      },
      async mfaNastavit() {
        const st = await this.mfaStav();
        try { const ul = JSON.parse(sessionStorage.getItem("werk-mfa-nastaveni") || "null");
          if (ul && st.neovereno.some(x => x.id === ul.id)) return ul; } catch (e) { /* bez úložiště */ }
        for (const x of st.neovereno) await sb.auth.mfa.unenroll({ factorId: x.id });   // starý nedokončený pokus
        const e = ok(await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Werkplaats " + new Date().toISOString().slice(0, 16), issuer: "Werkplaats" }));
        try { sessionStorage.setItem("werk-mfa-nastaveni", JSON.stringify({ id: e.id, totp: e.totp })); } catch (er) { /* bez úložiště */ }
        return e;
      },
      async mfaOverit(factorId, kod) { return ok(await sb.auth.mfa.challengeAndVerify({ factorId, code: kod })); },
      async odhlasit() { await sb.auth.signOut(); },
      async obnovitHeslo(email) { return ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
      async noveHeslo(heslo) { return ok(await sb.auth.updateUser({ password: heslo })); },
      async clen(id) { return ok(await sb.from("uzivatele").select("id,jmeno,role,email,aktivni,podpis_obrazek").eq("id", id).maybeSingle()); },
      async uzivatele() { return ok(await sb.from("uzivatele").select("id,jmeno,role,email,aktivni,vytvoreno,podpis_obrazek").order("vytvoreno")); },
      async ulozitMujPodpis(id, obrazek) { return ok(await sb.from("uzivatele").update({ podpis_obrazek: obrazek }).eq("id", id).select("id")); },
      async ulozitMojeJmeno(id, jmeno) { return ok(await sb.from("uzivatele").update({ jmeno }).eq("id", id).select("id")); },
      async kurzEur() { const { data, error } = await sb.functions.invoke("kurz-cnb"); if (error || !data?.kurz) throw error || new Error("kurz"); return data; },
      async sprava(telo) {                              // serverová funkce: přidat mechanika, heslo, zablokovat, role (jen majitel)
        const { data, error } = await sb.functions.invoke("sprava-uzivatelu", { body: telo });
        if (error) { let m = error.message; try { const j = await error.context.json(); m = j.chyba || m; } catch (e) { /* bez těla */ } throw new Error(m); }
        if (data?.chyba) throw new Error(data.chyba);
        return data;
      },
      async podpisVyhotovil() { const r = ok(await sb.from("nastaveni").select("hodnota").eq("klic", "podpis_vyhotovil").maybeSingle()); return r?.hodnota || null; },
      async servisniKatalog() {
        const [m, t, u] = await Promise.all([sb.from("motory").select("kod,palivo,serizovani_ventilu,popis").order("kod"), sb.from("typy_motoru").select("klic,motor"), sb.from("servisni_ukony").select("*").order("poradi")]);
        return { motory: ok(m), typy: ok(t), ukony: ok(u) };
      },
      async dalsiCisloOdhad() { const r = ok(await sb.from("ciselne_rady").select("posledni").eq("rada", "zakazky").maybeSingle()); return r ? r.posledni + 1 : null; },
      async zakazky() {
        return ok(await sb.from("zakazky")
          .select("id,cislo,stav,datum_prijmu,predpoklad_dokonceni,datum_predani,ukoly,vozidla(typ,model,vin,spz,rok),zakaznici(jmeno,telefon)")
          .order("cislo", { ascending: false }).limit(300));
      },
      async hledatZakazniky(q) {
        const t = q.replace(/[%,()*]/g, " ").trim();
        if (t.length < 2) return [];
        const vzor = `%${t}%`;
        return ok(await sb.from("zakaznici")
          .select("*,vlastnictvi(vlastni_do,vozidla(id,vin,typ,model,rok,spz,barva,verze,jednotka_tachometru,km_posledni))")
          .or(`jmeno.ilike.${vzor},telefon.ilike.${vzor},email.ilike.${vzor},kontaktni_osoba.ilike.${vzor}`)
          .order("jmeno").limit(12));
      },
      async vozidloPodleVin(vin) {
        return ok(await sb.from("vozidla")
          .select("*,vlastnictvi(vlastni_od,vlastni_do,zakaznici(*)),zakazky(cislo,datum_prijmu,km_prijem)")
          .eq("vin", vin.toUpperCase().replace(/\s/g, "")).maybeSingle());
      },
      async zalozitZakazku(p) { return ok(await sb.rpc("zalozit_zakazku", { p })); },
      async zmenitMajitele(vid, zid) { return ok(await sb.rpc("zapsat_vlastnictvi", { p_vozidlo: vid, p_zakaznik: zid, p_zmena: true })); },
      async smazatZaznamSouboru(id) { return ok(await sb.from("soubory").delete().eq("id", id).select("id")); },
      async smazatSoubory(telo) { const { data, error } = await sb.functions.invoke("smazat-soubory", { body: telo }); if (error) throw error; return data; },
      async vystavitDoklad(p) { return ok(await sb.rpc("vystavit_doklad", { p })); },
      async smazatZakazku(id) { return ok(await sb.rpc("smazat_zakazku", { p_id: id })); },
      async smazatDoklad(id) { return ok(await sb.rpc("smazat_doklad", { p_id: id })); },
      async smazatZakaznika(id) { return ok(await sb.rpc("smazat_zakaznika", { p_id: id })); },
      async smazatVozidlo(id) { return ok(await sb.rpc("smazat_vozidlo", { p_id: id })); },
      async ulozitZakaznika(p) { return ok(await sb.rpc("ulozit_zakaznika", { p })); },
      async ulozitVozidlo(p, zakaznikId) { return ok(await sb.rpc("ulozit_vozidlo", { p, p_zakaznik: zakaznikId || null })); },
      async seznamZakazniku() {
        return ok(await sb.from("zakaznici").select("id,jmeno,je_firma,kontaktni_osoba,telefon,email,mesto,vlastnictvi(vlastni_do,vozidla(typ,model)),zakazky(count)").order("jmeno").limit(2000));
      },
      async zakaznik(id) {
        return ok(await sb.from("zakaznici").select("*,vlastnictvi(id,vlastni_od,vlastni_do,vozidla(id,vin,typ,model,rok,spz)),zakazky(id,cislo,stav,datum_prijmu,vozidla(typ,model))").eq("id", id).maybeSingle());
      },
      async seznamVozidel() {
        return ok(await sb.from("vozidla").select("id,vin,spz,typ,model,rok,barva,verze,km_posledni,jednotka_tachometru,vlastnictvi(vlastni_do,zakaznici(jmeno)),zakazky(count)").order("vytvoreno", { ascending: false }).limit(2000));
      },
      async vozidlo(id) {
        return ok(await sb.from("vozidla").select("*,vlastnictvi(id,vlastni_od,vlastni_do,zakaznici(id,jmeno,telefon,email)),zakazky(id,cislo,stav,datum_prijmu,km_prijem,km_predani)").eq("id", id).maybeSingle());
      },
      async dokumentyVozidla(vid) { return ok(await sb.from("soubory").select("id,druh,klic,nazev,mime,verejne,vytvoreno").eq("vozidlo_id", vid).eq("druh", "tp").is("smazano", null).order("vytvoreno")); },
      async polozky(zid) { return ok(await sb.from("polozky").select("typ,popis,mnozstvi,jednotka,sazba,castka,poradi").eq("zakazka_id", zid).is("nabidka_id", null).order("poradi")); },
      async ulozitPolozky(zid, polozky) { return ok(await sb.rpc("ulozit_polozky", { p_zakazka: zid, p_polozky: polozky })); },
      async dily(zid) { return ok(await sb.from("dily").select("*").eq("zakazka_id", zid).order("poradi")); },
      async ulozitDily(zid, dily) { return ok(await sb.rpc("ulozit_dily", { p_zakazka: zid, p_dily: dily })); },
      async dodavatele() { return ok(await sb.from("dodavatele").select("id,nazev,web,mena").order("nazev")); },
      async katalogVozu() { return ok(await sb.from("katalog_vozu").select("typ,rada,karoserie,model,od,do,motor,motor_popis,palivo").order("typ").limit(2000)); },
      async vsechnyDily() {
        return ok(await sb.from("dily").select("id,nazev,cislo_mb,vyrobce,cislo_vyrobce,mnozstvi,jednotka,nakupni_cena,mena,kurz,prodejni_cena,stav,dodavatel_id,zakazky(id,cislo,datum_prijmu,stav,vozidla(typ,model,rok,motor,vin,cislo_motoru))").neq("stav", "nepouzito").limit(10000));
      },
      async kalendar(od, doo) { return ok(await sb.from("kalendar").select("id,datum,cas,text,zakazka_id").gte("datum", od).lte("datum", doo).order("datum").order("cas", { nullsFirst: true })); },
      async smazatRadek(tabulka, id) { return ok(await sb.from(tabulka).delete().eq("id", id).select("id")); },
      async vsechnyDoklady() {
        return ok(await sb.from("doklady")
          .select("id,zakazka_id,druh,verze,cislo,vystaveno,splatnost,celkem,zaplaceno,odeslano_uol,jazyk,zakazky(id,cislo,zakaznici(jmeno),vozidla(typ,model)),soubory!doklady_pdf_soubor_id_fkey(klic)")
          .order("vystaveno", { ascending: false }).order("cislo", { ascending: false }).limit(2000));
      },
      async sazby() { return ok(await sb.from("sazby").select("nazev,kc_za_hodinu,poradi").order("poradi")); },
      async nahrat(klic, blob, typ, prubeh) {
        if (!prubeh) return ok(await kos().upload(klic, blob, { contentType: typ, upsert: false, cacheControl: "31536000" }));
        // s ukazatelem průběhu (hodí se u videí) – přímo na úložiště, se stejným přihlášením
        const token = ok(await sb.auth.getSession()).session?.access_token;
        if (!token) throw new Error("Nejste přihlášen");
        return new Promise((hotovo, chyba) => {
          const x = new XMLHttpRequest();
          x.open("POST", `${K.supabaseUrl}/storage/v1/object/${K.kos}/${klic.split("/").map(encodeURIComponent).join("/")}`);
          x.setRequestHeader("Authorization", `Bearer ${token}`);
          x.setRequestHeader("apikey", K.supabaseKlic);
          x.setRequestHeader("Content-Type", typ);
          x.setRequestHeader("x-upsert", "false");
          x.setRequestHeader("Cache-Control", "max-age=31536000");
          x.upload.onprogress = e => { if (e.lengthComputable) prubeh(e.loaded / e.total); };
          x.onload = () => {
            if (x.status >= 200 && x.status < 300) { prubeh(1); return hotovo({ path: klic }); }
            let m = `Nahrání selhalo (${x.status})`; try { const j = JSON.parse(x.responseText); m = j.message || j.error || m; } catch (e) { /* text */ }
            chyba(new Error(m));
          };
          x.onerror = () => chyba(new Error("Spojení přerušeno – zkuste to znovu"));
          x.send(blob);
        });
      },
      async odkaz(klic, s = 3600) { return ok(await kos().createSignedUrl(klic, s)).signedUrl; },
      async odkazy(klice, s = 3600) { if (!klice.length) return []; return ok(await kos().createSignedUrls(klice, s)); },
      async stahnout(klic) { return ok(await kos().download(klic)); },
      async vlozit(tabulka, radky) { return ok(await sb.from(tabulka).insert(radky).select()); },
      async upravit(tabulka, id, zmeny) { return ok(await sb.from(tabulka).update(zmeny).eq("id", id).select()); },
      async detail(id) {
        return ok(await sb.from("zakazky")
          .select("*,vozidla(*),zakaznici(*),doklady(id,druh,cislo,verze,vystaveno,splatnost,zamceno,celkem,zaplaceno,odeslano_uol,data,jazyk,pdf_soubor_id,soubory!doklady_pdf_soubor_id_fkey(klic),dalkove_podpisy!dalkove_podpisy_doklad_id_fkey(id,podepsano,vystaveny_doklad_id,soubory(klic))),soubory!soubory_zakazka_id_fkey(id,druh,faze,klic,nazev,mime,vytvoreno,smazano,doklad_id,verejne,podpis_pozadan,podepsany_z)")
          .eq("id", id).maybeSingle());
      }
    };
  }
  const db = window.__WERK_DB__ || vytvorDb();
  let uzivatel = null;
  const jeMajitel = () => uzivatel?.role === "majitel";   // faktury, úhrady, marže a mazání jen majitel
  let novaVerze = false;    // na serveru je novější verze aplikace (service worker ji už převzal)      // {id, jmeno, role, email, aktivni, podpis_obrazek}

  /* ================= směrování ================= */
  const trasy = [
    [/^#?\/?$/, uvod],
    [/^#\/zakazky$/, prehled],
    [/^#\/novy$/, prijem],
    [/^#\/zakazka\/([\w-]+)$/, detail],
    [/^#\/zakazka\/([\w-]+)\/(nabidka|faktura|protokol|zaloha|opravny)$/, vystavit],
    [/^#\/doklady$/, prehledDokladu],
    [/^#\/zakaznici$/, zakaznici],
    [/^#\/zakaznik\/([\w-]+)$/, zakaznikDetail],
    [/^#\/vozidla$/, vozidla],
    [/^#\/dily$/, dilyPrehled],
    [/^#\/vozidlo\/([\w-]+)$/, vozidloDetail],
    [/^#\/hotovo\/([\w-]+)$/, hotovo],
    [/^#\/ucet$/, ucet],
    [/^#\/lide$/, lide]
  ];
  let uklid = null;
  let aktualniHash = location.hash, navratBezVykresleni = false, navId = 0;
  async function navigace() {
    if (navratBezVykresleni) { navratBezVykresleni = false; return; }
    // nejdřív doukládat; když to nejde (bez signálu), zůstat na stránce – jinak by se změny ztratily
    if (!(await dokoncitUkladani()) && !(await dokoncitUkladani())
        && !confirm("Změny v zakázce se nepodařilo uložit (zkontrolujte připojení).\n\nOK = odejít a změny zahodit\nZrušit = zůstat a zkusit to znovu")) {
      if (location.hash !== aktualniHash) { navratBezVykresleni = true; location.hash = aktualniHash; } hlaska("Změny nejsou uložené – zkuste to znovu, až bude signál.", true, 8000); return;
    }
    for (const k in neulozene) delete neulozene[k];
    if (uklid) { try { uklid(); } catch (e) { /* nic */ } uklid = null; }
    if (!uzivatel || obnovaHesla) return;
    const h = location.hash || "#/"; aktualniHash = h; navId++;
    zavriMenu(); oznacMenu();
    if (novaVerze) obnovitKdyzLzeTo();
    for (const [re, fn] of trasy) { const m = h.match(re); if (m) { window.scrollTo(0, 0); return fn(...m.slice(1)); } }
    location.hash = "#/";
  }
  window.addEventListener("hashchange", navigace);

  function lista() {
    const el = document.getElementById("lista-vpravo");
    if (!uzivatel) { el.innerHTML = ""; return; }
    // na iPhonu (úzký displej) se odkazy schovají pod ☰, na Macu a iPadu zůstávají v řadě
    el.innerHTML = `<button type="button" class="fronta-odznak" id="fronta-odznak" hidden></button><button type="button" class="tl tl-male menu-tl" aria-expanded="false" aria-label="Menu">☰</button>
      <nav class="menu-odkazy"><div class="menu-hledat jen-telefon"><input type="search" class="vstup" id="menu-hledat" placeholder="Hledat: zakázka, SPZ, VIN, zákazník" autocomplete="off" enterkeyhint="search"><div class="menu-vysledky" id="menu-vysledky"></div></div><a class="tl tl-male" href="#/">Přehled</a><a class="tl tl-male" href="#/zakazky">Zakázky</a><a class="tl tl-male" href="#/zakaznici">Zákazníci</a><a class="tl tl-male" href="#/vozidla">Vozidla</a><a class="tl tl-male" href="#/dily">Díly</a><a class="tl tl-male" href="#/doklady">Doklady</a>
      <a class="tl tl-male uzivatel-tl" href="#/ucet" title="Můj účet">👤 <span>${esc(uzivatel.jmeno)}</span></a></nav>`;
    el.querySelector("#fronta-odznak").onclick = () => { if (!navigator.onLine) hlaska("Bez signálu – změny jsou uložené v tomto zařízení a odešlou se samy, až bude spojení."); odeslatFrontu(true); };
    ukazFrontu();
    const hl = el.closest(".lista"), tl = el.querySelector(".menu-tl");
    tl.onclick = () => { const o = hl.classList.toggle("menu-otevrene"); tl.setAttribute("aria-expanded", o); tl.textContent = o ? "✕" : "☰"; };
    el.querySelector(".menu-odkazy").onclick = e => { if (e.target.closest("a")) zavriMenu(); };
    // hledání v menu (iPhone): zakázky (číslo, SPZ, VIN, model, zákazník, telefon) a zákazníci
    const hq = el.querySelector("#menu-hledat"), hv = el.querySelector("#menu-vysledky");
    let dataHledani = null;
    const nactiHledani = async () => dataHledani ||= await Promise.all([db.zakazky(), db.seznamZakazniku().catch(() => [])]).catch(() => [[], []]);
    hq.addEventListener("focus", () => { dataHledani = null; nactiHledani(); });
    hq.addEventListener("input", async () => {
      const t = hq.value.trim().toLowerCase(), t2 = t.replace(/\s/g, "");
      if (t.length < 2) { hv.innerHTML = ""; return; }
      const [zak, lid] = await nactiHledani();
      if (hq.value.trim().toLowerCase() !== t) return;
      const shoda = (...x) => x.some(v => { const s = String(v ?? "").toLowerCase(); return s.includes(t) || (t2.length > 2 && s.replace(/\s/g, "").includes(t2)); });
      const rz = zak.filter(z => shoda(z.cislo, z.vozidla?.spz, z.vozidla?.vin, z.vozidla?.model, z.vozidla?.typ, z.zakaznici?.jmeno, z.zakaznici?.telefon)).slice(0, 6);
      const rl = lid.filter(c => shoda(c.jmeno, c.telefon, c.email, c.kontaktni_osoba)).slice(0, 4);
      hv.innerHTML = rz.map(z => `<a class="menu-vysledek" href="#/zakazka/${z.id}"><b>#${z.cislo}</b> ${esc([z.vozidla?.typ, z.vozidla?.model].filter(Boolean).join(" "))}<small>${esc([z.zakaznici?.jmeno, z.vozidla?.spz, STAVY[z.stav]].filter(Boolean).join(" · "))}</small></a>`).join("")
        + rl.map(c => `<a class="menu-vysledek" href="#/zakaznik/${c.id}">👤 ${esc(c.jmeno)}<small>${esc([c.telefon, c.mesto].filter(Boolean).join(" · "))}</small></a>`).join("")
        || `<div class="menu-vysledek menu-nic">Nic nenalezeno.</div>`;
    });
    oznacMenu();
  }
  function zavriMenu() {
    const hl = document.querySelector(".lista"), tl = hl?.querySelector(".menu-tl");
    if (!hl || !tl) return; hl.classList.remove("menu-otevrene");
    const hq = hl.querySelector("#menu-hledat"); if (hq) { hq.value = ""; hl.querySelector("#menu-vysledky").innerHTML = ""; } tl.setAttribute("aria-expanded", "false"); tl.textContent = "☰";
  }
  function oznacMenu() {
    const h = location.hash || "#/";
    const cil = h === "#/" || h === "#" ? "#/" : /^#\/(zakazk|novy|hotovo)/.test(h) ? "#/zakazky" : /^#\/zakaznik/.test(h) ? "#/zakaznici"
      : /^#\/vozidl/.test(h) ? "#/vozidla" : /^#\/dily/.test(h) ? "#/dily" : /^#\/doklady/.test(h) ? "#/doklady" : /^#\/(ucet|lide)/.test(h) ? "#/ucet" : "";
    document.querySelectorAll(".menu-odkazy a").forEach(a => a.getAttribute("href") === cil ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  }

  /* ================= přihlášení ================= */
  function prihlaseni(zprava) {
    lista();
    const obnova = obnovaHesla;
    app.innerHTML = `
      <div class="prihlaseni"><div class="karta">
        <h1>${obnova ? "Nové heslo" : "Přihlášení"}</h1>
        <p class="popis" style="margin:0 0 18px">Dílna Mercedes Restorations – jen pro zaměstnance.</p>
        <form id="f" autocomplete="on">
          ${obnova ? "" : `<label class="pole">E-mail<input name="email" type="email" autocomplete="username" required inputmode="email"></label>`}
          <label class="pole">${obnova ? "Nové heslo (aspoň 10 znaků)" : "Heslo"}<input name="heslo" type="password" autocomplete="${obnova ? "new-password" : "current-password"}" required minlength="${obnova ? 10 : 1}"></label>
          <button class="tl tl-hlavni tl-velke" type="submit">${obnova ? "Uložit heslo" : "Přihlásit"}</button>
          ${obnova ? "" : `<button class="tl tl-text" type="button" id="zapomenute">Zapomenuté heslo</button>`}
          <div id="zprava">${zprava ? `<div class="info chyba">${esc(zprava)}</div>` : ""}</div>
        </form>
      </div></div>`;
    const f = app.querySelector("#f"), z = app.querySelector("#zprava");
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector("button[type=submit]"); b.disabled = true;
      try {
        if (obnova) { await db.noveHeslo(f.heslo.value); obnovaHesla = false; history.replaceState(null, "", location.pathname); hlaska("Heslo uloženo – jste přihlášen."); start(); }
        else { await db.prihlasit(f.email.value.trim(), f.heslo.value); await start(); }
      } catch (err) {
        z.innerHTML = `<div class="info chyba">${/invalid/i.test(chybaText(err)) ? "Nesprávný e-mail nebo heslo." : esc(chybaText(err))}</div>`;
      } finally { b.disabled = false; }
    };
    const zap = app.querySelector("#zapomenute");
    if (zap) zap.onclick = async () => {
      const email = f.email.value.trim();
      if (!email) { z.innerHTML = `<div class="info pozor">Nejdřív vyplňte e-mail.</div>`; return; }
      try { await db.obnovitHeslo(email); z.innerHTML = `<div class="info ok">Poslali jsme odkaz pro nastavení nového hesla.</div>`; }
      catch (err) { z.innerHTML = `<div class="info chyba">${esc(chybaText(err))}</div>`; }
    };
  }

  // katalog motorů a servisních úkonů (tabulky motory, typy_motoru, servisni_ukony) – stejná pravidla jako E-serviska
  let katalogServisu = null;
  const nactiKatalogServisu = async () => katalogServisu ||= await db.servisniKatalog();
  const normModel = t => String(t || "").toUpperCase().replace(/\s+/g, " ").trim();
  function urciMotor(v, K) {
    const kody = new Set(K.motory.map(m => m.kod));
    if (v?.motor && kody.has(v.motor)) return v.motor;
    const cm = String(v?.cislo_motoru || "").toUpperCase().replace(/\s/g, "").match(/^(OM|M)?(\d{3})/);
    if (cm) { const k = (cm[1] || (cm[2][0] === "6" ? "OM" : "M")) + cm[2]; if (kody.has(k)) return k; }
    const typy = Object.fromEntries(K.typy.map(t => [normModel(t.klic), t.motor]));
    const vk = String(v?.vin || "").toUpperCase().replace(/\s/g, "").match(/^(?:WDB)?(\d{3})(\d{3})/);
    if (vk && typy[vk[1] + "." + vk[2]]) return typy[vk[1] + "." + vk[2]];
    return typy[normModel(v?.model)] || null;
  }
  function servisVozu(v, K) {
    const motor = urciMotor(v, K), m = K.motory.find(x => x.kod === motor);
    const palivo = m ? m.palivo : /\b\d{3}\s*(D|TD|SD|CD|SDL)\b/i.test(v?.model || "") ? "diesel" : "benzin";
    const ukony = K.ukony.filter(u => (!u.jen_palivo || u.jen_palivo === palivo) && (!u.jen_serizovani_ventilu || m?.serizovani_ventilu));
    return { motor, palivo, ukony };
  }
  // skupina intervalů MB podle modelového roku (A 1986+, B 1981–85, C do 1980); jde přepsat u vozidla
  const skupinaServisu = v => v?.servisni_skupina || (!v?.rok ? "A" : v.rok >= 1986 ? "A" : v.rok >= 1981 ? "B" : "C");
  // tajný odkaz na E-servisku konkrétního auta (VIN sám nestačí); při změně majitele se odkaz změní
  const odkazEservisky = v => v?.eserviska_kod ? "https://www.mercedesrestorations.cz/e-serviska?k=" + encodeURIComponent(v.eserviska_kod)
    : "https://www.mercedesrestorations.cz/e-serviska?vin=" + encodeURIComponent(String(v?.vin || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));

  /* ================= přehled zakázek ================= */
  const HOTOVE_STAVY = ["hotovo", "fakturovano", "zaplaceno", "predano"];
  const PORADI_STAVU = ["poptavka", "prijato", "nabidka", "schvaleno", "v_praci", "hotovo", "fakturovano", "zaplaceno", "predano", "zruseno"];
  const RAZENI_ZAKAZEK = {
    "cislo-": ["Nejnovější zakázky", (a, b) => b.cislo - a.cislo],
    "cislo+": ["Nejstarší zakázky", (a, b) => a.cislo - b.cislo],
    "prijem-": ["Datum příjmu ↓", (a, b) => String(b.datum_prijmu || "").localeCompare(String(a.datum_prijmu || "")) || b.cislo - a.cislo],
    "prijem+": ["Datum příjmu ↑", (a, b) => String(a.datum_prijmu || "").localeCompare(String(b.datum_prijmu || "")) || a.cislo - b.cislo],
    "stav": ["Podle stavu", (a, b) => PORADI_STAVU.indexOf(a.stav) - PORADI_STAVU.indexOf(b.stav) || b.cislo - a.cislo],
    "typ": ["Podle typu vozu", (a, b) => String(a.vozidla?.typ || "").localeCompare(String(b.vozidla?.typ || ""), "cs", { numeric: true }) || b.cislo - a.cislo],
    "zakaznik": ["Podle zákazníka A–Z", (a, b) => String(a.zakaznici?.jmeno || "").localeCompare(String(b.zakaznici?.jmeno || ""), "cs") || b.cislo - a.cislo]
  };
  /* ================= úvodní přehled (po přihlášení) ================= */
  async function uvod() {
    const n0 = navId;
    const d0 = new Date(), datumDnes = d0.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const hodina = d0.getHours(), pozdrav = hodina < 10 ? "Dobré ráno" : hodina < 18 ? "Dobrý den" : "Dobrý večer";
    app.innerHTML = `
      <div class="hlavicka-prehledu">
        <div><h1>Přehled</h1><div class="mutted">${pozdrav} · ${esc(datumDnes)}</div></div>
        <a class="tl tl-hlavni tl-velke" href="#/novy">＋ Nový příjem vozu</a>
      </div>
      ${nacti("werk-koncept-prijmu") ? `<div class="info pozor" style="margin:0 0 14px">Máte rozpracovaný příjem. <a href="#/novy"><b>Pokračovat</b></a></div>` : ""}
      <div id="uvod"><div class="nacitani">Načítám přehled…</div></div>`;
    app.querySelector("#uvod").onclick = e => { const a = e.target.closest("[data-filtr]"); if (a) uloz("werk-filtr-zakazek", { ...(nacti("werk-filtr-zakazek") || {}), stav: a.dataset.filtr }); };
    let zak = [], dok = [];
    try { [zak, dok] = await Promise.all([db.zakazky(), db.vsechnyDoklady().catch(() => [])]); }
    catch (e) { app.querySelector("#uvod").innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
    const D = dnes(), za7 = plusDni(D, 7), mesic = D.slice(0, 7);
    const jeFa = d => ["faktura", "zalohova", "opravny"].includes(d.druh);
    const vDilne = zak.filter(z => !HOTOVE_STAVY.includes(z.stav) && !["zruseno", "poptavka"].includes(z.stav))
      .sort((a, b) => String(a.predpoklad_dokonceni || "9999").localeCompare(String(b.predpoklad_dokonceni || "9999")) || a.cislo - b.cislo);
    const kPredani = zak.filter(z => ["hotovo", "fakturovano", "zaplaceno"].includes(z.stav)).sort((a, b) => a.cislo - b.cislo);
    const poptavky = zak.filter(z => z.stav === "poptavka");
    const nezapl = dok.filter(d => (d.druh === "faktura" || d.druh === "zalohova") && !d.zaplaceno && d.celkem != null).sort((a, b) => String(a.splatnost || "").localeCompare(String(b.splatnost || "")));
    const poSpl = nezapl.filter(d => d.splatnost && d.splatnost < D);
    const faMesic = dok.filter(d => (d.druh === "faktura" || d.druh === "opravny") && String(d.vystaveno).startsWith(mesic));
    const suma = a => a.reduce((x, d) => x + (Number(d.celkem) || 0), 0);
    const auto = z => esc([z.vozidla?.typ, z.vozidla?.model].filter(Boolean).join(" · ") || "Mercedes-Benz");
    const termin = z => {
      if (!z.predpoklad_dokonceni) return "";
      const t = z.predpoklad_dokonceni < D ? ` style="color:var(--cervena)"` : z.predpoklad_dokonceni <= za7 ? ` style="color:var(--oranzova)"` : "";
      return ` · <span${t}>${z.predpoklad_dokonceni < D ? "termín byl " : "termín "}${datumCz(z.predpoklad_dokonceni)}</span>`;
    };
    const radek = (z, extra = "") => `
      <a class="zakazka-radek" href="#/zakazka/${z.id}">
        <span class="c">${z.cislo}</span>
        <span class="auto"><b>${auto(z)}</b><small>${esc(z.zakaznici?.jmeno || "")}${extra}</small>${(z.ukoly || []).some(x => String(x.t || "").trim()) && !HOTOVE_STAVY.includes(z.stav) ? listaPostupu(z.ukoly, true) : ""}</span>
        <span class="stitek ${["zaplaceno", "hotovo"].includes(z.stav) ? "hotovo" : ""}">${STAVY[z.stav] || z.stav}</span>
      </a>`;
    const MAX = 6, vice = (n, href, text) => n > MAX ? `<p style="margin:10px 0 0"><a href="${href}">${text} (${n}) →</a></p>` : "";
    const prazdno = !zak.length;
    app.querySelector("#uvod").innerHTML = prazdno ? `<div class="prazdne">Zatím žádné zakázky. První dostane číslo 7377.</div>` : `
      <div class="dlazdice uvod-dlazdice">
        <div class="dlazdice-k"><small>V dílně</small><b>${vDilne.length}</b><span>${vDilne.filter(z => z.predpoklad_dokonceni && z.predpoklad_dokonceni < D).length ? `<span style="color:var(--cervena)">${vDilne.filter(z => z.predpoklad_dokonceni && z.predpoklad_dokonceni < D).length} po termínu</span>` : "rozpracované zakázky"}</span></div>
        <div class="dlazdice-k"><small>K předání</small><b>${kPredani.length}</b><span>hotové, čekají na zákazníka</span></div>
        <div class="dlazdice-k ${poSpl.length ? "cervena" : ""}"><small>Nezaplaceno</small><b>${kc(suma(nezapl))}</b><span>${nezapl.length} ks${poSpl.length ? ` · ${poSpl.length} po splatnosti` : ""}</span></div>
        <div class="dlazdice-k"><small>Fakturováno – ${esc(nazevMesice(mesic))}</small><b>${kc(suma(faMesic))}</b><span>${faMesic.length} ks</span></div>
      </div>
      <section class="karta kalendar" id="kalendar"></section>
      <div class="uvod-mrizka">
        <section class="karta"><h2>V dílně</h2>
          ${vDilne.length ? `<div class="zakazky">${vDilne.slice(0, MAX).map(z => radek(z, termin(z))).join("")}</div>${vice(vDilne.length, "#/zakazky", "Všechny rozpracované").replace("<a ", '<a data-filtr="otevrene" ')}` : `<p class="mutted" style="margin:0">Teď v dílně nic není.</p>`}
        </section>
        <div>
          ${kPredani.length ? `<section class="karta"><h2>Čeká na předání</h2><div class="zakazky">${kPredani.slice(0, MAX).map(z => radek(z)).join("")}</div>${vice(kPredani.length, "#/zakazky", "Všechny")}</section>` : ""}
          ${nezapl.length ? `<section class="karta"><h2>Nezaplacené faktury</h2><div class="doklady">${nezapl.slice(0, MAX).map(d => `
            <a class="doklad odkaz-radek" href="${d.zakazky?.id ? `#/zakazka/${d.zakazky.id}` : "#/doklady"}"><span><b>${esc(d.cislo)}</b> · ${esc(d.zakazky?.zakaznici?.jmeno || "")}
              <br><small class="mutted">${d.splatnost ? (d.splatnost < D ? `<b style="color:var(--cervena)">po splatnosti od ${datumCz(d.splatnost)}</b>` : `splatnost ${datumCz(d.splatnost)}`) : `vystaveno ${datumCz(d.vystaveno)}`}</small></span>
              <b>${kc(d.celkem)}</b></a>`).join("")}</div>${vice(nezapl.length, "#/doklady", "Všechny doklady")}</section>` : ""}
          ${poptavky.length ? `<section class="karta"><h2>Poptávky</h2><div class="zakazky">${poptavky.slice(0, MAX).map(z => radek(z, ` · ${datumCz(z.datum_prijmu)}`)).join("")}</div></section>` : ""}
          ${dok.length ? `<section class="karta"><h2>Poslední doklady</h2><div class="doklady">${dok.slice(0, 4).map(d => `
            <a class="doklad odkaz-radek" href="${d.zakazky?.id ? `#/zakazka/${d.zakazky.id}` : "#/doklady"}"><span><b>${esc(d.cislo)}</b> · ${DRUHY[d.druh] || d.druh}<br><small class="mutted">${esc(d.zakazky?.zakaznici?.jmeno || "")} · ${datumCz(d.vystaveno)}</small></span>
              ${d.celkem != null && jeFa(d) ? `<b>${kc(d.celkem)}</b>` : ""}</a>`).join("")}</div></section>` : ""}
        </div>
      </div>`;
    if (!prazdno) vykresliKalendar(zak);
  }
  /* ---------- kalendář: příjmy, termíny dokončení, předání + vlastní termíny ---------- */
  const MESICE = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
  const isoDen = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let K_STAV = null;
  async function vykresliKalendar(zak) {
    const el = document.getElementById("kalendar"); if (!el) return;
    const D = dnes();
    K_STAV ||= { mesic: D.slice(0, 7), den: D };
    const [r, m] = K_STAV.mesic.split("-").map(Number), prvni = new Date(r, m - 1, 1), posledni = new Date(r, m, 0);
    const start = new Date(prvni); start.setDate(1 - ((prvni.getDay() + 6) % 7));            // pondělí
    const konec = new Date(posledni); konec.setDate(posledni.getDate() + (7 - ((posledni.getDay() + 6) % 7)) - 1);
    let vlastni = [];
    try { vlastni = await db.kalendar(isoDen(start), isoDen(konec)); } catch (e) { /* bez tabulky jen zakázky */ }
    if (!document.body.contains(el)) return;
    const U = {};                                     // datum → události
    const pridej = (d, u) => { if (d) (U[d] ||= []).push(u); };
    const nazev = z => `#${z.cislo} ${[z.vozidla?.typ, z.vozidla?.model].filter(Boolean).join(" ")}`;
    zak.filter(z => z.stav !== "zruseno").forEach(z => {
      pridej(z.datum_prijmu, { druh: "prijem", text: `Příjem ${nazev(z)}`, pod: z.zakaznici?.jmeno, href: `#/zakazka/${z.id}` });
      if (!HOTOVE_STAVY.includes(z.stav) && z.stav !== "poptavka") pridej(z.predpoklad_dokonceni, { druh: "termin", text: `Termín dokončení ${nazev(z)}`, pod: z.zakaznici?.jmeno, href: `#/zakazka/${z.id}` });
      if (z.datum_predani) pridej(z.datum_predani, { druh: "predani", text: `Předání ${nazev(z)}`, pod: z.zakaznici?.jmeno, href: `#/zakazka/${z.id}` });
    });
    vlastni.forEach(k => { const z = zak.find(x => x.id === k.zakazka_id); pridej(k.datum, { druh: "vlastni", id: k.id, cas: k.cas ? String(k.cas).slice(0, 5) : "", text: k.text, pod: z ? nazev(z) : "", href: z ? `#/zakazka/${z.id}` : "" }); });
    const dny = []; for (let d = new Date(start); d <= konec; d.setDate(d.getDate() + 1)) dny.push(isoDen(d));
    const vyb = U[K_STAV.den] || [], denObj = new Date(K_STAV.den + "T12:00:00");
    el.innerHTML = `<div class="kal-hlava"><h2 style="margin:0">Kalendář</h2>
        <span class="radek-tlacitek"><button type="button" class="tl tl-male tl-ikona" data-kal="-1" aria-label="Předchozí měsíc">‹</button>
        <b class="kal-mesic">${MESICE[m - 1]} ${r}</b>
        <button type="button" class="tl tl-male tl-ikona" data-kal="1" aria-label="Další měsíc">›</button>
        ${K_STAV.mesic !== D.slice(0, 7) ? `<button type="button" class="tl tl-male" data-kal="0">Dnes</button>` : ""}</span></div>
      <div class="kal-mrizka">${["po", "út", "st", "čt", "pá", "so", "ne"].map(x => `<div class="kal-dn">${x}</div>`).join("")}
        ${dny.map(d => { const u = U[d] || []; const druhy = [...new Set(u.map(x => x.druh))];
          return `<button type="button" class="kal-den${d.slice(0, 7) !== K_STAV.mesic ? " jiny" : ""}${d === D ? " dnes" : ""}${d === K_STAV.den ? " vybrany" : ""}" data-den="${d}" aria-label="${datumCz(d)}${u.length ? `, ${u.length} událostí` : ""}">
            <span>${+d.slice(8)}</span><span class="kal-tecky">${druhy.map(x => `<i class="kal-${x}"></i>`).join("")}</span></button>`; }).join("")}</div>
      <div class="kal-legenda"><span><i class="kal-prijem"></i>příjem</span><span><i class="kal-termin"></i>termín dokončení</span><span><i class="kal-predani"></i>předání</span><span><i class="kal-vlastni"></i>vlastní</span></div>
      <div class="kal-detail"><b>${denObj.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}</b>
        ${vyb.length ? `<div class="kal-udalosti">${vyb.sort((a, b) => String(a.cas || "").localeCompare(String(b.cas || ""))).map(u => `<div class="kal-udalost"><i class="kal-${u.druh}"></i>
          ${u.href ? `<a href="${u.href}">` : "<span>"}${u.cas ? `<b>${esc(u.cas)}</b> ` : ""}${esc(u.text)}${u.pod ? `<small class="mutted"> · ${esc(u.pod)}</small>` : ""}${u.href ? "</a>" : "</span>"}
          ${u.id ? `<button type="button" class="tl tl-male tl-kos" data-kal-smazat="${u.id}" aria-label="Smazat termín">🗑</button>` : ""}</div>`).join("")}</div>`
          : `<p class="mutted" style="margin:6px 0 0">Nic naplánováno.</p>`}
        <form class="kal-novy" id="kal-novy">
          <input class="vstup" name="text" placeholder="Nový termín – např. přivezou 280 SL" required maxlength="200">
          <input class="vstup" name="cas" type="time" aria-label="Čas (nepovinné)">
          <select class="vstup" name="zakazka" aria-label="K zakázce (nepovinné)"><option value="">bez zakázky</option>${zak.filter(z => z.stav !== "zruseno").slice(0, 60).map(z => `<option value="${z.id}">${esc(nazev(z))}</option>`).join("")}</select>
          <button class="tl tl-hlavni">＋ Přidat</button></form></div>`;
    el.querySelectorAll("[data-kal]").forEach(b => b.onclick = () => {
      const k = +b.dataset.kal; if (!k) { K_STAV = { mesic: D.slice(0, 7), den: D }; }
      else { const n = new Date(r, m - 1 + k, 1); K_STAV.mesic = isoDen(n).slice(0, 7); K_STAV.den = isoDen(n); }
      vykresliKalendar(zak); });
    el.querySelectorAll("[data-den]").forEach(b => b.onclick = () => { K_STAV.den = b.dataset.den; if (b.dataset.den.slice(0, 7) !== K_STAV.mesic) K_STAV.mesic = b.dataset.den.slice(0, 7); vykresliKalendar(zak); });
    el.querySelectorAll("[data-kal-smazat]").forEach(b => b.onclick = async () => {
      if (!confirm("Smazat tento termín?")) return;
      try { await db.smazatRadek("kalendar", b.dataset.kalSmazat); vykresliKalendar(zak); } catch (e) { hlaska(chybaText(e), true); } });
    el.querySelector("#kal-novy").onsubmit = async e => {
      e.preventDefault(); const f = e.target, t = f.text.value.trim(); if (!t) return;
      f.querySelector("button").disabled = true;
      try { await db.vlozit("kalendar", [{ datum: K_STAV.den, cas: f.cas.value || null, text: t, zakazka_id: f.zakazka.value || null }]); hlaska("Termín přidán."); vykresliKalendar(zak); }
      catch (err) { f.querySelector("button").disabled = false; hlaska(chybaText(err), true); }
    };
  }

  async function prehled() {
    const n0 = navId;
    app.innerHTML = `
      <div class="hlavicka-prehledu">
        <h1>Zakázky</h1>
        <a class="tl tl-hlavni tl-velke" href="#/novy">＋ Nový příjem vozu</a>
      </div>
      ${nacti("werk-koncept-prijmu") ? `<div class="info pozor" style="margin:0 0 14px">Máte rozpracovaný příjem. <a href="#/novy"><b>Pokračovat</b></a></div>` : ""}
      <input class="vstup" id="filtr" type="search" placeholder="Hledat: číslo, zákazník, model, VIN, SPZ" style="margin-bottom:10px">
      <div class="filtry-zakazek">
        <select class="vstup" id="f-stav" aria-label="Stav"><option value="">Všechny stavy</option><option value="otevrene">Rozpracované</option><option value="hotove">Hotové / předané</option>
          ${Object.entries(STAVY).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>
        <select class="vstup" id="f-typ" aria-label="Typ vozu"><option value="">Všechny typy</option></select>
        <select class="vstup" id="f-razeni" aria-label="Řazení">${Object.entries(RAZENI_ZAKAZEK).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join("")}</select>
        <span class="napoveda" id="f-pocet"></span>
      </div>
      <div class="zakazky" id="seznam"><div class="nacitani">Načítám zakázky…</div></div>`;
    let data = [];
    try { data = await db.zakazky(); } catch (e) { app.querySelector("#seznam").innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
    const F = { stav: "", typ: "", razeni: "stav", ...(nacti("werk-filtr-zakazek") || {}) };
    if (!F.v2) { F.razeni = "stav"; F.v2 = 1; uloz("werk-filtr-zakazek", F); }   // 30.10.2026: výchozí řazení „Podle stavu“
    const typy = [...new Set(data.map(z => z.vozidla?.typ).filter(Boolean))].sort((a, b) => a.localeCompare(b, "cs", { numeric: true }));
    app.querySelector("#f-typ").insertAdjacentHTML("beforeend", typy.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join(""));
    if (F.typ && !typy.includes(F.typ)) F.typ = "";
    if (!RAZENI_ZAKAZEK[F.razeni]) F.razeni = "stav";
    app.querySelector("#f-stav").value = F.stav; app.querySelector("#f-typ").value = F.typ; app.querySelector("#f-razeni").value = F.razeni;
    const vykresli = q => {
      const t = q.trim().toLowerCase();
      const r = data.filter(z => !t || [z.cislo, z.zakaznici?.jmeno, z.zakaznici?.telefon, z.vozidla?.model, z.vozidla?.typ, z.vozidla?.vin, z.vozidla?.spz]
        .some(x => String(x ?? "").toLowerCase().includes(t)))
        .filter(z => !F.stav || (F.stav === "hotove" ? HOTOVE_STAVY.includes(z.stav) : F.stav === "otevrene" ? !HOTOVE_STAVY.includes(z.stav) && z.stav !== "zruseno" : z.stav === F.stav))
        .filter(z => !F.typ || z.vozidla?.typ === F.typ)
        .sort(RAZENI_ZAKAZEK[F.razeni][1]);
      app.querySelector("#f-pocet").textContent = r.length === data.length ? `${data.length} zakázek` : `${r.length} z ${data.length}`;
      app.querySelector("#seznam").innerHTML = r.length ? r.map(z => `
        <a class="zakazka-radek" href="#/zakazka/${z.id}">
          <span class="c">${z.cislo}</span>
          <span class="auto"><b>${esc([z.vozidla?.typ, z.vozidla?.model].filter(Boolean).join(" · ") || "Mercedes-Benz")}${z.vozidla?.rok ? ` (${z.vozidla.rok})` : ""}</b>
            <small>${esc(z.zakaznici?.jmeno || "")} · přijato ${datumCz(z.datum_prijmu)}${z.vozidla?.spz ? " · " + esc(z.vozidla.spz) : ""}</small></span>
          <span class="stitek ${["predano", "zaplaceno", "hotovo"].includes(z.stav) ? "hotovo" : z.stav === "zruseno" ? "zruseno" : ""}">${STAVY[z.stav] || z.stav}</span>
        </a>`).join("") : `<div class="prazdne">${data.length ? "Nic nenalezeno." : "Zatím žádné zakázky. První dostane číslo 7377."}</div>`;
    };
    vykresli("");
    app.querySelector("#filtr").oninput = e => vykresli(e.target.value);
    [["#f-stav", "stav"], ["#f-typ", "typ"], ["#f-razeni", "razeni"]].forEach(([sel, k]) => app.querySelector(sel).onchange = e => {
      F[k] = e.target.value; uloz("werk-filtr-zakazek", F); vykresli(app.querySelector("#filtr").value); });
  }

  /* ================= příjem vozu ================= */
  const KONCEPT = "werk-koncept-prijmu";
  function novyPrijem() {
    return {
      zakaznik: { id: null, je_firma: false, jmeno: "", kontaktni_osoba: "", ico: "", dic: "", ulice: "", psc: "", mesto: "", zeme: "Česká Republika", telefon: "", email: "", jazyk: "cs" },
      vozidlo: { vin: "", typ: "", model: "", rok: "", spz: "", barva: "", verze: "EU", jednotka_tachometru: "km" },
      zakazka: { datum_prijmu: dnes(), predpoklad_dokonceni: plusDni(dnes(), DNI_DOKONCENI), km_prijem: "", nadrz_prijem: "1/2", tp_prilozen: true, zavady: [""], stav_prijem: [""], odhad_ceny: "", jazyk: "cs" },
      fotky: [], tp: { predni: null, zadni: null }, podpisZakaznik: null, vysledek: null, krok: "formular",
      rucne: { datum: false, dokonceni: false }       // true = datum změněné ručně, pak ho aplikace sama nepřepisuje
    };
  }
  let P = null;               // rozpracovaný příjem
  const blobyFotek = {};      // id fotky → zmenšený soubor (jen v paměti, než se nahraje)
  let posledniPdf = null;     // {zakazka_id, cislo, bytes}

  // koncept příjmu v iPadu: fotky bez náhledů (náhled se při obnově načte z úložiště), aby se paměť prohlížeče nepřeplnila
  function ulozKoncept() {
    if (!P) return;
    let ok = true;
    try { localStorage.setItem(KONCEPT, JSON.stringify({ ...P, fotky: P.fotky.filter(f => f.klic && f.stav === "nahrano").map(({ nahled, ...f }) => f) })); }
    catch (e) { ok = false; }
    const s = document.getElementById("stav-ulozeni");
    if (s) { s.textContent = ok ? "Rozpracováno – uloženo v iPadu" : "⚠︎ Rozpracovaný příjem se nepodařilo uložit v iPadu – dokončete ho"; s.style.color = ok ? "" : "var(--cervena)"; }
    kontrolaPripravenosti();
  }

  function prijem() {
    const koncept = nacti(KONCEPT);
    P = koncept || novyPrijem();
    P.rucne = P.rucne || { datum: false, dokonceni: false };
    const bezNahledu = P.fotky.filter(f => !f.nahled && f.klic);
    if (bezNahledu.length) db.odkazy(bezNahledu.map(f => f.klic)).then(u => {      // náhledy fotek z rozpracovaného příjmu
      (u || []).forEach(x => { const f = bezNahledu.find(f => f.klic === x.path); if (f && x.signedUrl) f.nahled = x.signedUrl; });
      if (document.getElementById("fotky")) vykresliFotky();
    }).catch(() => {});
    if (!P.vysledek) {                                 // rozpracovaný příjem z jiného dne: datum vždy dnešní
      if (!P.rucne.datum) P.zakazka.datum_prijmu = dnes();
      if (!P.rucne.dokonceni) P.zakazka.predpoklad_dokonceni = plusDni(P.zakazka.datum_prijmu, DNI_DOKONCENI);
      if (koncept) ulozKoncept();
    }
    if (P.krok === "podpis") return prijemPodpis();
    vykresliFormular();
  }

  function pole(cesta, popis, { typ = "text", sirka = "", attrs = "", napoveda = "", povinne = false } = {}) {
    const [o, k] = cesta.split(".");
    return `<label class="pole ${sirka}"><span class="${povinne ? "povinne" : ""}">${popis}</span>
      <input type="${typ}" data-pole="${cesta}" value="${esc(P[o][k])}" ${attrs}>${napoveda ? `<span class="napoveda">${napoveda}</span>` : ""}</label>`;
  }
  function segment(cesta, moznosti) {
    const [o, k] = cesta.split(".");
    return `<div class="segment" data-segment="${cesta}">${moznosti.map(([hodnota, text]) =>
      `<button type="button" data-hodnota="${esc(JSON.stringify(hodnota))}" aria-pressed="${P[o][k] === hodnota}">${esc(text)}</button>`).join("")}</div>`;
  }
  // odhad, kolik řádků zabere text na zakázkovém listu (cca 54 znaků na řádek); přesně to pak ověří náhled listu
  const radkuNaListu = pole => (pole || []).filter(t => String(t).trim()).reduce((n, t) => n + Math.max(1, Math.ceil(String(t).trim().length / 54)), 0);
  function seznamRadku(klic, max) {
    return `<div class="seznam-radku" data-seznam="${klic}">${P.zakazka[klic].map((t, i) => `
      <div class="radek-polozky"><span class="tecka">●</span>
        <textarea class="vstup" rows="1" data-radek="${klic}" data-i="${i}" placeholder="${klic === "zavady" ? "Např. Svítí kontrolka ASD" : "Např. Zadní anténa nefunkční"}">${esc(t)}</textarea>
        <button type="button" class="tl smazat" data-smazat="${klic}" data-i="${i}" aria-label="Smazat řádek">×</button></div>`).join("")}
      </div>
      <div class="radek-tlacitek" style="margin-top:10px"><button type="button" class="tl tl-male" data-pridat="${klic}">＋ Přidat řádek</button>
        <span class="napoveda" data-zbyva="${klic}" data-max="${max}">Na zakázkový list se vejde ${max} řádků (dlouhé položky se zalomí).</span></div>
      <div class="cipy">${RYCHLE[P.zakazka.jazyk][klic === "zavady" ? "zavady" : "stav"].map(t => `<button type="button" class="cip" data-cip="${klic}">${esc(t)}</button>`).join("")}</div>`;
  }

  function vykresliFormular() {
    const z = P.zakaznik, v = P.vozidlo, k = P.zakazka;
    const vin = rozlustitVin(v.vin);
    app.innerHTML = `
      <h1>Nový příjem vozu</h1>

      <section class="karta" id="sekce-zakaznik">
        <h2><span class="cislo-kroku">1</span>Zákazník</h2>
        ${z.id ? `<div class="vybrany"><span>Stávající zákazník <b>${esc(z.jmeno)}</b> – změny se uloží k němu.</span>
          <button type="button" class="tl tl-male" id="jiny-zakaznik">Jiný zákazník</button></div>`
        : `<input class="vstup" id="hledat" type="search" placeholder="Najít stávajícího zákazníka: jméno, telefon nebo e-mail" autocomplete="off">
           <div class="vysledky" id="vysledky"></div>
           <p class="popis" style="margin:12px 0 14px">Nebo vyplňte nového:</p>`}
        <div class="mrizka">
          <div class="s6">${segment("zakaznik.je_firma", [[false, "Osoba"], [true, "Firma"]])}</div>
          ${pole("zakaznik.jmeno", z.je_firma ? "Název firmy" : "Jméno a příjmení", { sirka: "s3", povinne: true, attrs: 'autocomplete="off"' })}
          ${z.je_firma ? pole("zakaznik.kontaktni_osoba", "Kontaktní osoba", { sirka: "s3" }) : `<div class="s3"></div>`}
          ${z.je_firma ? pole("zakaznik.ico", "IČO", { sirka: "s3", attrs: 'inputmode="numeric"' }) + pole("zakaznik.dic", "DIČ", { sirka: "s3" }) : ""}
          ${pole("zakaznik.ulice", "Ulice a číslo", { sirka: "s3" })}
          ${pole("zakaznik.psc", "PSČ", { sirka: "s2", attrs: 'inputmode="numeric"' })}
          ${pole("zakaznik.mesto", "Město", { sirka: "s4" })}
          ${pole("zakaznik.zeme", "Země", { sirka: "s2" })}
          ${pole("zakaznik.telefon", "Telefon", { typ: "tel", sirka: "s3", povinne: !z.email.trim(), attrs: 'autocomplete="off"', napoveda: "Telefon nebo e-mail – stačí jedno." })}
          ${pole("zakaznik.email", "E-mail", { typ: "email", sirka: "s3", povinne: !z.telefon.trim(), attrs: 'autocomplete="off" inputmode="email"' })}
          <div class="s3"><label class="pole">Jazyk dokladů</label>${segment("zakaznik.jazyk", [["cs", "Čeština"], ["en", "English"]])}</div>
        </div>
        <div class="radek-tlacitek ulozit-sekci"><button type="button" class="tl" id="ulozit-zakaznika">💾 Uložit zákazníka</button>
          <span class="napoveda">Uloží zákazníka do databáze i bez příjmu auta.</span></div>
      </section>

      <section class="karta" id="sekce-vozidlo">
        <h2><span class="cislo-kroku">2</span>Vozidlo</h2>
        <div id="auta-zakaznika"></div>
        <div class="mrizka">
          ${pole("vozidlo.vin", "VIN / číslo podvozku", { sirka: "s4", povinne: true, attrs: 'class="vin" autocomplete="off" autocapitalize="characters" spellcheck="false"',
            napoveda: vin ? `Typ ${vin.typ}, kód modelu ${vin.kod}` : "" })}
          ${pole("vozidlo.spz", "SPZ", { sirka: "s2", attrs: 'autocapitalize="characters"' })}
          ${pole("vozidlo.typ", "Typ", { sirka: "s2", attrs: 'placeholder="126" list="dl-typ" autocomplete="off"' })}
          ${pole("vozidlo.model", "Model", { sirka: "s2", povinne: true, attrs: 'placeholder="300 SE" list="dl-model" autocomplete="off"' })}
          ${pole("vozidlo.rok", "Rok výroby", { sirka: "s2", attrs: 'inputmode="numeric" placeholder="1989" list="dl-rok" autocomplete="off"' })}
          ${pole("vozidlo.barva", "Barva", { sirka: "s2" })}
          <div class="s2"><label class="pole">Verze</label>${segment("vozidlo.verze", [["EU", "EU"], ["US", "US"], ["JP", "JP"]])}</div>
          <div class="s2"><label class="pole">Tachometr</label>${segment("vozidlo.jednotka_tachometru", [["km", "km"], ["mi", "míle"]])}</div>
        </div>
        <datalist id="dl-typ"></datalist><datalist id="dl-model"></datalist><datalist id="dl-rok"></datalist>
        <div id="info-katalog"></div>
        <div id="info-vin"></div>
        <div id="zmena-majitele"></div>
        <div class="radek-tlacitek ulozit-sekci"><button type="button" class="tl" id="ulozit-vozidlo">💾 Uložit vozidlo</button>
          <span class="napoveda">Uloží auto (i s fotkami TP)${z.id ? ` a přiřadí ho zákazníkovi ${esc(z.jmeno)}` : ""} bez zakládání zakázky.</span></div>
      </section>

      <section class="karta" id="sekce-prijem">
        <h2><span class="cislo-kroku">3</span>Příjem</h2>
        <div class="mrizka">
          ${pole("zakazka.datum_prijmu", "Datum převzetí", { typ: "date", sirka: "s2" })}
          ${pole("zakazka.km_prijem", `Stav tachometru (${v.jednotka_tachometru === "mi" ? "míle" : "km"})`, { sirka: "s2", povinne: true, attrs: 'inputmode="numeric"' })}
          ${pole("zakazka.predpoklad_dokonceni", "Předpoklad dokončení", { typ: "date", sirka: "s2", napoveda: P.rucne.dokonceni ? "" : `Převzetí + ${DNI_DOKONCENI} dní` })}
          <div class="s4"><label class="pole">Stav nádrže</label>${segment("zakazka.nadrz_prijem", NADRZ.map(n => [n, n]))}</div>
          <div class="s2"><label class="pole">TP přiložen</label>${segment("zakazka.tp_prilozen", [[true, "Ano"], [false, "Ne"]])}</div>
        </div>
        ${k.tp_prilozen ? `<div class="tp-strany">${[["predni", "TP – přední strana"], ["zadni", "TP – zadní strana"]].map(([str, popis]) => {
          const f = P.tp?.[str];
          return `<div class="tp-strana ${f?.stav || ""}" data-tp="${str}">
            <div class="tp-nahled">${f?.nahled ? `<img src="${f.nahled}" alt="">` : f?.mime === "application/pdf" ? `<span class="tp-pdf">PDF</span>` : `<span class="mutted">${popis}</span>`}</div>
            <div class="tp-akce"><b>${popis}</b>
              <span class="stav-tp">${!f ? "" : f.stav === "nahrano" ? "✓ Nahráno" : f.stav === "chyba" ? "Nenahráno – zkuste znovu" : "Nahrávám…"}</span>
              <label class="tl tl-male">${f ? "Vyfotit znovu" : "📷 Vyfotit / naskenovat"}<input type="file" accept="image/*,application/pdf" data-tp-vstup="${str}" hidden></label></div>
          </div>`; }).join("")}
          <p class="napoveda" style="grid-column:1/-1;margin:0">Fotku nebo sken PDF z iPadu (u výběru souboru i „Naskenovat dokumenty“). Uloží se k autu a zobrazí se v E-servisce mezi dokumenty ke stažení.</p></div>` : ""}
      </section>

      <section class="karta" id="sekce-zavady">
        <h2><span class="cislo-kroku">4</span><span class="povinne">Popis závad a objednaných oprav</span></h2>
        ${seznamRadku("zavady", 8)}
      </section>

      <section class="karta" id="sekce-stav">
        <h2><span class="cislo-kroku">5</span>Stav při převzetí do opravy</h2>
        ${seznamRadku("stav_prijem", 7)}
      </section>

      <section class="karta" id="sekce-odhad">
        <h2><span class="cislo-kroku">6</span>Odhadovaná cena</h2>
        <div class="mrizka">
          ${pole("zakazka.odhad_ceny", "Odhadovaná cena (Kč)", { sirka: "s2", attrs: 'inputmode="numeric" placeholder="40 000"', napoveda: "Nevyplníte-li, na listu nebude." })}
        </div>
      </section>

      <section class="karta" id="sekce-fotky">
        <h2><span class="cislo-kroku">7</span>Fotky a videa při převzetí</h2>
        <div class="radek-tlacitek">
          <label class="tl tl-hlavni">📷 Vyfotit<input id="foto-kamera" type="file" accept="image/*" capture="environment" hidden></label>
          <label class="tl tl-hlavni">🎥 Natočit video<input id="video-kamera" type="file" accept="video/*" capture="environment" hidden></label>
          <label class="tl">Vybrat z galerie<input id="foto-galerie" type="file" accept="image/*,video/*" multiple hidden></label>
          <span class="napoveda" id="pocet-fotek"></span>
        </div>
        ${matchMedia("(pointer: coarse)").matches ? "" : `<div class="info" style="margin:12px 0 0">Na počítači prohlížeč umí jen vybrat soubor. Na iPadu a iPhonu „Vyfotit“ a „Natočit video“ rovnou otevřou fotoaparát a „Vybrat z galerie“ nabídne Fotky nebo Soubory.</div>`}
        <p class="napoveda limity">
          <b>Fotky:</b> libovolný počet, samy se zmenší.<br>
          <b>Video:</b> nejvýš ${MAX_VIDEO_MB} MB na jedno video – to je asi <b>30 s ve Full HD (1080p)</b> nebo <b>15 s ve 4K</b>.
          Delší záběr natočte na víc kratších videí. Tip: v iPadu Nastavení → Fotoaparát → Záznam videa → 1080p.
        </p>
        <div id="souhrn-nahrani"></div>
        <div class="fotky" id="fotky"></div>
      </section>

      <div class="akce-dole"><div class="vnitrek">
        <button type="button" class="tl tl-text tl-nebezpecne" id="zahodit">Zahodit<span class="jen-siroke"> příjem</span></button>
        <span class="stav-ulozeni" id="stav-ulozeni"></span>
        <button type="button" class="co-chybi" id="co-chybi" hidden></button>
        <button type="button" class="tl tl-hlavni tl-velke" id="k-podpisu" disabled><span class="jen-siroke">Náhled a podpis</span><span class="jen-uzke">Podpis</span> →</button>
      </div></div>`;

    vazbyFormulare();
    vykresliFotky();
    kontrolaPripravenosti();
    if (v.vin) zkontrolujVin(false);
    napojKatalog(app, () => P?.vozidlo, (k, h) => { P.vozidlo[k] = h; ulozKoncept(); });
  }
  /* ---------- katalog vozů: nabídka typu / modelu / roku podle toho, co dává smysl ---------- */
  let katalogVozu = null, katalogNacitam = null;
  const nactiKatalogVozu = () => katalogNacitam ||= (db.katalogVozu ? db.katalogVozu() : Promise.resolve([])).then(k => (katalogVozu = k || [])).catch(() => { katalogNacitam = null; return []; });
  const cislaRady = t => String(t || "").replace(/\D/g, "").slice(0, 3);
  const doRoku = r => r.do || new Date().getFullYear();
  const normModelu = t => String(t || "").toUpperCase().replace(/\s+/g, " ").replace(/\b(COUPÉ|COUPE|CABRIOLET|KABRIOLET)\b/g, "").trim();
  // co katalog ví o autě: podle kódu z VIN (126.024), jinak podle typu + modelu (+ roku)
  function vuzVKatalogu(v) {
    const K = katalogVozu || []; if (!K.length) return [];
    const kod = rozlustitVin(v.vin)?.kod, rok = Number(v.rok) || null;
    let r = kod ? K.filter(x => x.typ === kod) : [];
    if (!r.length && v.model) r = K.filter(x => (!cislaRady(v.typ) || cislaRady(x.rada) === cislaRady(v.typ)) && normModelu(x.model) === normModelu(v.model));
    if (rok && r.length > 1) { const s = r.filter(x => x.od <= rok && rok <= doRoku(x)); if (s.length) r = s; }
    return r;
  }
  async function napojKatalog(root, vozidlo, nastav) {
    await nactiKatalogVozu(); if (!katalogVozu?.length || !root.isConnected) return;
    const inp = k => root.querySelector(`[data-pole="vozidlo.${k}"], [name="${k}"][data-katalog]`);
    const obnov = () => {
      const v = vozidlo(); if (!v) return;
      const K = katalogVozu, rok = /^\d{4}$/.test(String(v.rok || "").trim()) ? Number(v.rok) : null, rada = cislaRady(v.typ);
      // typy (řady), které se v daném roce vyráběly
      const rady = {}; K.filter(x => !rok || (x.od <= rok && rok <= doRoku(x))).forEach(x => { const c = cislaRady(x.rada); const r = rady[c] ||= { nazvy: new Set(), od: 9999, do: 0 }; r.nazvy.add(x.rada); r.od = Math.min(r.od, x.od); r.do = Math.max(r.do, doRoku(x)); });
      root.querySelector("#dl-typ").innerHTML = Object.entries(rady).sort().map(([c, r]) => `<option value="${c}">${esc([...r.nazvy].join("/"))} · ${r.od}–${r.do}</option>`).join("");
      // modely dané řady (a roku)
      const m = {}; K.filter(x => (!rada || cislaRady(x.rada) === rada) && (!rok || (x.od <= rok && rok <= doRoku(x)))).forEach(x => { (m[x.model] ||= []).push(x); });
      root.querySelector("#dl-model").innerHTML = Object.entries(m).sort((a, b) => a[0].localeCompare(b[0], "cs", { numeric: true })).map(([n, r]) => `<option value="${esc(n)}">${esc(r[0].rada)} · ${esc([...new Set(r.map(x => x.typ))].join(", "))} · ${Math.min(...r.map(x => x.od))}–${Math.max(...r.map(doRoku))}</option>`).join("");
      // roky podle zvoleného modelu / řady
      const zdroj = vuzVKatalogu({ ...v, rok: null }).length ? vuzVKatalogu({ ...v, rok: null }) : rada ? K.filter(x => cislaRady(x.rada) === rada) : [];
      const od = zdroj.length ? Math.min(...zdroj.map(x => x.od)) : null, doo = zdroj.length ? Math.max(...zdroj.map(doRoku)) : null;
      root.querySelector("#dl-rok").innerHTML = od ? Array.from({ length: doo - od + 1 }, (_, i) => `<option value="${od + i}"></option>`).join("") : "";
      // kontrola: sedí rok k typu / modelu?
      const info = root.querySelector("#info-katalog"), r = vuzVKatalogu(v);
      const mimo = rok && od && (rok < od - 1 || rok > doo + 1);
      const ri = inp("rok");                            // červeně jen to, co označil katalog (základní kontrolu roku nerušit)
      if (ri && mimo) { ri.classList.add("neplatne"); ri.dataset.katalogChyba = "1"; }
      else if (ri?.dataset.katalogChyba) { delete ri.dataset.katalogChyba; ri.classList.remove("neplatne"); ri.dispatchEvent(new Event("blur")); }
      if (mimo) info.innerHTML = `<div class="info pozor" style="margin-top:10px">${esc(r[0] ? `${r[0].model} (${r[0].rada})` : `Typ ${rada}`)} se vyráběl ${od}–${doo}. Zkontrolujte rok výroby${rozlustitVin(v.vin) ? " nebo VIN" : ""}.</div>`;
      else if (r.length) { const x = r[0]; info.innerHTML = `<p class="napoveda" style="margin:8px 0 0">📘 Katalog: <b>${esc(x.model)}</b> · ${esc(x.rada)}${x.karoserie ? " " + esc(x.karoserie) : ""} · ${esc([...new Set(r.map(y => y.typ))].join(", "))} · ${Math.min(...r.map(y => y.od))}–${Math.max(...r.map(doRoku))}${x.motor ? ` · motor ${esc([...new Set(r.map(y => y.motor))].join(" / "))}` : ""}</p>`; }
      else info.innerHTML = "";
    };
    // z VIN: doplnit typ a model, když jsou prázdné
    const zVinu = () => {
      const v = vozidlo(); if (!v) return; const kod = rozlustitVin(v.vin)?.kod; if (!kod) return;
      const r = (katalogVozu || []).filter(x => x.typ === kod); if (!r.length) return;
      if (!String(v.model || "").trim()) { nastav("model", r[0].model); const i = inp("model"); if (i) i.value = r[0].model; }
      if (!String(v.typ || "").trim()) { const c = cislaRady(r[0].rada); nastav("typ", c); const i = inp("typ"); if (i) i.value = c; }
    };
    ["typ", "model", "rok", "vin"].forEach(k => { const i = inp(k); if (i) i.addEventListener("input", () => setTimeout(() => { if (k === "vin") zVinu(); obnov(); })); });
    zVinu(); obnov();
  }

  /* Co ještě chybí, než jde k náhledu a podpisu: povinná pole + nedokončené nahrávání fotek a videí */
  function coChybi() {
    const z = P.zakaznik, v = P.vozidlo, k = P.zakazka, ch = [];
    if (!z.jmeno.trim()) ch.push(["jméno zákazníka", '[data-pole="zakaznik.jmeno"]']);
    if (!z.telefon.trim() && !z.email.trim()) ch.push(["telefon nebo e-mail", '[data-pole="zakaznik.telefon"]']);
    if (v.vin.replace(/\s/g, "").length < 8) ch.push(["VIN", '[data-pole="vozidlo.vin"]']);
    if (!v.model.trim()) ch.push(["model", '[data-pole="vozidlo.model"]']);
    if (cisloZ(k.km_prijem) == null || isNaN(cisloZ(k.km_prijem))) ch.push(["stav tachometru", '[data-pole="zakazka.km_prijem"]']);
    if (!k.zavady.some(t => t.trim())) ch.push(["aspoň jedna závada", '#sekce-zavady textarea']);
    for (const [cesta, pr] of Object.entries(PRAVIDLO_POLE)) {          // nesmyslné hodnoty (VIN, rok, km, telefon, e-mail, PSČ, data)
      if (!cesta.includes(".")) continue;
      const [o, kl] = cesta.split("."), chyba = PRAVIDLA[pr](P[o][kl], P.zakaznik.zeme);
      if (chyba) ch.push([chyba.charAt(0).toLowerCase() + chyba.slice(1), `[data-pole="${cesta}"]`]);
    }
    if (k.predpoklad_dokonceni && k.datum_prijmu && k.predpoklad_dokonceni < k.datum_prijmu) ch.push(["dokončení je dřív než převzetí", '[data-pole="zakazka.predpoklad_dokonceni"]']);
    if (jinyNezMajitel() && P.zmenaMajitele == null) ch.push(["změnilo auto majitele?", "#zmena-majitele"]);
    if (radkuNaListu(k.zavady) > 8) ch.push(["závady se nevejdou na list (max. 8 řádků) – zkraťte nebo slučte", "#sekce-zavady"]);
    if (radkuNaListu(k.stav_prijem) > 7) ch.push(["stav při převzetí se nevejde na list (max. 7 řádků)", "#sekce-stav"]);
    const tpSoubory = Object.values(P.tp || {}).filter(Boolean);
    const nahrava = P.fotky.filter(f => f.stav === "nahravam").length + tpSoubory.filter(f => f.stav === "nahravam").length;
    const chyba = P.fotky.filter(f => f.stav === "chyba").length + tpSoubory.filter(f => f.stav === "chyba").length;
    if (nahrava) ch.push([`nahrávají se fotky/videa (${nahrava})`, "#sekce-fotky"]);
    if (chyba) ch.push([`nenahrané fotky/videa (${chyba}) – nahrajte znovu nebo odeberte`, "#sekce-fotky"]);
    return ch;
  }
  function kontrolaPripravenosti() {
    const b = document.getElementById("k-podpisu"), info = document.getElementById("co-chybi");
    if (!b || !P) return;
    vykresliZmenuMajitele();
    document.querySelectorAll("[data-zbyva]").forEach(el => {               // kolik řádků zakázkového listu je zabráno
      const max = +el.dataset.max, n = radkuNaListu(P.zakazka[el.dataset.zbyva]);
      el.textContent = n > max ? `Nevejde se: ${n} řádků z ${max} – zkraťte nebo slučte.` : `Na zakázkovém listu ${n} z ${max} řádků (dlouhé položky se zalomí).`;
      el.style.color = n > max ? "var(--cervena)" : "";
    });
    const ch = coChybi();
    b.disabled = ch.length > 0;
    info.hidden = !ch.length;
    const su = document.getElementById("stav-ulozeni"); if (su) su.hidden = ch.length > 0;
    info.textContent = ch.length ? "Chybí: " + ch.map(c => c[0]).join(", ") : "";
    info.dataset.kratce = ch.length ? `Chybí ${ch.length} ${ch.length === 1 ? "údaj" : ch.length < 5 ? "údaje" : "údajů"}` : "";
    app.querySelectorAll(".chybi").forEach(e => e.classList.remove("chybi"));
    if (kontrolaPripravenosti.ukazat) ch.forEach(([, sel]) => app.querySelector(sel)?.classList.add("chybi"));
  }

  function nastavHodnotu(cesta, hodnota) { const [o, k] = cesta.split("."); P[o][k] = hodnota; ulozKoncept(); }

  function vazbyFormulare() {
    app.querySelectorAll("[data-pole]").forEach(inp => { if (inp.value) zkontrolujPole(inp, inp.dataset.pole, P.zakaznik.zeme); });
    app.querySelectorAll("[data-pole]").forEach(inp => {
      inp.addEventListener("input", () => {
        let h = inp.value;
        if (inp.dataset.pole === "vozidlo.vin") { h = h.toUpperCase(); }
        nastavHodnotu(inp.dataset.pole, h);
        zkontrolujPole(inp, inp.dataset.pole, P.zakaznik.zeme);
        if (inp.dataset.pole === "zakaznik.telefon" || inp.dataset.pole === "zakaznik.email") {
          const z = P.zakaznik;
          app.querySelector('[data-pole="zakaznik.telefon"]').previousElementSibling.className = z.email.trim() ? "" : "povinne";
          app.querySelector('[data-pole="zakaznik.email"]').previousElementSibling.className = z.telefon.trim() ? "" : "povinne";
        }
        if (inp.dataset.pole === "zakazka.datum_prijmu" && h) {
          P.rucne.datum = h !== dnes();
          if (!P.rucne.dokonceni) {                      // dokončení se posouvá s datem převzetí
            P.zakazka.predpoklad_dokonceni = plusDni(h, DNI_DOKONCENI);
            const d = app.querySelector('[data-pole="zakazka.predpoklad_dokonceni"]'); if (d) d.value = P.zakazka.predpoklad_dokonceni;
          }
          ulozKoncept();
        }
        if (inp.dataset.pole === "zakazka.predpoklad_dokonceni") {
          P.rucne.dokonceni = !!h && h !== plusDni(P.zakazka.datum_prijmu, DNI_DOKONCENI);
          const n = inp.parentElement.querySelector(".napoveda"); if (n) n.textContent = P.rucne.dokonceni ? "" : `Převzetí + ${DNI_DOKONCENI} dní`;
          ulozKoncept();
        }
      });
    });
    const vinInp = app.querySelector('[data-pole="vozidlo.vin"]');
    vinInp.addEventListener("change", () => zkontrolujVin(true));
    vinInp.addEventListener("input", () => {
      const r = rozlustitVin(vinInp.value), n = vinInp.parentElement.querySelector(".napoveda");
      const txt = r ? `Typ ${r.typ}, kód modelu ${r.kod}` : "";
      if (n) n.textContent = txt; else if (txt) vinInp.insertAdjacentHTML("afterend", `<span class="napoveda">${txt}</span>`);
      clearTimeout(vazbyFormulare.t);
      if (vinInp.value.replace(/\s/g, "").length >= 14) vazbyFormulare.t = setTimeout(() => zkontrolujVin(true), 600);
    });
    app.querySelectorAll("[data-segment]").forEach(seg => {
      seg.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        const cesta = seg.dataset.segment, h = JSON.parse(b.dataset.hodnota);
        nastavHodnotu(cesta, h);
        if (cesta === "zakaznik.jazyk") P.zakazka.jazyk = h;
        if (cesta === "vozidlo.verze") P.vozidlo.jednotka_tachometru = h === "US" ? "mi" : "km";   // US auta mají tachometr v mílích
        if (["zakaznik.je_firma", "zakaznik.jazyk", "vozidlo.jednotka_tachometru", "vozidlo.verze", "zakazka.tp_prilozen"].includes(cesta)) { ulozKoncept(); return vykresliFormularZachovatPozici(); }
        seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
      });
    });
    // řádky závad a stavu
    const prizpusobVysku = t => { t.style.height = "auto"; t.style.height = t.scrollHeight + 3 + "px"; };
    app.querySelectorAll("textarea[data-radek]").forEach(t => {
      prizpusobVysku(t);
      t.addEventListener("input", () => { P.zakazka[t.dataset.radek][+t.dataset.i] = t.value.replace(/\n/g, " "); prizpusobVysku(t); ulozKoncept(); });
      t.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); pridejRadek(t.dataset.radek, "", +t.dataset.i + 1); } });
    });
    app.querySelectorAll("[data-smazat]").forEach(b => b.onclick = () => {
      const s = P.zakazka[b.dataset.smazat]; s.splice(+b.dataset.i, 1); if (!s.length) s.push("");
      ulozKoncept(); vykresliFormularZachovatPozici();
    });
    app.querySelectorAll("[data-pridat]").forEach(b => b.onclick = () => pridejRadek(b.dataset.pridat, ""));
    app.querySelectorAll("[data-cip]").forEach(b => b.onclick = () => {
      const s = P.zakazka[b.dataset.cip];
      if (s.includes(b.textContent)) return hlaska("Tenhle řádek už tam je.");
      const prazdny = s.findIndex(x => !x.trim());
      if (prazdny >= 0) s[prazdny] = b.textContent; else s.push(b.textContent);
      ulozKoncept(); vykresliFormularZachovatPozici();
    });
    // zákazník
    const hledat = app.querySelector("#hledat");
    if (hledat) hledat.addEventListener("input", () => {
      clearTimeout(vazbyFormulare.h);
      vazbyFormulare.h = setTimeout(() => hledejZakaznika(hledat.value), 250);
    });
    const jiny = app.querySelector("#jiny-zakaznik");
    if (jiny) jiny.onclick = () => { P.zakaznik = novyPrijem().zakaznik; P.zakaznik.jazyk = P.zakazka.jazyk; ulozKoncept(); vykresliFormularZachovatPozici(); };
    // uložit zákazníka / vozidlo samostatně
    app.querySelector("#ulozit-zakaznika").onclick = () => ulozitZakaznikaSamostatne();
    app.querySelector("#ulozit-vozidlo").onclick = () => ulozitVozidloSamostatne();
    // TP
    app.querySelectorAll("[data-tp-vstup]").forEach(inp => inp.addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) nahrajTP(inp.dataset.tpVstup, f); }));
    // fotky
    ["#foto-kamera", "#video-kamera", "#foto-galerie"].forEach(s => app.querySelector(s).addEventListener("change", e => { pridejFotky([...e.target.files]); e.target.value = ""; }));
    // spodní lišta
    app.querySelector("#zahodit").onclick = () => {
      if (!confirm("Opravdu zahodit rozpracovaný příjem? Vyplněné údaje se smažou.")) return;
      uloz(KONCEPT, null); P = null; location.hash = "#/";
    };
    app.querySelector("#k-podpisu").onclick = () => {
      if (coChybi().length) return;
      P.krok = "podpis"; ulozKoncept(); prijemPodpis();
    };
    app.querySelector("#co-chybi").onclick = () => {           // klepnutí na „Chybí: …“ ukáže první chybějící pole
      kontrolaPripravenosti.ukazat = true; kontrolaPripravenosti();
      const prvni = coChybi()[0]; const el = prvni && app.querySelector(prvni[1]);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); if (el.matches("input, textarea")) setTimeout(() => el.focus({ preventScroll: true }), 350); }
    };
  }
  function vykresliFormularZachovatPozici() { const y = window.scrollY; vykresliFormular(); window.scrollTo(0, y); }
  function pridejRadek(klic, text, kam) {
    const s = P.zakazka[klic]; kam == null ? s.push(text) : s.splice(kam, 0, text);
    ulozKoncept(); vykresliFormularZachovatPozici();
    const t = app.querySelectorAll(`textarea[data-radek="${klic}"]`)[kam == null ? s.length - 1 : kam]; t?.focus();
  }

  const ocistit = o => { const x = { ...o }; for (const k in x) if (typeof x[k] === "string") { x[k] = x[k].trim(); if (x[k] === "" && k !== "jmeno") x[k] = null; } return x; };
  async function ulozitZakaznikaSamostatne() {
    if (!P.zakaznik.jmeno.trim()) return hlaska("Vyplňte jméno zákazníka.", true);
    if (!P.zakaznik.telefon.trim() && !P.zakaznik.email.trim()) return hlaska("Vyplňte telefon nebo e-mail.", true);
    const b = app.querySelector("#ulozit-zakaznika"); b.disabled = true;
    try {
      const nov = !P.zakaznik.id;
      P.zakaznik.id = await db.ulozitZakaznika(ocistit(P.zakaznik));
      ulozKoncept(); hlaska(nov ? `Zákazník ${P.zakaznik.jmeno} uložen.` : "Změny zákazníka uloženy.");
      vykresliFormularZachovatPozici();
    } catch (e) { hlaska("Zákazníka se nepodařilo uložit: " + chybaText(e), true); b.disabled = false; }
  }
  async function ulozitVozidloSamostatne() {
    const v = P.vozidlo;
    if (v.vin.replace(/\s/g, "").length < 8) return hlaska("Vyplňte VIN.", true);
    if (Object.values(P.tp || {}).some(f => f && f.stav !== "nahrano")) return hlaska("Počkejte, až se nahrají fotky TP.", true);
    const b = app.querySelector("#ulozit-vozidlo"); b.disabled = true;
    try {
      const vid = await db.ulozitVozidlo({ ...ocistit({ ...v, vin: v.vin.replace(/\s/g, "") }), rok: String(v.rok).trim() || null, km: cisloZ(P.zakazka.km_prijem) }, P.zakaznik.id);
      await zapsatTP(vid, null);
      ulozKoncept(); hlaska(`Vozidlo ${[v.typ, v.model].filter(Boolean).join(" ") || v.vin} uloženo${P.zakaznik.id ? ` u zákazníka ${P.zakaznik.jmeno}` : ""}.`);
      b.disabled = false; zkontrolujVin(false);
    } catch (e) { hlaska("Vozidlo se nepodařilo uložit: " + chybaText(e), true); b.disabled = false; }
  }
  /* TP: přední a zadní strana – fotka (zmenšená, ale čitelná) nebo PDF sken */
  async function nahrajTP(strana, soubor) {
    const pdf = soubor.type === "application/pdf" || /\.pdf$/i.test(soubor.name || "");
    const f = { id: uuid(), klic: null, nahled: null, stav: "nahravam", mime: pdf ? "application/pdf" : "image/jpeg", nazev: strana === "predni" ? "TP – přední strana" : "TP – zadní strana", zapsano: false };
    P.tp = P.tp || {}; P.tp[strana] = f; vykresliFormularZachovatPozici();
    try {
      let blob = soubor;
      if (!pdf) { const z = await zmensi(soubor, 2600, 0.86); blob = z.blob; f.nahled = z.nahled; vykresliFormularZachovatPozici(); }
      const d = new Date(), klic = `dokumenty/tp/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${f.id}.${pdf ? "pdf" : "jpg"}`;
      await db.nahrat(klic, blob, f.mime);
      f.klic = klic; f.stav = "nahrano";
    } catch (e) { f.stav = "chyba"; hlaska("TP se nepodařilo nahrát: " + chybaText(e), true); }
    if (P.tp[strana] === f) { ulozKoncept(); vykresliFormularZachovatPozici(); }
  }
  /* Zapsat nahrané TP k autu (a k zakázce, je-li); každý soubor jen jednou */
  async function zapsatTP(vozidlo_id, zakazka_id) {
    const nove = Object.values(P.tp || {}).filter(f => f && f.stav === "nahrano" && !f.zapsano);
    if (!nove.length) return;
    await db.vlozit("soubory", nove.map(f => ({ vozidlo_id, zakazka_id, druh: "tp", faze: "prijem", klic: f.klic, nazev: f.nazev, mime: f.mime, verejne: true })));
    nove.forEach(f => (f.zapsano = true));
  }

  async function hledejZakaznika(q) {
    const el = app.querySelector("#vysledky"); if (!el) return;
    if (q.trim().length < 2) { el.innerHTML = ""; return; }
    try {
      const r = await db.hledatZakazniky(q);
      el.innerHTML = r.length ? r.map((z, i) => {
        const auta = (z.vlastnictvi || []).filter(x => !x.vlastni_do).map(x => [x.vozidla?.typ, x.vozidla?.model].filter(Boolean).join(" ")).filter(Boolean);
        return `<button type="button" class="vysledek" data-i="${i}"><span><b>${esc(z.jmeno)}</b>
          <small>${esc([z.telefon, z.email, [z.psc, z.mesto].filter(Boolean).join(" ")].filter(Boolean).join(" · "))}</small></span>
          <small>${esc(auta.join(", "))}</small></button>`;
      }).join("") : `<div class="vysledek" style="cursor:default"><span class="mutted">Nikdo takový zatím není – vyplňte nového zákazníka níže.</span></div>`;
      el.querySelectorAll("button.vysledek").forEach(b => b.onclick = () => vyberZakaznika(r[+b.dataset.i]));
    } catch (e) { el.innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; }
  }
  function vyberZakaznika(z) {
    const n = novyPrijem().zakaznik;
    for (const k of Object.keys(n)) P.zakaznik[k] = z[k] ?? n[k];
    P.zakaznik.id = z.id; P.zakazka.jazyk = P.zakaznik.jazyk || "cs";
    const auta = (z.vlastnictvi || []).filter(x => !x.vlastni_do && x.vozidla).map(x => x.vozidla);
    ulozKoncept(); vykresliFormularZachovatPozici();
    if (auta.length) {
      const el = app.querySelector("#auta-zakaznika");
      el.innerHTML = `<p class="popis" style="margin:0 0 8px">Auta zákazníka – klepnutím vyplníte:</p><div class="cipy" style="margin:0 0 14px">${auta.map((a, i) =>
        `<button type="button" class="cip" data-auto="${i}">${esc([a.typ, a.model, a.rok && `(${a.rok})`].filter(Boolean).join(" ") || a.vin)} · ${esc(a.vin)}</button>`).join("")}</div>`;
      el.querySelectorAll("[data-auto]").forEach(b => b.onclick = () => vyplnAuto(auta[+b.dataset.auto]));
    }
  }
  function vyplnAuto(a) {
    const n = novyPrijem().vozidlo;
    for (const k of Object.keys(n)) P.vozidlo[k] = a[k] == null ? n[k] : String(a[k]);
    ulozKoncept(); vykresliFormularZachovatPozici(); zkontrolujVin(false);
  }
  // C1/D3: přijel někdo jiný než majitel, kterého máme v systému → zeptat se, jestli auto změnilo majitele
  const jinyNezMajitel = () => !!(P?.majiteleVozu?.length && !P.majiteleVozu.some(m => m.id && m.id === P.zakaznik.id) && (P.zakaznik.id || P.zakaznik.jmeno.trim()));
  function vykresliZmenuMajitele() {
    const el = document.getElementById("zmena-majitele"); if (!el || !P) return;
    if (!jinyNezMajitel()) { el.innerHTML = ""; return; }
    const stary = P.majiteleVozu.map(m => m.jmeno).join(", "), novy = P.zakaznik.jmeno.trim() || "nový zákazník";
    if (el.dataset.stav === `${stary}|${novy}|${P.zmenaMajitele}`) return;
    el.dataset.stav = `${stary}|${novy}|${P.zmenaMajitele}`;
    el.innerHTML = `<div class="info pozor" style="margin-top:10px"><b>Auto změnilo majitele?</b> V systému je majitelem <b>${esc(stary)}</b>.
      <div class="segment" style="margin-top:8px"><button type="button" data-zmena="1" aria-pressed="${P.zmenaMajitele === true}">Ano – nový majitel je ${esc(novy)}</button>
      <button type="button" data-zmena="0" aria-pressed="${P.zmenaMajitele === false}">Ne – auto jen přivezl/a, majitel zůstává</button></div>
      <p class="napoveda" style="margin:6px 0 0">Při změně majitele se předchozímu ukončí vlastnictví k dnešku, historie oprav zůstane u auta a vznikne nový odkaz na E-servisku (předchozí majitel ji už neuvidí).</p></div>`;
    el.querySelectorAll("[data-zmena]").forEach(b => b.onclick = () => { P.zmenaMajitele = b.dataset.zmena === "1"; ulozKoncept(); });
  }
  async function zkontrolujVin(doplnit) {
    const vin = P.vozidlo.vin.replace(/\s/g, ""); const el = app.querySelector("#info-vin"); if (!el || vin.length < 8) return;
    const r = rozlustitVin(vin);
    if (r && !P.vozidlo.typ) { P.vozidlo.typ = r.typ; const t = app.querySelector('[data-pole="vozidlo.typ"]'); if (t) t.value = r.typ; ulozKoncept(); }
    try {
      const a = await db.vozidloPodleVin(vin);
      if (!a) { P.majiteleVozu = []; ulozKoncept(); el.innerHTML = `<div class="info">Nové auto – v systému ho zatím nemáme.</div>`; return; }
      if (doplnit) for (const k of ["typ", "model", "rok", "spz", "barva", "verze", "jednotka_tachometru"]) if (a[k] != null && !String(P.vozidlo[k] || "").trim()) P.vozidlo[k] = String(a[k]);
      const majitele = (a.vlastnictvi || []).filter(x => !x.vlastni_do && x.zakaznici).map(x => x.zakaznici);
      P.majiteleVozu = majitele.map(m => ({ id: m.id, jmeno: m.jmeno })); ulozKoncept();
      const posledni = (a.zakazky || []).sort((x, y) => y.cislo - x.cislo)[0];
      el.innerHTML = `<div class="info ok">Auto známe${posledni ? ` – naposledy zakázka #${posledni.cislo} (${datumCz(posledni.datum_prijmu)}${posledni.km_prijem ? `, ${posledni.km_prijem.toLocaleString("cs-CZ")} ${a.jednotka_tachometru}` : ""})` : ""}.
        ${majitele.length ? `Majitel: <b>${esc(majitele.map(m => m.jmeno).join(", "))}</b>.` : ""}
        ${!P.zakaznik.id && majitele.length === 1 ? `<button type="button" class="tl tl-male" id="vzit-majitele" style="margin-left:8px">Použít jako zákazníka</button>` : ""}</div>`;
      const b = el.querySelector("#vzit-majitele"); if (b) b.onclick = () => vyberZakaznika({ ...majitele[0], vlastnictvi: [] });
      if (doplnit) { ulozKoncept(); ["typ", "model", "rok", "spz", "barva"].forEach(k => { const i = app.querySelector(`[data-pole="vozidlo.${k}"]`); if (i) i.value = P.vozidlo[k]; }); }
    } catch (e) { el.innerHTML = `<div class="info pozor">VIN se nepodařilo ověřit (${esc(chybaText(e))}).</div>`; }
  }

  /* ---------- fotky ---------- */
  function zmensi(soubor, max = 2000, kvalita = 0.82) {
    return new Promise((ok, chyba) => {
      const url = URL.createObjectURL(soubor), img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const t = document.createElement("canvas"), st = 320 / Math.max(c.width, c.height);
        t.width = Math.round(c.width * st); t.height = Math.round(c.height * st); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
        const nahled = t.toDataURL("image/jpeg", 0.7);
        c.toBlob(b => { URL.revokeObjectURL(url); b ? ok({ blob: b, nahled }) : chyba(new Error("Fotku nelze zpracovat")); }, "image/jpeg", kvalita);
      };
      img.onerror = () => { URL.revokeObjectURL(url); chyba(new Error("Fotku nelze otevřít")); };
      img.src = url;
    });
  }
  /* Video: nezmenšuje se (to iPad v prohlížeči neumí), jen se z něj vezme náhled prvního záběru */
  const MAX_VIDEO_MB = 50;
  const jeVideo = s => /^video\//.test(s.type) || /\.(mov|mp4|m4v|webm)$/i.test(s.name || "");
  function nahledVidea(soubor) {
    return new Promise(ok => {
      const url = URL.createObjectURL(soubor), v = document.createElement("video");
      let hotovo = false;
      const konec = n => { if (hotovo) return; hotovo = true; URL.revokeObjectURL(url); ok(n); };
      v.muted = true; v.playsInline = true; v.preload = "auto";
      v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
      v.onseeked = () => {
        try {
          const st = 320 / Math.max(v.videoWidth, v.videoHeight), c = document.createElement("canvas");
          c.width = Math.round(v.videoWidth * st); c.height = Math.round(v.videoHeight * st);
          c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); konec({ nahled: c.toDataURL("image/jpeg", 0.7), delka: v.duration });
        } catch (e) { konec({ nahled: null, delka: v.duration }); }
      };
      v.onerror = () => konec({ nahled: null, delka: null });
      setTimeout(() => konec({ nahled: null, delka: isFinite(v.duration) ? v.duration : null }), 8000);
      v.src = url;
    });
  }
  async function pridejFotky(soubory) {
    for (const s of soubory) {
      const id = uuid(), video = jeVideo(s);
      if (video && s.size > MAX_VIDEO_MB * 1024 * 1024) {
        hlaska(`Video má ${Math.round(s.size / 1048576)} MB – nahrát jde nejvýš ${MAX_VIDEO_MB} MB (asi 30 s ve Full HD, 15 s ve 4K). Natočte prosím kratší.`, true, 9000);
        continue;
      }
      const mime = video ? (s.type || "video/quicktime") : "image/jpeg";
      const f = { id, klic: null, nahled: null, stav: "nahravam", nazev: s.name, video, mime, mb: Math.round(s.size / 104857.6) / 10, delka: null, pokrok: 0 };
      P.fotky.push(f); vykresliFotky();
      try {
        if (video) { blobyFotek[id] = s; const n = await nahledVidea(s); f.nahled = n.nahled; f.delka = n.delka; }
        else { const { blob, nahled } = await zmensi(s); f.nahled = nahled; blobyFotek[id] = blob; }
        vykresliFotky();
        await nahrajFotku(f);
      } catch (e) { f.stav = "chyba"; vykresliFotky(); hlaska(chybaText(e), true); }
    }
  }
  const PRIPONA = { "video/quicktime": "mov", "video/mp4": "mp4", "video/webm": "webm", "video/x-m4v": "m4v", "image/jpeg": "jpg" };
  async function nahrajFotku(f) {
    const d = new Date(), mime = f.mime || "image/jpeg";
    const klic = `${f.video ? "videa" : "fotky"}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${f.id}.${PRIPONA[mime] || "bin"}`;
    f.stav = "nahravam"; f.pokrok = 0; vykresliFotky();
    const prubeh = x => { f.pokrok = x; aktualizujPrubeh(f); };
    try { await db.nahrat(klic, blobyFotek[f.id], mime, prubeh); f.klic = klic; f.stav = "nahrano"; delete blobyFotek[f.id]; }
    catch (e) { if (/exists|Duplicate/i.test(chybaText(e))) { f.klic = klic; f.stav = "nahrano"; } else { f.stav = "chyba"; } }
    vykresliFotky(); ulozKoncept();
  }
  const minuty = s => s == null || !isFinite(s) ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  function textStavu(f) {
    if (f.stav === "nahrano") return "✓ Nahráno";
    if (f.stav === "chyba") return "↻ Nahrát znovu";
    return f.pokrok > 0 && f.pokrok < 1 ? `Nahrávám ${Math.round(f.pokrok * 100)} %` : "Nahrávám…";
  }
  function aktualizujPrubeh(f) {
    const s = document.querySelector(`.fotka[data-id="${f.id}"] .stav-fotky`); if (s) s.textContent = textStavu(f);
    const b = document.querySelector(`.fotka[data-id="${f.id}"] .pruh i`); if (b) b.style.width = Math.round(f.pokrok * 100) + "%";
  }
  function vykresliSouhrn() {
    const el = document.getElementById("souhrn-nahrani"); if (!el || !P) return;
    const n = P.fotky.length, ok = P.fotky.filter(f => f.stav === "nahrano").length, chyb = P.fotky.filter(f => f.stav === "chyba").length;
    el.innerHTML = !n ? "" : chyb ? `<div class="info chyba">✗ ${chyb} z ${n} se nepodařilo nahrát – klepněte na ně a nahraje se znovu.</div>`
      : ok === n ? `<div class="info ok souhrn-ok">✓ Vše nahráno (${popisPoctu(P.fotky)})</div>`
      : `<div class="info">Nahrávám… hotovo ${ok} z ${n}. Nechte aplikaci otevřenou.</div>`;
  }
  function vykresliFotky() {
    const el = document.getElementById("fotky"); if (!el || !P) return;
    el.innerHTML = P.fotky.map((f, i) => `<div class="fotka ${f.stav}" data-id="${f.id}">${f.nahled ? `<img src="${f.nahled}" alt="">` : ""}
      ${f.video ? `<span class="ikona-videa">▶</span><span class="info-videa" title="${f.mb ? f.mb.toLocaleString("cs-CZ") + " MB" : ""}">${minuty(f.delka) || (f.mb ? Math.round(f.mb) + " MB" : "video")}</span>` : ""}
      <span class="stav-fotky ${f.stav}">${textStavu(f)}</span>
      ${f.stav === "nahravam" ? `<span class="pruh"><i style="width:${Math.round((f.pokrok || 0) * 100)}%"></i></span>` : ""}
      <button type="button" class="odebrat" data-i="${i}" aria-label="Odebrat">×</button></div>`).join("");
    vykresliSouhrn();
    kontrolaPripravenosti();
    el.querySelectorAll(".odebrat").forEach(b => b.onclick = () => { const f = P.fotky.splice(+b.dataset.i, 1)[0]; delete blobyFotek[f.id]; vykresliFotky(); ulozKoncept(); });
    el.querySelectorAll(".fotka.chyba").forEach(t => t.onclick = e => {
      if (e.target.closest(".odebrat")) return;
      const f = P.fotky.find(x => x.id === t.dataset.id);
      if (f && blobyFotek[f.id]) nahrajFotku(f); else hlaska("Soubor už v iPadu není – vyfoťte nebo vyberte ho prosím znovu.", true);
    });
    const n = document.getElementById("pocet-fotek"); if (n) n.textContent = popisPoctu(P.fotky);
  }

  function popisPoctu(soubory) {
    const v = soubory.filter(f => f.video).length, f = soubory.length - v;
    const sklon = (n, a, b, c) => `${n} ${n === 1 ? a : n < 5 ? b : c}`;
    return [f && sklon(f, "fotka", "fotky", "fotek"), v && sklon(v, "video", "videa", "videí")].filter(Boolean).join(", ");
  }

  /* ---------- data pro šablonu zakázkového listu ---------- */
  function dataZakazkovehoListu(cislo, podpisVyh, podpisZak, cekaPodpis = false) {
    const z = P.zakaznik, v = P.vozidlo, k = P.zakazka, en = k.jazyk === "en";
    const odhad = cisloZ(k.odhad_ceny);
    return {
      cislo: cislo ? `${cislo}-1` : null,                      // zakázkový list = číslo zakázky -1
      zakaznik: { jmeno: z.jmeno.trim(), ulice: z.ulice.trim(), mesto: [z.psc.trim(), z.mesto.trim()].filter(Boolean).join(" "), zeme: z.zeme.trim(), telefon: z.telefon.trim(), email: z.email.trim() },
      zavady: k.zavady.map(s => s.trim()).filter(Boolean),
      vozidlo: { znacka: "Mercedes-Benz", typ: v.typ.trim(), model: v.model.trim(), rok: String(v.rok).trim(), vin: v.vin.replace(/\s/g, "") },
      nadrz: en ? (NADRZ_EN[k.nadrz_prijem] || k.nadrz_prijem) : k.nadrz_prijem,
      tp: !!k.tp_prilozen, foto: P.fotky.length > 0,
      stav: k.stav_prijem.map(s => s.trim()).filter(Boolean),
      datum: k.datum_prijmu, dokonceni: k.predpoklad_dokonceni || null,
      odhad: odhad == null || isNaN(odhad) ? null : odhad,
      vyhotovil: uzivatel?.jmeno || undefined,
      podpisVyhotovil: podpisVyh || undefined, podpisZakaznik: podpisZak || undefined, cekaPodpis: cekaPodpis || undefined
    };
  }

  /* Šablonu načte do rámečku, vykreslí a vrátí okno rámečku (pro náhled i pro PDF) */
  /* PDF ze šablony mimo obrazovku (přílohy jako parts list) */
  const skryteRamecky = {};
  async function pdfZeSablony(sablona, data, jazyk = "cs", meta = {}) {
    let f = skryteRamecky[sablona];
    if (!f || !f.isConnected) {
      f = document.createElement("iframe");
      f.setAttribute("aria-hidden", "true"); f.tabIndex = -1;
      f.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;visibility:hidden";
      document.body.appendChild(f); skryteRamecky[sablona] = f;
    }
    return vFronte(f, async () => {
      const w = await vykresliSablonuHned(f, sablona, data, jazyk);
      return w.dokumentDoPdf(w.document, meta);
    });
  }
  /* Parts list (příloha nabídky a faktury) – díly kromě nepoužitých; cena = prodejní cena × množství */
  function dataPartsListu(z, dily, ceny = true, odkaz = null) {
    const mn = d => { const n = Number(d.mnozstvi); if (!d.jednotka || d.jednotka === "ks") return isNaN(n) ? d.mnozstvi : n; return `${mnozstviCz(n)} ${d.jednotka}`; };
    const v = z.vozidla || {}, c = z.zakaznici || {};
    return { cislo: z.cislo, ceny, datum: dnes(), odkaz,
      vozidlo: { znacka: v.znacka, typ: v.typ, model: v.model, rok: v.rok, vin: v.vin, spz: v.spz }, zakaznik: { jmeno: c.jmeno || "" },
      dily: dily.filter(d => d.stav !== "nepouzito" && (d.nazev || d.cislo_mb)).map(d => ({
        nazev: d.nazev || "", mnozstvi: mn(d), cislo: d.cislo_mb || "",
        cenaKs: ceny && d.prodejni_cena != null ? Number(d.prodejni_cena) : null,
        cena: ceny && d.prodejni_cena != null ? zaokrouhli(Number(d.prodejni_cena) * (Number(d.mnozstvi) || 0)) : null,
        poznamka: d.poznamka || "", puvod: d.puvod || null })) };
  }

  /* Vykreslování do jednoho rámečku jde vždy po jednom (náhled se nesmí přepsat uprostřed tvorby PDF) */
  function vFronte(iframe, fn) {
    const p = (iframe._fronta || Promise.resolve()).then(fn, fn);
    iframe._fronta = p.catch(() => {});
    return p;
  }
  function vykresliSablonu(iframe, sablona, data, jazyk) { return vFronte(iframe, () => vykresliSablonuHned(iframe, sablona, data, jazyk)); }
  async function vykresliSablonuHned(iframe, sablona, data, jazyk) {
    if (!iframe.dataset.nacteno) {
      await new Promise((ok, chyba) => { iframe.onload = ok; iframe.onerror = chyba; iframe.src = `sablony/${sablona}`; });
      const w = iframe.contentWindow, d = iframe.contentDocument;
      for (const src of ["../vendor/pdf-lib.min.js", "../vendor/fontkit.umd.min.js", "do-pdf.js"]) {
        await new Promise((ok, chyba) => { const s = d.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error("Nelze načíst " + src)); d.head.appendChild(s); });
      }
      iframe.dataset.nacteno = "1";
      if (!w.render) throw new Error("Šablona se nenačetla");
    }
    iframe.contentWindow.__posledniVysledek = await iframe.contentWindow.render(data, jazyk);
    await Promise.all([...iframe.contentDocument.images].map(i => (i.complete ? null : i.decode().catch(() => null))));
    return iframe.contentWindow;
  }

  /* Podpis „Vyhotovil“ = podpis přihlášeného (uložený v jeho profilu).
     Vašek: dokud nemá podpis v profilu, použije se jeho dřívější podpis z nastavení firmy. */
  async function podpisVyhotovil() {
    if (uzivatel.podpis_obrazek) return uzivatel.podpis_obrazek;
    try { const f = await db.podpisVyhotovil(); if (f?.obrazek && f.jmeno === uzivatel.jmeno) return f.obrazek; } catch (e) { /* bez podpisu */ }
    return null;
  }

  /* ---------- náhled a podpis ---------- */
  async function prijemPodpis() {
    const en = P.zakazka.jazyk === "en";
    app.innerHTML = `
      <h1>Zakázkový list – náhled a podpis</h1>
      <p class="popis">Zkontrolujte se zákazníkem údaje. Podpisem zákazník potvrzuje předání vozu a podmínky na zadní straně.</p>
      <div class="nahled-obal"><div class="nahled-ram" id="ram"><iframe id="nahled" title="Náhled zakázkového listu"></iframe></div></div>
      <section class="karta" style="margin-top:16px">
        <h2>Podpis zákazníka – ${esc(P.zakaznik.jmeno)}</h2>
        <div class="podpis-pole"><canvas id="podpis"></canvas><div class="linka-podpisu"></div><div class="text-podpisu">${en ? "Customer signature" : "Podpis zákazníka (prstem nebo pero)"}</div></div>
        <div class="radek-tlacitek" style="margin-top:10px"><button type="button" class="tl tl-male" id="smazat-podpis">Smazat podpis</button>
          <span class="napoveda">Podpis se propíše do políčka „${en ? "Received by" : "Převzal"}“.</span></div>
      </section>
      <section class="karta" id="muj-podpis-sekce" hidden>
        <h2>Váš podpis – ${esc(uzivatel.jmeno)}</h2>
        <p class="popis">Zatím nemáte uložený podpis. Podepište se jednou – uloží se do vašeho profilu a příště se doplní sám do políčka „${en ? "Issued by" : "Vyhotovil"}“.</p>
        <div class="podpis-pole"><canvas id="muj-podpis"></canvas><div class="linka-podpisu"></div><div class="text-podpisu">${esc(uzivatel.jmeno)}</div></div>
        <div class="radek-tlacitek" style="margin-top:10px"><button type="button" class="tl tl-male" id="smazat-muj-podpis">Smazat</button></div>
      </section>
      <div class="akce-dole"><div class="vnitrek">
        <button type="button" class="tl" id="zpet">${P.vysledek ? "Ukončit příjem" : "← Upravit údaje"}</button>
        <span class="stav-ulozeni" id="stav-ulozeni">${P.vysledek ? `Zakázka #${P.vysledek.cislo} je založená – dokončete uložení listu.` : ""}</span>
        <button type="button" class="tl tl-velke" id="pozdeji" title="Zákazník spěchá: list se uloží bez jeho podpisu a zákazník ho podepíše z domu v E-servisce">✍️ Podepíše později</button>
        <button type="button" class="tl tl-hlavni tl-velke" id="ulozit" disabled>Podepsat a uložit</button>
      </div></div>`;

    const iframe = app.querySelector("#nahled"), ram = app.querySelector("#ram");
    const W = 794, H = 1123;               // A4 v CSS px
    const meritko = () => {
      const s = Math.min(1, (ram.parentElement.clientWidth - 28) / W);
      iframe.style.width = W + "px"; iframe.style.height = H * 2 + "px"; iframe.style.transform = `scale(${s})`;
      ram.style.width = W * s + "px"; ram.style.height = H * 2 * s + "px";
    };
    meritko(); window.addEventListener("resize", meritko);

    let vyh = await podpisVyhotovil();
    let mujPad = null;
    const pripraveno = () => !!(pad && !pad.prazdny() && (vyh || (mujPad && !mujPad.prazdny())));
    let odhadCisla = P.vysledek?.cislo || null;
    if (!odhadCisla) try { odhadCisla = await db.dalsiCisloOdhad(); } catch (e) { /* bez čísla */ }

    let pad = null;
    pad = new PodpisPad(app.querySelector("#podpis"), {
      onZmena: () => { app.querySelector("#ulozit").disabled = !pripraveno(); obnovNahled(); }
    });
    if (!vyh) {
      app.querySelector("#muj-podpis-sekce").hidden = false;
      mujPad = new PodpisPad(app.querySelector("#muj-podpis"), { onZmena: () => { app.querySelector("#ulozit").disabled = !pripraveno(); obnovNahled(); } });
      app.querySelector("#smazat-muj-podpis").onclick = () => mujPad.smazat();
    }
    const podpisVyh = () => vyh || mujPad?.png() || null;
    let pretece = "";                                      // text, který se na list nevejde (zákazník by podepsal neúplný list)
    const obnovNahled = async () => {
      try { await vykresliSablonu(iframe, "zakazkovy-list.html", dataZakazkovehoListu(odhadCisla, podpisVyh(), pad.png()), P.zakazka.jazyk); }
      catch (e) { hlaska("Náhled se nepodařil: " + chybaText(e), true); }
      const r = iframe.contentWindow?.__posledniVysledek?.radky;
      pretece = !r ? "" : r.zavady.potreba > r.zavady.max ? `Závady se nevejdou na list (${r.zavady.potreba} řádků z ${r.zavady.max})` : r.stav?.potreba > r.stav?.max ? `Stav při převzetí se nevejde na list (${r.stav.potreba} řádků z ${r.stav.max})` : "";
      if (pretece) hlaska(pretece + " – vraťte se a zkraťte text.", true, 8000);
    };
    await obnovNahled();
    app.querySelector("#smazat-podpis").onclick = () => pad.smazat();
    app.querySelector("#zpet").onclick = async () => {
      if (P.vysledek) {                                    // zakázka už existuje, jen list se nepodařilo uložit → nezaseknout se v příjmu
        if (!confirm(`Zakázka #${P.vysledek.cislo} už je založená, jen se nepodařilo uložit zakázkový list.\n\nUkončit příjem? Zakázka i fotky z příjmu zůstanou, zakázkový list vystavíte později.`)) return;
        const { zakazka_id: zid, vozidlo_id: vid } = P.vysledek, f = P.fotky.filter(x => x.klic && x.stav === "nahrano");
        try { if (f.length) await db.vlozit("soubory", f.map(x => ({ zakazka_id: zid, vozidlo_id: vid, druh: x.video ? "video" : "foto", faze: "prijem", klic: x.klic, nazev: x.nazev || null, mime: x.mime || "image/jpeg" }))); }
        catch (e) { return hlaska("Fotky se nepodařilo přiřadit: " + chybaText(e) + " – zkuste to znovu, až bude signál.", true, 8000); }
        uloz(KONCEPT, null); P = null; location.hash = `#/zakazka/${zid}`; return;
      }
      P.krok = "formular"; ulozKoncept(); vykresliFormular();
    };
    app.querySelector("#ulozit").onclick = async e => {
      const b = e.currentTarget;
      if (b.dataset.bezi || app.querySelector("#pozdeji")?.dataset.bezi) return;   // dvojí klepnutí nesmí založit dvě zakázky
      if (pretece) return hlaska(pretece + " – vraťte se a zkraťte text.", true, 8000);
      b.dataset.bezi = "1"; b.disabled = true;
      try {
        if (!vyh && mujPad && !mujPad.prazdny()) {         // nový podpis přihlášeného → uložit do profilu
          try { const png = mujPad.png(); await db.ulozitMujPodpis(uzivatel.id, png); uzivatel.podpis_obrazek = png; }
          catch (e) { return hlaska("Váš podpis se nepodařilo uložit: " + chybaText(e), true); }
        }
        await ulozitPrijem(iframe, podpisVyh(), pad.png(), !vyh);
      } finally { if (b.isConnected) { delete b.dataset.bezi; b.disabled = false; } }
    };
    app.querySelector("#pozdeji").onclick = async e => {   // zákazník odešel bez podpisu → podepíše z domu v E-servisce
      const b = e.currentTarget; if (b.dataset.bezi || app.querySelector("#ulozit")?.dataset.bezi) return;
      if (pretece) return hlaska(pretece + " – vraťte se a zkraťte text.", true, 8000);
      if (!podpisVyh()) return hlaska("Nejdřív se podepište vy (Vyhotovil).", true);
      if (!confirm("Uložit zakázkový list bez podpisu zákazníka?\n\nZákazník ho podepíše z domu v E-servisce (pošlete mu odkaz). Po podpisu se v zakázce objeví tlačítko pro vystavení podepsané verze.")) return;
      b.dataset.bezi = "1"; b.disabled = true;
      try {
        if (!vyh && mujPad && !mujPad.prazdny()) {
          try { const png = mujPad.png(); await db.ulozitMujPodpis(uzivatel.id, png); uzivatel.podpis_obrazek = png; }
          catch (err) { return hlaska("Váš podpis se nepodařilo uložit: " + chybaText(err), true); }
        }
        await ulozitPrijem(iframe, podpisVyh(), null, !vyh, true);
      } finally { if (b.isConnected) { delete b.dataset.bezi; b.disabled = false; } }
    };
    uklid = () => { window.removeEventListener("resize", meritko); pad.zrus(); mujPad?.zrus(); };
  }

  /* ================= vystavení dokladu (společné pro všechny druhy) ================= */
  const PRIPONY = { zakazkovy_list: 1, nabidka: 2, faktura: 3, predavaci_protokol: 4, zalohova: 5, opravny: 6 };
  const SOUBOR_DOKLADU = { zakazkovy_list: ["zakazkovy-list", "work-order"], nabidka: ["cenova-nabidka", "quotation"], faktura: ["faktura", "invoice"],
    predavaci_protokol: ["predavaci-protokol", "handover-protocol"], zalohova: ["zalohova-faktura", "advance-invoice"], opravny: ["opravny-doklad", "credit-note"] };
  const NAZEV_DOKLADU = {
    cs: { zakazkovy_list: "Zakázkový list", nabidka: "Cenová nabídka", faktura: "Faktura", predavaci_protokol: "Předávací protokol", zalohova: "Zálohová faktura", opravny: "Opravný doklad" },
    en: { zakazkovy_list: "Work order", nabidka: "Quotation", faktura: "Invoice", predavaci_protokol: "Handover protocol", zalohova: "Advance invoice", opravny: "Credit note" }
  };
  /* 7377 + faktura (verze 1) → 7377-3; druhá faktura → 7377-3-2. VS jen číslice: 73773 / 737732 */
  const cisloDokladu = (c, druh, verze = 1) => `${c}-${PRIPONY[druh]}${verze > 1 ? `-${verze}` : ""}`;
  const vsDokladu = (c, druh, verze = 1) => `${c}${PRIPONY[druh]}${verze > 1 ? verze : ""}`;
  const ignorujDuplicitu = async fn => { try { await fn(); } catch (e) { if (!/exists|Duplicate/i.test(chybaText(e))) throw e; } };

  /* Mazání chybně vystaveného dokladu (jen majitel; server hlídá: poslední verze, nezaplacený, nepředaný účetní, záloha bez konečné faktury) */
  const MAZATELNE_DOKLADY = ["nabidka", "faktura", "zalohova", "predavaci_protokol"];
  function lzeSmazatDoklad(d, vsechny) {
    if (uzivatel?.role !== "majitel" || !MAZATELNE_DOKLADY.includes(d.druh) || d.zaplaceno || d.odeslano_uol) return false;
    if (!vsechny || d.verze == null) return true;
    // faktura / záloha, ke které je opravný doklad, se už nemaže (opravný doklad na ni odkazuje číslem)
    if (["faktura", "zalohova"].includes(d.druh) && vsechny.some(x => x.druh === "opravny" && x.zakazka_id === d.zakazka_id)) return false;
    return !vsechny.some(x => x.druh === d.druh && x.zakazka_id === d.zakazka_id && (x.verze || 0) > d.verze);
  }
  // D1: soubory v úložišti se mažou spolu se záznamem (na pozadí; když se to nepovede, uklidí se příště)
  // E5: které archivní PDF zákazník uvidí v E-servisce hned (jeho zakázkový list, parts list, protokol, faktura); ostatní jde zapnout 👁
  const archivProZakaznika = n => !/›/.test(n || "") && /^(zak[aá]zkov[ýy][ _]list|work[ _]order|parts[ _]list|p[řr]ed[aá]vac[ií]|invoice[ _]|faktura[ _])/i.test(n || "");
  const slozkaSouboru = k => (String(k || "").match(/^(zakazky\/\d+\/[\w-]+)\/[^/]+$/) || [])[1] || null;
  const uklidSoubory = telo => { if (jeMajitel()) db.smazatSoubory?.(telo)?.catch?.(() => {}); };
  async function smazatDokladDotaz(d, potom) {
    if (!d) return;
    const fa = ["faktura", "zalohova"].includes(d.druh);
    if (!confirm(`Smazat ${(DRUHY[d.druh] || "doklad").toLowerCase()} ${d.cislo}?\n\nSmaže se i jeho PDF a podpisy. Číslo ${d.cislo} se uvolní a dostane ho další vystavený doklad.${fa ? "\n\nPoužívejte jen pro chybně vytvořené faktury, které ještě nikdo nedostal." : ""}`)) return;
    try { await db.smazatDoklad(d.id); uklidSoubory({ slozky: [slozkaSouboru(d.soubory?.klic)].filter(Boolean), klice: d.soubory?.klic ? [d.soubory.klic] : [] }); hlaska(`Doklad ${d.cislo} smazán.`); potom?.(); }
    catch (e) { hlaska("Smazat nejde: " + chybaText(e), true, 9000); }
  }

  /* Vykreslí doklad do rámečku → PDF → uloží PDF, podpis zákazníka, doklad (zamčený) a podpisy. Vrací {doklad, bytes, cislo}. */
  async function ulozitDoklad({ iframe, sablona, data, jazyk, zakazka_id, vozidlo_id, cisloZakazky, druh, verze = 1, vystaveno, splatnost,
                               podpisZak, jmenoZakaznika, vyhPodepsalNaIpadu = false, nabidka_id = null, prubeh = () => {}, prilohy = [], zpusobZak = "ipad" }) {
    const cislo = cisloDokladu(cisloZakazky, druh, verze);
    prubeh(`Vytvářím ${NAZEV_DOKLADU.cs[druh].toLowerCase()}…`);
    const { bytes, otisk, vysledek } = await vFronte(iframe, async () => {          // vykreslit a hned převést na PDF – nic mezi to nevleze
      const w = await vykresliSablonuHned(iframe, sablona, data, jazyk);
      const vysledek = w.__posledniVysledek || {};
      const bytes = await w.dokumentDoPdf(w.document, { nazev: `${NAZEV_DOKLADU[jazyk]?.[druh] || NAZEV_DOKLADU.cs[druh]} ${cislo}`,
        predmet: [data.vozidlo?.typ, data.vozidlo?.model, data.vozidlo?.vin].filter(Boolean).join(" · ") });
      return { bytes, otisk: await w.otiskPdf(bytes), vysledek };
    });
    prubeh("Ukládám PDF…");
    // každé vystavení má vlastní složku – smazaný a znovu vystavený doklad se stejným číslem tak nikdy nepřepíše/nepřevezme starý soubor
    const slozka = `zakazky/${cisloZakazky}/${Date.now().toString(36)}`;
    const klicPdf = `${slozka}/${cislo}-${SOUBOR_DOKLADU[druh][jazyk === "en" ? 1 : 0]}.pdf`;
    await ignorujDuplicitu(() => db.nahrat(klicPdf, new Blob([bytes], { type: "application/pdf" }), "application/pdf"));
    // nejdřív všechny soubory do úložiště, pak doklad + záznamy souborů + podpisy jedním krokem v databázi (všechno, nebo nic)
    const soubory = [{ role: "pdf", druh: "pdf", klic: klicPdf, nazev: `${cislo}.pdf`, velikost: bytes.length, mime: "application/pdf" }];
    if (podpisZak) {
      const klicPodpisu = `${slozka}/podpis-zakaznika-${cislo}.png`;
      await ignorujDuplicitu(() => db.nahrat(klicPodpisu, dataUrlNaBlob(podpisZak), "image/png"));
      soubory.push({ role: "podpis", druh: "podpis", klic: klicPodpisu, nazev: "podpis zákazníka", mime: "image/png" });
    }
    const hotovePrilohy = [];
    for (const pr of prilohy) {                          // přílohy (parts list) – samostatná PDF navázaná na doklad
      prubeh(`Vytvářím ${pr.nazev}…`);
      const pb = await pdfZeSablony(pr.sablona, pr.data, jazyk, { nazev: `${pr.nazev} ${cislo}` });
      const kl = `${slozka}/${cislo}-${pr.slug}.pdf`;
      await ignorujDuplicitu(() => db.nahrat(kl, new Blob([pb], { type: "application/pdf" }), "application/pdf"));
      soubory.push({ role: "priloha", druh: "pdf", klic: kl, nazev: `${cislo} ${pr.nazev}`, velikost: pb.length, mime: "application/pdf" });
      hotovePrilohy.push({ bytes: pb, nazev: `${cislo}-${pr.slug}.pdf` });
    }
    const ulozenaData = { ...data }; delete ulozenaData.podpisVyhotovil; delete ulozenaData.podpisZakaznik;
    const podpisy = [{ role: "vyhotovil", jmeno: uzivatel.jmeno, uzivatel_id: uzivatel.id, zpusob: vyhPodepsalNaIpadu ? "ipad" : "ulozeny", otisk_dokumentu: otisk }];
    if (podpisZak) podpisy.unshift({ role: "zakaznik", jmeno: jmenoZakaznika, zpusob: zpusobZak, otisk_dokumentu: otisk });
    prubeh("Ukládám doklad…");
    const doklad = await db.vystavitDoklad({ zakazka_id, vozidlo_id, nabidka_id, druh, verze, cislo, variabilni_symbol: vsDokladu(cisloZakazky, druh, verze), jazyk,
      vystaveno: vystaveno || dnes(), splatnost: splatnost || null, data: ulozenaData, celkem: vysledek.celkem ?? null, soubory, podpisy });
    posledniPdf = { zakazka_id, cislo, bytes, nazev: `${cislo}.pdf`, druh, jazyk, prilohy: hotovePrilohy };
    return { doklad, bytes, cislo };
  }

  async function ulozitPrijem(iframe, podpisVyh, podpisZak, vyhPodepsalNaIpadu = false, podepisePozdeji = false) {
    if (!podpisZak && !podepisePozdeji) return hlaska("Chybí podpis zákazníka.", true);
    const p = prekryv("Ukládám zakázku…");
    try {
      // 1) dohrát fotky, které ještě nejsou nahrané
      for (const f of P.fotky.filter(f => f.stav !== "nahrano")) {
        if (!blobyFotek[f.id]) { P.fotky = P.fotky.filter(x => x !== f); continue; }
        p.text("Nahrávám fotky…"); await nahrajFotku(f);
        if (f.stav !== "nahrano") throw new Error("Některé fotky se nepodařilo nahrát – zkontrolujte připojení a zkuste to znovu.");
      }
      // 2) zákazník + auto + zakázka s číslem (jedním krokem v databázi)
      if (!P.vysledek) {
        p.text("Zakládám zakázku…");
        const z = { ...P.zakaznik }; for (const k in z) if (typeof z[k] === "string") z[k] = z[k].trim();
        const v = { ...P.vozidlo, vin: P.vozidlo.vin.replace(/\s/g, ""), rok: String(P.vozidlo.rok).trim() || null };
        for (const k in v) if (v[k] === "") v[k] = null;
        const k = { ...P.zakazka, zavady: P.zakazka.zavady.map(s => s.trim()).filter(Boolean), stav_prijem: P.zakazka.stav_prijem.map(s => s.trim()).filter(Boolean),
          km_prijem: cisloZ(P.zakazka.km_prijem), odhad_ceny: cisloZ(P.zakazka.odhad_ceny), foto_prijem: P.fotky.length > 0,
          predpoklad_dokonceni: P.zakazka.predpoklad_dokonceni || null };
        P.vysledek = await db.zalozitZakazku({ zakaznik: z, vozidlo: v, zakazka: k, zmena_majitele: jinyNezMajitel() && P.zmenaMajitele === true });
        ulozKoncept();
      }
      const { zakazka_id, vozidlo_id, cislo } = P.vysledek;
      // 3) zakázkový list s číslem a podpisy → PDF → uložený, uzamčený doklad
      await ulozitDoklad({ iframe, sablona: "zakazkovy-list.html", data: dataZakazkovehoListu(cislo, podpisVyh, podepisePozdeji ? null : podpisZak, podepisePozdeji), jazyk: P.zakazka.jazyk,
        zakazka_id, vozidlo_id, cisloZakazky: cislo, druh: "zakazkovy_list", vystaveno: P.zakazka.datum_prijmu,
        podpisZak: podepisePozdeji ? null : podpisZak, jmenoZakaznika: P.zakaznik.jmeno.trim(), vyhPodepsalNaIpadu, prubeh: p.text });
      if (podepisePozdeji && posledniPdf) posledniPdf.cekaPodpis = true;
      // 4) fotky k zakázce
      if (P.fotky.length) await db.vlozit("soubory", P.fotky.map(f => ({ zakazka_id, vozidlo_id, druh: f.video ? "video" : "foto", faze: "prijem", klic: f.klic, nazev: f.nazev || null, mime: f.mime || "image/jpeg" })));
      await zapsatTP(vozidlo_id, zakazka_id);
      uloz(KONCEPT, null); P = null;
      p.zavri();
      location.hash = `#/hotovo/${zakazka_id}`;
    } catch (e) {
      p.zavri();
      hlaska("Uložení se nepovedlo: " + chybaText(e) + " – zkuste to znovu, nic se neztratí.", true, 8000);
      const s = document.getElementById("stav-ulozeni"); if (s && P?.vysledek) s.textContent = `Zakázka #${P.vysledek.cislo} je založená – dokončete uložení listu.`;
    }
  }
  function dataUrlNaBlob(u) {
    const [hlav, b64] = u.split(","), bin = atob(b64), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: hlav.match(/:(.*?);/)[1] });
  }

  /* ================= hotovo ================= */
  async function hotovo(id) {
    const pdf = posledniPdf && posledniPdf.zakazka_id === id ? posledniPdf : null;
    const nazev = pdf ? NAZEV_DOKLADU.cs[pdf.druh] || "Doklad" : "Doklad";
    app.innerHTML = `<div class="karta hotovo">
      <div class="fajfka">✓</div>
      <div class="mutted">${esc(nazev)} uložen${["nabidka", "faktura", "zalohova"].includes(pdf?.druh) ? "a" : ""}</div>
      <div class="velke-cislo">${pdf ? esc(pdf.cislo) : ""}</div>
      ${pdf?.cekaPodpis ? `<div class="info pozor" style="text-align:left">Zákazník ještě nepodepsal. Pošlete mu odkaz na E-servisku – ${pdf.druh === "faktura" ? "fakturu" : pdf.druh === "zalohova" ? "zálohovou fakturu" : "zakázkový list"} tam podepíše prstem z domu.
        <div class="radek-tlacitek" style="margin-top:10px"><button class="tl tl-hlavni" id="odkaz-podpis">🔗 Poslat odkaz k podpisu</button></div></div>`
        : `<p class="mutted">PDF je uložené u zakázky. Zákazníkovi ho můžete hned poslat.</p>`}
      <div class="radek-tlacitek">
        ${pdf ? `<button class="tl tl-hlavni tl-velke" id="sdilet">Poslat / sdílet PDF</button><button class="tl tl-velke" id="otevrit">Otevřít PDF</button>` : ""}
        <a class="tl tl-velke" href="#/zakazka/${id}">Detail zakázky</a>
        <a class="tl tl-velke" href="#/">Přehled</a>
      </div></div>`;
    if (!pdf) return;
    const op = app.querySelector("#odkaz-podpis");
    if (op) op.onclick = async () => { try { poslatOdkazKPodpisu(await db.detail(id), pdf); } catch (e) { hlaska(chybaText(e), true); } };
    const soubory = [pdf, ...(pdf.prilohy || [])].map(x => new File([x.bytes], x.nazev, { type: "application/pdf" }));
    if (soubory.length > 1) app.querySelector("#otevrit").insertAdjacentHTML("afterend", soubory.slice(1).map((f, i) => `<button class="tl tl-velke" data-priloha="${i + 1}">Otevřít ${/parts-list/.test(f.name) ? "parts list" : "přílohu"}</button>`).join(""));
    app.querySelector("#otevrit").onclick = () => window.open(URL.createObjectURL(soubory[0]), "_blank");
    app.querySelectorAll("[data-priloha]").forEach(b => b.onclick = () => window.open(URL.createObjectURL(soubory[+b.dataset.priloha]), "_blank"));
    app.querySelector("#sdilet").onclick = async () => {
      if (navigator.canShare && navigator.canShare({ files: soubory })) {
        try { await navigator.share({ files: soubory, title: pdf.nazev }); } catch (e) { /* zrušeno */ }
      } else {
        for (const f of soubory) { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); await cekej(300); }
      }
    };
  }

  /* ================= práce a díly – výpočty ================= */
  const zaokrouhli = n => Math.round(Number(n) || 0);
  const cenaPrace = p => (p.typ || "prace") === "pausal" ? (Number(p.castka) || 0) : (p.typ || "prace") === "prace" ? (Number(p.mnozstvi) || 0) * (Number(p.sazba) || 0) : 0;
  const prodejDilu = d => zaokrouhli((Number(d.nakupni_cena) || 0) * (Number(d.kurz) || 1) * (1 + (Number(d.marze_pct ?? 30) || 0) / 100));
  const cenaDilu = d => d.stav === "nepouzito" ? 0 : (Number(d.prodejni_cena) || 0) * (Number(d.mnozstvi) || 0);
  const soucty = (polozky, dily) => {
    const prace = polozky.reduce((s, p) => s + cenaPrace(p), 0), material = zaokrouhli(dily.reduce((s, d) => s + cenaDilu(d), 0));
    const hodin = polozky.filter(p => (p.typ || "prace") === "prace" && p.jednotka === "h").reduce((s, p) => s + (Number(p.mnozstvi) || 0), 0);
    return { prace, material, celkem: prace + material, hodin };
  };
  const STAVY_DILU = [["potreba", "Potřeba"], ["objednano", "Objednáno"], ["mam", "Mám"], ["namontovano", "Namontováno"], ["nepouzito", "Nepoužito"]];
  const MAX_POLOZEK = 13;   // tolik řádků se vejde do tabulky na nabídce a faktuře

  /* Data pro šablonu faktury / nabídky */
  function dataFaktury({ z, polozky, dily, druh, cislo, vs, vystaveno, splatnost, platnost, podpisVyh, podpisZak, odecty = [] }) {
    const c = z.zakaznici || {}, v = z.vozidla || {};
    const zaloha = druh === "zalohova" || druh === "opravny";             // bez řádku materiálu
    if (odecty.length) polozky = [...polozky, ...odecty];
    return {
      druh: ["nabidka", "zalohova", "opravny"].includes(druh) ? druh : undefined, bezMaterialu: zaloha || undefined, cislo, vs, vystaveno, splatnost, platnost,
      zakaznik: { jmeno: c.jmeno || "", ulice: c.ulice || "", mesto: [c.psc, c.mesto].filter(Boolean).join(" "), zeme: c.zeme || "",
        telefon: c.telefon || "", email: c.email || "", ico: c.ico || "", dic: c.dic || "" },
      vozidlo: { znacka: v.znacka || "Mercedes-Benz", typ: v.typ || "", model: v.model || "", rok: v.rok ? String(v.rok) : "", vin: v.vin || "" },
      polozky: polozky.map(p => ({ typ: p.typ || "prace", popis: p.popis || "", mnozstvi: Number(p.mnozstvi) || 0, jednotka: p.jednotka || "", cena: Number(p.sazba) || 0, castka: Number(p.castka) || 0 })),
      material: zaloha ? 0 : soucty(polozky, dily).material,
      vyhotovil: uzivatel?.jmeno, podpisVyhotovil: podpisVyh || undefined, podpisZakaznik: podpisZak || undefined
    };
  }
  /* Data pro předávací protokol (šablona zakázkového listu, druh „protokol“) */
  function dataProtokolu({ z, cislo, f, podpisVyh, podpisZak }) {
    const c = z.zakaznici || {}, v = z.vozidla || {}, en = z.jazyk === "en";
    return {
      druh: "protokol", cislo,
      zakaznik: { jmeno: c.jmeno || "", ulice: c.ulice || "", mesto: [c.psc, c.mesto].filter(Boolean).join(" "), zeme: c.zeme || "", telefon: c.telefon || "", email: c.email || "" },
      zavady: z.zavady || [],
      vozidlo: { znacka: v.znacka || "Mercedes-Benz", typ: v.typ || "", model: v.model || "", rok: v.rok ? String(v.rok) : "", vin: v.vin || "" },
      nadrz: en ? (NADRZ_EN[f.nadrz] || f.nadrz) : f.nadrz, tp: !!f.tp, foto: !!f.foto,
      stav: f.stav.map(s => s.trim()).filter(Boolean), datum: f.vystaveno, prevzeti: f.prevzeti,
      kolaDotazena: !!f.kola, zkusebniJizda: !!f.jizda,
      vyhotovil: uzivatel?.jmeno, podpisVyhotovil: podpisVyh || undefined, podpisZakaznik: podpisZak || undefined
    };
  }

  /* ================= detail zakázky ================= */
  let E = null;   // rozpracované práce a díly otevřené zakázky {id, polozky, dily, dodavatele}
  // kurz EUR podle ČNB (načte se jednou za otevření aplikace; bez spojení 25 Kč) – jde u dílu přepsat
  let kurzCnb = null, kurzCnbNacitam = null;
  const kurzEur = () => kurzCnb?.kurz ? Math.round(kurzCnb.kurz * 100) / 100 : 25;
  const nactiKurzEur = () => kurzCnbNacitam ||= (db.kurzEur ? db.kurzEur() : Promise.reject()).then(k => (kurzCnb = k)).catch(() => { kurzCnbNacitam = null; });
  // sbalovací sekce zakázky: aplikace si pamatuje (pro každou zakázku zvlášť), co bylo rozbalené
  const SBAL_KLIC = "werk-sbaleni", SBAL_VYCHOZI = ["sekce-prace", "sekce-dily", "sekce-servis", "souhrn"];
  const sbalNacti = () => { try { return JSON.parse(localStorage.getItem(SBAL_KLIC) || "{}") || {}; } catch (e) { return {}; } };
  const sbalOtevreno = (zid, sid) => { const x = sbalNacti()[zid]; return x && sid in x ? !!x[sid] : SBAL_VYCHOZI.includes(sid); };
  const sbalOpen = (zid, sid) => (sbalOtevreno(zid, sid) ? " open" : "");
  function sbalPamatuj(root, zid) {
    root.querySelectorAll("details[data-sbal]").forEach(d => d.addEventListener("toggle", () => {
      const vse = sbalNacti(), x = vse[zid] || {}; delete vse[zid];
      x[d.id] = d.open; vse[zid] = x;                                    // naposledy použitá zakázka na konec
      const k = Object.keys(vse); k.slice(0, Math.max(0, k.length - 300)).forEach(a => delete vse[a]);
      try { localStorage.setItem(SBAL_KLIC, JSON.stringify(vse)); } catch (e) { /* bez úložiště to jen nebude pamatovat */ }
    }));
  }
  // F5: poznámky (k zakázce a k autu) – sbalené, ukládají se samy
  const nahledPoznamky = t => { const r = String(t || "").trim().split("\n")[0]; return r ? esc(r.length > 60 ? r.slice(0, 60) + "…" : r) : '<span class="mutted">žádné</span>'; };
  function blokPoznamek(pole, zid) {
    const n = pole.filter(x => String(x.hodnota || "").trim()).length;
    return `<details class="karta poznamky"${zid ? ` id="sekce-poznamky" data-sbal${sbalOpen(zid, "sekce-poznamky")}` : ""}><summary><b>📝 Poznámky</b> <span class="mutted">${n ? pole.filter(x => String(x.hodnota || "").trim()).map(x => nahledPoznamky(x.hodnota)).join(" · ") : "žádné"}</span></summary>
      ${pole.map(x => `<label class="pole" style="margin-top:12px">${x.popis}<textarea class="vstup" rows="3" data-poznamka="${x.tabulka}" data-id="${x.id}" placeholder="${x.napoveda || ""}">${esc(x.hodnota || "")}</textarea></label>`).join("")}
      <span class="napoveda" data-stav-poznamek></span></details>`;
  }
  function navazPoznamky(root, potom) {
    root.querySelectorAll("textarea[data-poznamka]").forEach(t => {
      const st = root.querySelector("[data-stav-poznamek]");
      t.addEventListener("input", () => { clearTimeout(t._u); st.textContent = "Ukládám…"; t._u = setTimeout(async () => {
        try { await ulozitZmenu(t.dataset.poznamka, t.dataset.id, { poznamky: t.value.trim() || null }, st); potom?.(t.dataset.poznamka, t.value); }
        catch (e) { st.innerHTML = `<span style="color:var(--cervena)">Neuloženo – ${esc(chybaText(e))}</span>`; }
      }, 800); });
    });
  }
  // Postup prací: odrážky z inspekce, které se během opravy odklikávají; lišta s % vidí i zákazník v E-servisce
  const postupProcent = u => { const p = (u || []).filter(x => String(x.t || "").trim()); return p.length ? Math.round(p.filter(x => x.h).length / p.length * 100) : 0; };
  const listaPostupu = (u, male) => { const p = postupProcent(u), n = (u || []).filter(x => String(x.t || "").trim()).length;
    return `<div class="postup${male ? " postup-male" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" title="Hotovo ${p} %"><div class="postup-lista"><div style="width:${p}%"></div></div><b>${n ? p + " %" : "–"}</b></div>`; };
  function blokPostupu(z) {
    const u = Array.isArray(z.ukoly) ? z.ukoly : [];
    return `<details class="karta postup-prace" id="postup-prace" data-sbal${sbalOpen(z.id, "postup-prace")}><summary><b>🔧 Práce</b>${listaPostupu(u, true)}</summary>
      <div id="ukoly"></div></details>`;
  }
  function vykresliUkoly(root, z) {
    const el = root.querySelector("#ukoly"); if (!el) return;
    if (!Array.isArray(z.ukoly)) z.ukoly = [];
    const U = z.ukoly, st = () => el.querySelector("[data-stav-ukolu]");
    const obnovListy = () => { const p = postupProcent(U); root.querySelectorAll("#postup-prace .postup").forEach(x => { x.querySelector(".postup-lista div").style.width = p + "%"; x.querySelector("b").textContent = U.some(y => String(y.t || "").trim()) ? p + " %" : "–"; x.setAttribute("aria-valuenow", p); }); };
    const uloz = () => { obnovListy(); clearTimeout(el._u); st().textContent = "Ukládám…"; el._u = setTimeout(async () => {
      const data = U.map(x => ({ t: String(x.t || "").trim(), h: !!x.h })).filter(x => x.t);
      try { await ulozitZmenu("zakazky", z.id, { ukoly: data }, st()); }
      catch (e) { st().innerHTML = `<span style="color:var(--cervena)">Neuloženo – ${esc(chybaText(e))}</span>`; }
    }, 700); };
    const kresli = (fokus) => {
      if (!U.length) U.push({ t: "", h: false });
      el.innerHTML = `${listaPostupu(U)}
        <div class="ukoly">${U.map((x, i) => `<div class="ukol${x.h ? " hotovy" : ""}">
          <input type="checkbox" class="ukol-check" data-ukol-h="${i}" ${x.h ? "checked" : ""} aria-label="Hotovo">
          <textarea class="vstup" rows="1" data-ukol="${i}" placeholder="${i ? "Další úkon…" : "Např. Vyměnit přední brzdové destičky"}">${esc(x.t || "")}</textarea>
          <button type="button" class="tl smazat" data-ukol-x="${i}" aria-label="Smazat řádek">×</button></div>`).join("")}</div>
        <div class="radek-tlacitek" style="margin-top:10px"><button type="button" class="tl tl-male" data-ukol-pridat>＋ Přidat úkon</button>
          <span class="napoveda">Enter = další řádek. Zákazník v E-servisce vidí jen lištu a procenta, ne text.</span><span class="napoveda" data-stav-ukolu style="margin-left:auto"></span></div>
        ${z.zavady?.length && !U.some(x => String(x.t || "").trim()) ? `<div class="cipy"><span class="napoveda" style="align-self:center">Ze zakázkového listu:</span><button type="button" class="cip" data-ukol-zavady>＋ převzít závady (${z.zavady.length})</button></div>` : ""}`;
      el.querySelectorAll("textarea[data-ukol]").forEach(t => {
        const roztahni = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }; roztahni();
        t.addEventListener("input", () => { U[+t.dataset.ukol].t = t.value; roztahni(); uloz(); });
        t.addEventListener("keydown", e => {
          const i = +t.dataset.ukol;
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); U.splice(i + 1, 0, { t: "", h: false }); kresli(i + 1); uloz(); }
          else if (e.key === "Backspace" && !t.value && U.length > 1) { e.preventDefault(); U.splice(i, 1); kresli(Math.max(0, i - 1)); uloz(); }
        });
      });
      el.querySelectorAll("[data-ukol-h]").forEach(c => c.onchange = () => { U[+c.dataset.ukolH].h = c.checked; c.closest(".ukol").classList.toggle("hotovy", c.checked); uloz(); });
      el.querySelectorAll("[data-ukol-x]").forEach(b => b.onclick = () => { const x = U[+b.dataset.ukolX]; if (String(x?.t || "").trim() && !confirm(`Opravdu smazat „${x.t.trim()}“?`)) return; U.splice(+b.dataset.ukolX, 1); kresli(); uloz(); });
      el.querySelector("[data-ukol-pridat]").onclick = () => { U.push({ t: "", h: false }); kresli(U.length - 1); };
      const zz = el.querySelector("[data-ukol-zavady]");
      if (zz) zz.onclick = () => { U.splice(0, U.length, ...z.zavady.map(t => ({ t, h: false }))); kresli(); uloz(); };
      if (fokus != null) { const t = el.querySelector(`textarea[data-ukol="${fokus}"]`); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
      obnovListy();
    };
    kresli();
  }
  // zakázkový list (poslední verze), který čeká na podpis zákazníka z E-servisky
  const cekajiciList = doklady => { const zl = (doklady || []).filter(d => d.druh === "zakazkovy_list").sort((a, b) => (b.verze || 1) - (a.verze || 1))[0]; return zl?.data?.cekaPodpis ? zl : null; };
  // faktury / zálohové faktury vystavené s „Podepíše později“ (čekající i už podepsané v E-servisce)
  const cekajiciFaktury = doklady => (doklady || []).filter(d => (d.druh === "faktura" || d.druh === "zalohova") && d.data?.cekaPodpis);
  const dalkovyPodpis = d => { const x = d?.dalkove_podpisy; return Array.isArray(x) ? x[0] || null : x || null; };
  const blobNaDataUrl = b => new Promise((ok, chyba) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = chyba; r.readAsDataURL(b); });
  async function vystavitPodepsanyList(z, zl) {
    const dp = dalkovyPodpis(zl); if (!dp?.soubory?.klic) return hlaska("Podpis zákazníka se nenašel.", true);
    const p = prekryv("Vystavuji podepsaný zakázkový list…");
    try {
      const podpisZak = await blobNaDataUrl(await db.stahnout(dp.soubory.klic));
      // „Vyhotovil“ = kdo list původně vystavil (jeho podpis z profilu)
      let podpisVyh = null; const kdo = zl.data?.vyhotovil;
      if (!kdo || kdo === uzivatel.jmeno) podpisVyh = await podpisVyhotovil();
      else { try { podpisVyh = (await db.uzivatele()).find(u => u.jmeno === kdo)?.podpis_obrazek || null; } catch (e) { /* bez podpisu */ } }
      const kdy = new Date(dp.podepsano), en = zl.jazyk === "en";
      const data = { ...zl.data, cekaPodpis: undefined, podpisVyhotovil: podpisVyh || undefined, podpisZakaznik: podpisZak,
        podepsanoDalkove: (en ? "Signed online (e-service book) " : "Podepsáno online v E-servisce ") + kdy.toLocaleString(en ? "en-GB" : "cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) };
      const verze = Math.max(...(z.doklady || []).filter(d => d.druh === "zakazkovy_list").map(d => d.verze || 1)) + 1;
      data.cislo = cisloDokladu(z.cislo, "zakazkovy_list", verze);
      let f = skryteRamecky["zakazkovy-list.html"];
      if (!f || !f.isConnected) { f = document.createElement("iframe"); f.setAttribute("aria-hidden", "true"); f.tabIndex = -1;
        f.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;visibility:hidden"; document.body.appendChild(f); skryteRamecky["zakazkovy-list.html"] = f; }
      const { doklad } = await ulozitDoklad({ iframe: f, sablona: "zakazkovy-list.html", data, jazyk: zl.jazyk || "cs", zakazka_id: z.id, vozidlo_id: z.vozidlo_id, cisloZakazky: z.cislo,
        druh: "zakazkovy_list", verze, vystaveno: dnes(), podpisZak, jmenoZakaznika: z.zakaznici?.jmeno || "", zpusobZak: "dalkove", prubeh: p.text });
      try { await db.upravit("dalkove_podpisy", dp.id, { vystaveny_doklad_id: doklad?.id || null }); } catch (e) { /* jen evidence */ }
      p.zavri(); hlaska(`Podepsaný zakázkový list ${data.cislo} vystaven.`); detail(z.id);
    } catch (e) { p.zavri(); hlaska("Vystavení se nepovedlo: " + chybaText(e), true, 8000); }
  }
  // iPhone/iPad: nabídka Sdílet (WhatsApp, Zprávy, e-mail…); jinak zkopírovat
  // odkaz k podpisu: připravený e-mail zákazníkovi (odešle se z poštovní aplikace – účet info@mercedesrest.cz); bez e-mailu sdílení jako dřív
  function poslatOdkazKPodpisu(z, d = null) {
    const v = z.vozidla || {}, c = z.zakaznici || {}, en = z.jazyk === "en", url = odkazEservisky(v);
    const email = String(c.email || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { hlaska("Zákazník nemá e-mail – posílám odkaz jinak (WhatsApp, zprávy…)."); return sdiletOdkazEservisky(v, en, d?.druh || true); }
    // typové označení jako v E-servisce: 126 → W126, 107 → R107, 124 C → C124 (bez motorizace a obchodního označení)
    const t = String(v.typ || "").toUpperCase().replace(/\s+/g, ""), m = t.match(/^([WRC])?(\d{3})/);
    const typ = m ? (m[1] || (m[2] === "107" ? "R" : m[2] === "124" && /C$/.test(t) ? "C" : "W")) + m[2] : String(v.typ || "").trim();
    const vuz = ["Mercedes-Benz", typ].filter(Boolean).join(" "), kdo = uzivatel?.jmeno || "Václav Macháň";
    // faktura / zálohová faktura vystavená s „Podepíše později“ – stejný styl e-mailu, jiný doklad (Vašek 30.10.2026)
    const fa = d?.druh === "faktura" || d?.druh === "zalohova", zal = d?.druh === "zalohova", cislo = fa ? d.cislo : z.cislo;
    const co = en ? (zal ? "advance invoice" : "invoice") : null;
    const predmet = fa ? (en ? `${zal ? "Advance invoice" : "Invoice"} no. ${cislo} ${vuz}` : `${zal ? "Zálohová faktura" : "Faktura"} č. ${cislo} ${vuz}`)
      : en ? `Work order no. ${z.cislo} ${vuz}` : `Zakázkový list č. ${z.cislo} ${vuz}`;
    const text = fa ? (en
      ? `Dear Sir or Madam,\n\nplease find below the link to sign the ${co} for your ${vuz} (${co} no. ${cislo}, order no. ${z.cislo}). After opening the link you can view the ${co} in a preview. Please check and sign it.\n\nYou will then find the signed version in your e-service book in the section „Visit documents“ of the respective visit.\n\nIn the service book you can also see the photos and the list of work carried out, the parts used and further information about your car.\n\nLink to sign the ${co} and to your e-service book:\n\n${url}\n\nThank you for your trust.\n\n${kdo}\nM|R`
      : `Dobrý den,\n\nzasílám odkaz pro podepsání ${zal ? "zálohové faktury" : "faktury"} k vašemu vozu ${vuz} (${zal ? "zálohová faktura" : "faktura"} č. ${cislo}, zakázka č. ${z.cislo}). ${zal ? "Zálohovou fakturu" : "Fakturu"} si po otevření odkazu zobrazíte v náhledu. Prosím o kontrolu a podpis.\n\nPodepsanou verzi pak naleznete v e-servisní knížce v sekci „Dokumenty k návštěvě“ u dané návštěvy.\n\nV servisní knížce najdete také fotky a přehled provedených prací, seznam použitých dílů a další informace o vašem voze.\n\nOdkaz k podpisu a do e-servisní knížky:\n\n${url}\n\nDěkujeme za důvěru.\n\n${kdo}\nM|R`)
      : en
      ? `Dear Sir or Madam,\n\nplease find below the link to sign the work order for your ${vuz} (order no. ${z.cislo}). After opening the link you can view the work order in a preview. Please check and sign it.\n\nYou will then find the signed version in your e-service book under “Documents for this visit” for the respective visit.\n\nIn the e-service book you can follow the progress and photos of the work, the list of parts and further information. The content will grow as we work on the car.\n\nLink to sign the work order and to your e-service book:\n\n${url}\n\nThank you for your trust, we look forward to working with you.\n\n${kdo}\nM|R`
      : `Dobrý den,\n\nzasílám odkaz pro podepsání zakázkového listu k vašemu vozu ${vuz} (zakázka č. ${z.cislo}). Zakázkový list si po otevření odkazu zobrazíte v náhledu. Prosím o kontrolu a podpis.\n\nPodepsanou verzi pak naleznete v e-servisní knížce v sekci „Dokumenty k návštěvě“ u dané návštěvy.\n\nV servisní knížce můžete sledovat průběh a fotky prací, seznam dílů a další informace. Obsah bude postupně přibývat, jak se na autě bude pracovat.\n\nOdkaz k podpisu a do e-servisní knížky:\n\n${url}\n\nDěkujeme za důvěru a těšíme se na spolupráci.\n\n${kdo}\nM|R`;
    const u = `mailto:${email}?subject=${encodeURIComponent(predmet)}&body=${encodeURIComponent(text).replace(/%0A/g, "%0D%0A")}`;
    if (window.__MAILTO__) window.__MAILTO__(u); else location.href = u;     // (testy si mailto zachytí)
  }
  async function sdiletOdkazEservisky(v, en = false, kPodpisu = true) {
    const url = odkazEservisky(v), auto = [v.typ, v.model].filter(Boolean).join(" ");
    const fa = kPodpisu === "faktura" ? ["invoice", "faktury"] : kPodpisu === "zalohova" ? ["advance invoice", "zálohové faktury"] : ["work order", "zakázkového listu"];
    const titul = kPodpisu ? (en ? `Please sign the ${fa[0]} for your ${auto}: ` : `Prosím o podpis ${fa[1]} k vašemu vozu ${auto}: `) : `E-servisní knížka – ${auto}`;
    try { if (navigator.share) { await navigator.share({ title: titul, text: titul, url }); return; } } catch (e) { if (e?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); hlaska("Odkaz na E-servisku zkopírován – vložte ho zákazníkovi do zprávy."); }
    catch (e) { prompt("Odkaz na E-servisku:", url); }
  }
  async function detail(id) {
    const n0 = navId;
    await dokoncitUkladani();                            // překreslení zakázky nesmí předběhnout rozdělané uložení
    nactiKurzEur();
    app.innerHTML = `<div class="nacitani">Načítám zakázku…</div>`;
    let z, polozky = [], dily = [], dodavatele = [];
    try {
      [z, polozky, dily, dodavatele] = await Promise.all([db.detail(id), db.polozky(id), db.dily(id), db.dodavatele().catch(() => [])]);
      if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
    } catch (e) { app.innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (!z) { app.innerHTML = `<div class="info chyba">Zakázka nenalezena.</div>`; return; }
    E = { id, z, polozky: polozky.map(p => ({ ...p, typ: p.typ || "prace" })), dily: dily.map(d => ({ ...d })), dodavatele };
    zFronty(id, z, E);
    const v = z.vozidla || {}, c = z.zakaznici || {};
    const jedn = v.jednotka_tachometru === "mi" ? "mi" : "km";
    const doklady = (z.doklady || []).sort((a, b) => a.cislo.localeCompare(b.cislo, "cs", { numeric: true }));
    app.innerHTML = `
      <div class="hlavicka-prehledu">
        <div><div class="mutted">Zakázka · ${esc(c.jmeno || "")}</div><h1 style="margin:0">#${z.cislo} · ${esc([v.typ, v.model].filter(Boolean).join(" ") || "Mercedes-Benz")}</h1></div>
        <span class="radek-tlacitek"><label class="vyber-stavu ${["predano", "zaplaceno", "hotovo"].includes(z.stav) ? "hotovo" : z.stav === "zruseno" ? "zruseno" : ""}" title="Stav zakázky">
            <select id="stav-zakazky" aria-label="Stav zakázky">${Object.entries(STAVY).map(([k, t]) => `<option value="${k}" ${k === z.stav ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          ${uzivatel.role === "majitel" ? (doklady.some(d => ["faktura", "zalohova", "opravny"].includes(d.druh))
            ? (z.stav !== "zruseno" ? `<button class="tl tl-male tl-smazat" id="zrusit-zakazku">✕ Zrušit zakázku</button>` : "")
            : `<button class="tl tl-male tl-smazat" id="smazat-zakazku">🗑 Smazat</button>`) : ""}</span>
      </div>

      <div class="rychle-foto jen-telefon">
        <label class="tl tl-hlavni tl-velke">📷 Přidat fotky<input type="file" accept="image/*" capture="environment" multiple hidden data-rychle-foto></label>
        <label class="tl tl-velke">🎥 Video<input type="file" accept="video/*" capture="environment" hidden data-rychle-foto></label>
        <label class="tl tl-velke" aria-label="Vybrat z galerie">🖼<input type="file" accept="image/*,video/*" multiple hidden data-rychle-foto></label>
      </div>
      ${blokPostupu(z)}
      <section class="karta"><h2>Doklady</h2>
        ${(() => { const zl = cekajiciList(doklady); if (!zl) return "";
          const dp = dalkovyPodpis(zl);
          const kdy = dp ? esc(new Date(dp.podepsano).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })) : "";
          // podpis z E-servisky se do PDF vloží sám (server) – tlačítko „Vystavit“ jen když se to nepovedlo
          if (dp && dp.vystaveny_doklad_id) return `<div class="info ok-podpis"><span>✍️ Zákazník podepsal zakázkový list ${esc(zl.cislo)} v E-servisce ${kdy}. Podepsané PDF je uložené u dokladu i v E-servisce.</span></div>`;
          return dp ? `<div class="info ok-podpis"><span>✍️ Zákazník podepsal zakázkový list v E-servisce ${kdy}.</span>
              <button class="tl tl-hlavni" id="vystavit-podepsany">Vystavit podepsaný list</button></div>`
            : `<div class="info pozor"><span>⏳ Zakázkový list ${esc(zl.cislo)} čeká na podpis zákazníka v E-servisce.</span>${v.vin ? ` <button class="tl tl-male" id="odkaz-k-podpisu">🔗 Poslat odkaz k podpisu</button>` : ""}</div>`; })()}
        ${cekajiciFaktury(doklady).map(d => { const dp = dalkovyPodpis(d), co = d.druh === "zalohova" ? "Zálohová faktura" : "Faktura";
          const kdy = dp ? esc(new Date(dp.podepsano).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })) : "";
          if (dp) return `<div class="info ok-podpis"><span>✍️ Zákazník podepsal ${co === "Faktura" ? "fakturu" : "zálohovou fakturu"} ${esc(d.cislo)} v E-servisce ${kdy}.${dp.vystaveny_doklad_id ? " Podepsané PDF je uložené u dokladu i v E-servisce." : " Podpis je uložený, do PDF se ho vložit nepodařilo."}</span></div>`;
          return `<div class="info pozor"><span>⏳ ${co} ${esc(d.cislo)} čeká na podpis zákazníka v E-servisce.</span>${v.vin ? ` <button class="tl tl-male" data-odkaz-faktura="${d.id}">🔗 Poslat odkaz k podpisu</button>` : ""}</div>`; }).join("")}
        <div class="doklady">${doklady.map(d => `
          <div class="doklad"><span><b>${esc(d.cislo)}</b> · ${DRUHY[d.druh] || d.druh}${d.celkem != null ? ` · <b>${kc(d.celkem)}</b>` : ""}<br>
            <small class="mutted">vystaveno ${datumCz(d.vystaveno)}${d.splatnost ? ` · ${d.druh === "nabidka" ? "platnost" : "splatnost"} ${datumCz(d.splatnost)}` : ""}${["faktura", "zalohova", "opravny"].includes(d.druh) ? (d.zaplaceno ? ` · <b style="color:var(--zelena)">${d.druh === "opravny" && Number(d.celkem) < 0 ? "vráceno" : "zaplaceno"} ${datumCz(d.zaplaceno)}</b>` : Number(d.celkem) < 0 ? " · nevráceno" : " · nezaplaceno") : ""}</small></span>
            <span class="radek-tlacitek">
              ${["faktura", "zalohova", "opravny"].includes(d.druh) && jeMajitel() ? (d.zaplaceno ? `<button class="tl tl-male" data-nezaplaceno="${d.id}" title="Omylem označeno jako zaplacené? Vrátit zpět">↺ Zrušit úhradu</button>`
                : `<button class="tl tl-male" data-zaplaceno="${d.id}">✓ Zaplaceno</button>`) : ""}
              ${d.soubory?.klic ? `<button class="tl tl-male" data-pdf="${esc(d.soubory.klic)}">Otevřít PDF</button>` : ""}
              ${(z.soubory || []).filter(f => f.doklad_id === d.id && f.klic !== d.soubory?.klic && f.druh === "pdf").map(f => `<button class="tl tl-male" data-pdf="${esc(f.klic)}">${/parts list/.test(f.nazev || "") ? "Parts list" : "Příloha"}</button>`).join("")}
              ${lzeSmazatDoklad(d, doklady) ? `<button class="tl tl-male tl-kos" data-smazat-doklad="${d.id}" title="Smazat doklad ${esc(d.cislo)}" aria-label="Smazat doklad ${esc(d.cislo)}">🗑</button>` : ""}</span></div>`).join("")
          || ((z.soubory || []).some(f => f.druh === "archiv" && !f.smazano)
            ? `<div class="info">Zakázka ze starého systému – v aplikaci k ní nejsou vystavené doklady. Původní doklady jsou v sekci <b>Ostatní dokumenty</b> níže.</div>`
            : `<div class="info pozor">K této zakázce zatím není vystavený zakázkový list.</div>`)}</div>
        <div class="radek-tlacitek" style="margin-top:14px">
          <a class="tl tl-hlavni" href="#/zakazka/${id}/nabidka">📝 Cenová nabídka</a>
          ${jeMajitel() ? `<a class="tl tl-hlavni" href="#/zakazka/${id}/zaloha">💰 Zálohová faktura</a>
          <a class="tl tl-hlavni" href="#/zakazka/${id}/faktura">💳 Faktura</a>` : ""}
          <a class="tl tl-hlavni" href="#/zakazka/${id}/protokol">🔑 Předávací protokol</a>
          ${v.vin ? `<span class="tl-skupina"><a class="tl" href="${esc(odkazEservisky(v))}" target="_blank" rel="noopener" id="odkaz-eservisky">📖 E-serviska ↗</a><button type="button" class="tl tl-ikona" id="sdilet-eservisku" title="Poslat zákazníkovi odkaz na E-servisku" aria-label="Poslat zákazníkovi odkaz na E-servisku">🔗</button></span>` : ""}
          ${jeMajitel() && doklady.some(d => ["faktura", "zalohova"].includes(d.druh)) ? `<a class="tl" href="#/zakazka/${id}/opravny">↩︎ Opravný doklad</a>` : ""}
        </div>
        <p class="napoveda" style="margin:10px 0 0">Nabídka i faktura se vytvoří z prací a dílů níže. Každý vystavený doklad se uzamkne; nová verze dostane další číslo (např. 7377-2-2).</p>
      </section>

      <details class="karta sbalovaci" id="sekce-prace" data-sbal${sbalOpen(id, "sekce-prace")}>
        <summary><h2>Práce k fakturaci <span class="napoveda" id="stav-prace" style="margin-left:auto;font-weight:400"></span></h2></summary>
        <div id="prace"></div>
      </details>

      <details class="karta sbalovaci" id="sekce-servis" data-sbal${sbalOpen(id, "sekce-servis")}><summary><h2>Servisní úkony</h2></summary></details>
      <details class="karta sbalovaci" id="sekce-dily" data-sbal${sbalOpen(id, "sekce-dily")}>
        <summary><h2>Díly <span class="mutted" id="souhrn-dilu" style="font-weight:400;font-size:15px"></span> <span class="napoveda" id="stav-dilu" style="margin-left:auto;font-weight:400"></span></h2></summary>
        <div id="dily"></div>
      </details>
      ${blokPoznamek([{ tabulka: "zakazky", id: z.id, hodnota: z.poznamky, popis: "K této zakázce (záznam v E-servisce – uvidí ho zákazník i další majitelé auta)", napoveda: "Co je potřeba udělat, co jsme zjistili, domluva se zákazníkem…" },
        { tabulka: "vozidla", id: z.vozidlo_id || v.id, hodnota: v.poznamky, popis: "K autu – neveřejné, zákazník je nevidí (zůstanou u auta i pro další návštěvy)", napoveda: "Zvláštnosti auta, historie, co hlídat příště…" }], id)}

      <details class="karta sbalovaci souhrn-zakazky" id="souhrn" data-sbal${sbalOpen(id, "souhrn")}></details>

      <details class="karta sbalovaci" id="sekce-udaje" data-sbal${sbalOpen(id, "sekce-udaje")}>
        <summary><h2>Zákazník, vozidlo a příjem <span class="mutted" style="font-weight:400;font-size:15px">${esc([c.jmeno, [v.typ, v.model].filter(Boolean).join(" "), v.spz].filter(Boolean).join(" · "))}</span></h2></summary>
        <div class="podsekce"><h3 class="podnadpis">👤 Zákazník <a class="tl tl-male" href="#/zakaznik/${z.zakaznik_id || c.id}" style="margin-left:auto">✏️ Upravit zákazníka</a></h3><dl class="udaje">
        ${[["Jméno", esc(c.jmeno)], ["Kontaktní osoba", esc(c.kontaktni_osoba)], ["Telefon", telOdkaz(c.telefon)], ["E-mail", mailOdkaz(c.email)], ["Adresa", esc([c.ulice, [c.psc, c.mesto].filter(Boolean).join(" "), c.zeme].filter(Boolean).join(", "))], ["IČO", esc(c.ico)], ["DIČ", esc(c.dic)]]
          .filter(([, x]) => x).map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join("")}</dl>${kontaktTlacitka(c)}</div>
        <div class="podsekce"><h3 class="podnadpis">🚗 Vozidlo <a class="tl tl-male" href="#/vozidlo/${z.vozidlo_id || v.id}" style="margin-left:auto">✏️ Upravit vozidlo a TP</a></h3><dl class="udaje">
        ${[["VIN", v.vin], ["Typ", v.typ], ["Model", v.model], ["Rok", v.rok], ["SPZ", v.spz], ["Barva", v.barva], ["Verze", v.verze],
           ["Tachometr při předání", z.km_predani != null ? `${Number(z.km_predani).toLocaleString("cs-CZ")} ${jedn}` : ""]]
          .filter(([, x]) => x != null && x !== "").map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>
          <p style="margin:14px 0 8px"><b>Dokumenty vozidla</b> <span class="napoveda">(v E-servisce ke stažení)</span></p><div class="fotky" id="dokumenty-vozidla"><span class="mutted">Načítám…</span></div></div>
        <div class="podsekce" id="sekce-prijem-detail"></div>
      </details>
      <details class="karta sbalovaci" id="sekce-archiv" data-sbal${sbalOpen(id, "sekce-archiv")}><summary><h2>Ostatní dokumenty</h2></summary></details>
      <details class="karta sbalovaci" id="sekce-fotky-detail" data-sbal${sbalOpen(id, "sekce-fotky-detail")}><summary><h2>Fotky a videa</h2></summary></details>`;
    vykresliPrijemDetail(false);
    sbalPamatuj(app, id);
    app.querySelectorAll("[data-rychle-foto]").forEach(inp => inp.addEventListener("change", e => {
      const f = [...e.target.files]; e.target.value = ""; if (!f.length) return;
      document.getElementById("sekce-fotky-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
      nahratFotkyKZakazce(f);
    }));
    const cekaF = cekajiciFaktury(doklady).find(d => !dalkovyPodpis(d));
    E.cekaNaPodpis = cekajiciList(doklady) && !dalkovyPodpis(cekajiciList(doklady)) ? "zakazkovy_list" : cekaF ? cekaF.druh : false;
    const sd = app.querySelector("#sdilet-eservisku");
    if (sd) sd.onclick = () => sdiletOdkazEservisky(v, z.jazyk === "en", E.cekaNaPodpis);
    const okp = app.querySelector("#odkaz-k-podpisu");
    if (okp) okp.onclick = () => poslatOdkazKPodpisu(z);
    app.querySelectorAll("[data-odkaz-faktura]").forEach(b => b.onclick = () => poslatOdkazKPodpisu(z, doklady.find(d => d.id === b.dataset.odkazFaktura)));
    const vpl = app.querySelector("#vystavit-podepsany");
    if (vpl) vpl.onclick = async () => { vpl.disabled = true; try { await vystavitPodepsanyList(z, cekajiciList(doklady)); } finally { if (vpl.isConnected) vpl.disabled = false; } };
    vykresliFotkyDetail();
    vykresliArchiv();
    app.querySelector("#stav-zakazky").onchange = async e => {
      const novy = e.target.value, stary = E.z.stav;
      try { await db.upravit("zakazky", id, { stav: novy }); E.z.stav = novy; z.stav = novy;
        const l = e.target.parentElement; l.className = `vyber-stavu ${["predano", "zaplaceno", "hotovo"].includes(novy) ? "hotovo" : novy === "zruseno" ? "zruseno" : ""}`;
        hlaska(`Stav zakázky: ${STAVY[novy]}`); }
      catch (err) { e.target.value = stary; hlaska(chybaText(err), true); }
    };

    const sz = app.querySelector("#smazat-zakazku");
    if (sz) sz.onclick = async () => {
      const odp = prompt(`Smazat zakázku #${z.cislo} včetně zakázkového listu, nabídek, protokolu, prací, dílů a fotek? Nejde to vrátit.\n\nPro potvrzení napište číslo zakázky:`);
      if (odp == null) return;
      if (odp.trim() !== String(z.cislo)) return hlaska("Číslo nesouhlasí – nic se nesmazalo.", true);
      try {
        await dokoncitUkladani();
        const klice = (z.soubory || []).filter(f => f.druh !== "tp").map(f => f.klic), slozky = [...new Set(klice.map(slozkaSouboru).filter(Boolean))];
        await db.smazatZakazku(id); uklidSoubory({ klice, slozky }); E = null;
        uloz(FRONTA, fronta().filter(x => x.zid !== id && !(x.tabulka === "zakazky" && x.id === id))); ukazFrontu(); hlaska(`Zakázka #${z.cislo} smazána.`); location.hash = "#/zakazky";
      }
      catch (e) { hlaska("Smazat nejde: " + chybaText(e), true, 8000); }
    };
    const zr = app.querySelector("#zrusit-zakazku");
    if (zr) zr.onclick = async () => {
      if (!confirm(`Zakázka #${z.cislo} má vystavenou fakturu, proto ji nejde smazat (faktury se musí archivovat). Označit ji jako zrušenou?`)) return;
      try { await db.upravit("zakazky", id, { stav: "zruseno" }); hlaska("Zakázka zrušena."); detail(id); } catch (e) { hlaska(chybaText(e), true); }
    };
    vykresliUkoly(app, z);
    vykresliPrace(); vykresliDily(); vykresliSouhrnZakazky(); vykresliServisniUkony();
    navazPoznamky(app, (tab, h) => { if (tab === "zakazky") z.poznamky = h; else v.poznamky = h; });
    vykresliDokumentyVozidla(z.vozidlo_id || v.id, app.querySelector("#dokumenty-vozidla"));
    app.querySelectorAll("[data-pdf]").forEach(b => b.onclick = async () => {
      const okno = window.open("", "_blank");
      try { const u = await db.odkaz(b.dataset.pdf, 600); if (okno) okno.location = u; else location.href = u; }
      catch (e) { okno?.close(); hlaska(chybaText(e), true); }
    });
    app.querySelectorAll("[data-zaplaceno]").forEach(b => b.onclick = async () => {
      const d = prompt("Datum úhrady (RRRR-MM-DD):", dnes()); if (!d) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return hlaska("Datum zadejte jako 2026-11-05.", true);
      try {
        await db.upravit("doklady", b.dataset.zaplaceno, { zaplaceno: d });
        const fa = doklady.find(x => x.id === b.dataset.zaplaceno);
        if (fa?.druh === "faktura" && !["predano"].includes(z.stav)) await db.upravit("zakazky", id, { stav: "zaplaceno" });
        hlaska("Úhrada zapsána."); detail(id);
      } catch (e) { hlaska(chybaText(e), true); }
    });
    app.querySelectorAll("[data-smazat-doklad]").forEach(b => b.onclick = () => smazatDokladDotaz(doklady.find(x => x.id === b.dataset.smazatDoklad), () => detail(id)));
    app.querySelectorAll("[data-nezaplaceno]").forEach(b => b.onclick = async () => {
      const fa = doklady.find(x => x.id === b.dataset.nezaplaceno);
      if (!confirm(`Zrušit úhradu dokladu ${fa?.cislo || ""}? Doklad bude zase vedený jako nezaplacený.`)) return;
      try {
        await db.upravit("doklady", b.dataset.nezaplaceno, { zaplaceno: null });
        if (fa?.druh === "faktura" && z.stav === "zaplaceno") await db.upravit("zakazky", id, { stav: "fakturovano" });
        hlaska("Úhrada zrušena – doklad je zase nezaplacený."); detail(id);
      } catch (e) { hlaska(chybaText(e), true); }
    });
  }

  /* ---------- příjem: zobrazení a úpravy (zakázkový list -1 zůstává, jak byl podepsán) ---------- */
  function vykresliPrijemDetail(upravy) {
    const el = document.getElementById("sekce-prijem-detail"); if (!el || !E) return;
    const z = E.z, v = z.vozidla || {}, jedn = v.jednotka_tachometru === "mi" ? "mi" : "km";
    if (!upravy) {
      el.innerHTML = `<h3 class="podnadpis">📋 Příjem ${datumCz(z.datum_prijmu)} <button type="button" class="tl tl-male" id="upravit-prijem" style="margin-left:auto">✏️ Upravit příjem</button></h3>
        <dl class="udaje">${[["Předpoklad dokončení", datumCz(z.predpoklad_dokonceni)], ["Tachometr při příjmu", z.km_prijem != null ? `${Number(z.km_prijem).toLocaleString("cs-CZ")} ${jedn}` : ""],
          ["Nádrž", z.nadrz_prijem], ["TP přiložen", z.tp_prilozen == null ? "" : z.tp_prilozen ? "Ano" : "Ne"], ["Odhadovaná cena", z.odhad_ceny != null ? kc(z.odhad_ceny) : ""],
          ["Jazyk dokladů", z.jazyk === "en" ? "English" : "Čeština"]].filter(([, x]) => x).map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>
        ${z.zavady?.length ? `<p style="margin:14px 0 0"><b>Závady a objednané opravy</b></p><ul class="odrazky">${z.zavady.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        ${z.stav_prijem?.length ? `<p style="margin:14px 0 0"><b>Stav při převzetí do opravy</b></p><ul class="odrazky">${z.stav_prijem.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}`;
      el.querySelector("#upravit-prijem").onclick = () => vykresliPrijemDetail(true);
      return;
    }
    const F = { datum_prijmu: z.datum_prijmu || "", predpoklad_dokonceni: z.predpoklad_dokonceni || "", km_prijem: z.km_prijem ?? "", nadrz_prijem: z.nadrz_prijem || "",
      tp_prilozen: z.tp_prilozen, odhad_ceny: z.odhad_ceny ?? "", jazyk: z.jazyk || "cs",
      zavady: z.zavady?.length ? [...z.zavady] : [""], stav_prijem: z.stav_prijem?.length ? [...z.stav_prijem] : [""] };
    const seznam = klic => `<div class="seznam-radku">${F[klic].map((t, i) => `<div class="radek-polozky"><span class="tecka">●</span>
        <textarea class="vstup" rows="1" data-ur="${klic}" data-i="${i}">${esc(t)}</textarea>
        <button type="button" class="tl smazat" data-us="${klic}" data-i="${i}" aria-label="Smazat řádek">×</button></div>`).join("")}</div>
      <div class="radek-tlacitek" style="margin-top:8px"><button type="button" class="tl tl-male" data-up="${klic}">＋ Přidat řádek</button></div>`;
    const kresli = () => {
      el.innerHTML = `<h3 class="podnadpis">📋 Upravit příjem</h3>
        <div class="info" style="margin:0 0 14px">Změny se uloží k zakázce a použijí se v dalších dokladech. Už podepsaný zakázkový list ${esc(String(z.cislo))}-1 zůstává beze změny.</div>
        <div class="mrizka">
          <label class="pole s2">Datum převzetí<input type="date" data-uf="datum_prijmu" value="${esc(F.datum_prijmu)}"></label>
          <label class="pole s2">Předpoklad dokončení<input type="date" data-uf="predpoklad_dokonceni" value="${esc(F.predpoklad_dokonceni)}"></label>
          <label class="pole s2">Stav tachometru (${jedn === "mi" ? "míle" : "km"})<input data-uf="km_prijem" inputmode="numeric" value="${esc(F.km_prijem)}"></label>
          <div class="s4"><label class="pole">Stav nádrže</label><div class="segment" data-useg="nadrz_prijem">${NADRZ.map(n => `<button type="button" data-h='"${n}"' aria-pressed="${F.nadrz_prijem === n}">${n}</button>`).join("")}</div></div>
          <div class="s2"><label class="pole">TP přiložen</label><div class="segment" data-useg="tp_prilozen"><button type="button" data-h="true" aria-pressed="${F.tp_prilozen === true}">Ano</button><button type="button" data-h="false" aria-pressed="${F.tp_prilozen === false}">Ne</button></div></div>
          <label class="pole s2">Odhadovaná cena (Kč)<input data-uf="odhad_ceny" inputmode="numeric" value="${esc(F.odhad_ceny)}" placeholder="nepovinné"></label>
          <div class="s4"><label class="pole">Jazyk dokladů</label><div class="segment" data-useg="jazyk"><button type="button" data-h='"cs"' aria-pressed="${F.jazyk === "cs"}">Čeština</button><button type="button" data-h='"en"' aria-pressed="${F.jazyk === "en"}">English</button></div></div>
          <div class="s6"><label class="pole">Závady a objednané opravy</label>${seznam("zavady")}</div>
          <div class="s6"><label class="pole">Stav při převzetí do opravy</label>${seznam("stav_prijem")}</div>
        </div>
        <div class="radek-tlacitek" style="margin-top:16px"><button type="button" class="tl tl-hlavni" id="ulozit-prijem">💾 Uložit změny</button><button type="button" class="tl" id="zrusit-upravy">Zrušit</button></div>`;
      el.querySelectorAll("[data-uf]").forEach(i => i.addEventListener("input", () => { F[i.dataset.uf] = i.value; }));
      el.querySelectorAll("[data-useg]").forEach(sg => sg.onclick = e => { const b = e.target.closest("button"); if (!b) return;
        F[sg.dataset.useg] = JSON.parse(b.dataset.h); sg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
      el.querySelectorAll("[data-ur]").forEach(t => { t.addEventListener("input", () => { F[t.dataset.ur][+t.dataset.i] = t.value; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; });
        t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; });
      el.querySelectorAll("[data-us]").forEach(b => b.onclick = () => { F[b.dataset.us].splice(+b.dataset.i, 1); if (!F[b.dataset.us].length) F[b.dataset.us].push(""); kresli(); });
      el.querySelectorAll("[data-up]").forEach(b => b.onclick = () => { F[b.dataset.up].push(""); kresli(); const r = el.querySelectorAll(`[data-ur="${b.dataset.up}"]`); r[r.length - 1]?.focus(); });
      el.querySelector("#zrusit-upravy").onclick = () => vykresliPrijemDetail(false);
      el.querySelector("#ulozit-prijem").onclick = async () => {
        const km = String(F.km_prijem).trim() === "" ? null : cisloZ(F.km_prijem), odhad = String(F.odhad_ceny).trim() === "" ? null : cisloZ(F.odhad_ceny);
        if (km != null && (!Number.isFinite(km) || km < 0)) return hlaska("Stav tachometru zadejte jako číslo.", true);
        if (odhad != null && (!Number.isFinite(odhad) || odhad < 0)) return hlaska("Odhadovanou cenu zadejte jako číslo.", true);
        if (!F.datum_prijmu) return hlaska("Vyplňte datum převzetí.", true);
        const zmena = { datum_prijmu: F.datum_prijmu, predpoklad_dokonceni: F.predpoklad_dokonceni || null, km_prijem: km == null ? null : Math.round(km),
          nadrz_prijem: F.nadrz_prijem || null, tp_prilozen: F.tp_prilozen ?? null, odhad_ceny: odhad, jazyk: F.jazyk,
          zavady: F.zavady.map(t => t.trim()).filter(Boolean), stav_prijem: F.stav_prijem.map(t => t.trim()).filter(Boolean) };
        try { await db.upravit("zakazky", E.id, zmena); Object.assign(E.z, zmena); hlaska("Příjem upraven."); vykresliPrijemDetail(false); vykresliSouhrnZakazky(); }
        catch (e) { hlaska("Neuloženo: " + chybaText(e), true); }
      };
    };
    kresli();
  }

  /* ---------- fotky a videa zakázky: při příjmu, během opravy, při předání ---------- */
  // „profil“ = fotky auta do E-servisky nahoru vpravo; ostatní jsou servisní (E-serviska je ukáže ve „Fotky z návštěvy“)
  const FAZE_FOTEK = [["profil", "⭐ Profilové (E-serviska nahoře)"], ["prijem", "Při příjmu"], ["prubeh", "Během opravy"], ["predani", "Při předání"]];
  // fotky zákazníkovi: iPhone/iPad otevře nabídku Sdílet (WhatsApp, Zprávy…) přímo s fotkami; jinde WhatsApp s odkazem na E-servisku
  async function poslatFotky(vybrane) {
    const v = E.z.vozidla || {}, c = E.z.zakaznici || {}, en = E.z.jazyk === "en", odkaz = v.vin ? odkazEservisky(v) : "";
    const text = (en ? `Hello, here are photos from the work on your ${[v.typ, v.model].filter(Boolean).join(" ")}.` : `Dobrý den, posílám fotky z opravy vašeho vozu ${[v.typ, v.model].filter(Boolean).join(" ")}.`)
      + (odkaz ? (en ? ` More in your e-service book: ${odkaz}` : ` Další najdete v E-servisní knížce: ${odkaz}`) : "");
    const tl = app.querySelector("#odeslat-fotky"); if (tl) { tl.disabled = true; tl.textContent = "Připravuji fotky…"; }
    try {
      let soubory = [];
      const klicVyberu = vybrane.map(f => f.id).join(",");
      if (E.pripravene?.klic === klicVyberu) soubory = E.pripravene.soubory;          // druhé klepnutí: fotky už jsou stažené
      else if (navigator.canShare) {
        soubory = await Promise.all(vybrane.map(async (f, i) => {
          let r = await fetch(E.urlFotek?.[f.id] || (await db.odkaz(f.klic, 600)));
          if (!r.ok) r = await fetch(await db.odkaz(f.klic, 600));                     // odkaz vypršel → nový
          if (!r.ok) throw new Error("fotku se nepodařilo stáhnout");
          const b = await r.blob();
          const pr = (b.type.split("/")[1] || (f.video ? "mp4" : "jpg")).replace("jpeg", "jpg").replace("quicktime", "mov");
          return new File([b], `${E.z.cislo}-${String(i + 1).padStart(2, "0")}.${pr}`, { type: b.type || (f.video ? "video/mp4" : "image/jpeg") });
        }));
      }
      if (soubory.length && navigator.canShare({ files: soubory })) {
        E.pripravene = { klic: klicVyberu, soubory };
        try { await navigator.share({ files: soubory, text }); E.vyber = null; E.pripravene = null; vykresliFotkyDetail(); hlaska("Odesláno."); return; }
        catch (e) {
          if (e?.name === "AbortError") return;
          if (e?.name === "NotAllowedError") {          // iPhone: stahování trvalo, Sdílet chce nové klepnutí
            if (tl && document.body.contains(tl)) { tl.disabled = false; tl.textContent = "📤 Sdílet připravené fotky"; }
            hlaska("Fotky jsou připravené – klepněte ještě jednou na Sdílet."); return;
          }
        }
      }
      // počítač: fotky nejdou přiložit – otevřít WhatsApp se zprávou (fotky vidí v E-servisce)
      let tel = String(c.telefon || "").replace(/[^\d+]/g, "").replace(/^00/, "+");
      tel = tel.startsWith("+") ? tel.slice(1) : /^\d{9}$/.test(tel) ? "420" + tel : /^420\d{9}$/.test(tel) ? tel : "";   // jinak číslo nehádat
      window.open(`https://wa.me/${tel.length >= 10 ? tel : ""}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      hlaska("Na počítači nejde fotky přiložit – WhatsApp dostal zprávu s odkazem na E-servisku, kde fotky jsou.", false, 7000);
    } catch (e) { hlaska("Fotky se nepodařilo připravit: " + chybaText(e), true); }
    finally { if (tl && document.body.contains(tl) && !E.pripravene) { tl.disabled = false; tl.textContent = "📤 Poslat (WhatsApp…)"; } else if (tl && document.body.contains(tl)) tl.disabled = false; }
  }
  async function vykresliFotkyDetail() {
    const el = document.getElementById("sekce-fotky-detail"); if (!el || !E) return;
    const fotky = (E.z.soubory || []).filter(s => (s.druh === "foto" || s.druh === "video") && !s.smazano).map(s => ({ ...s, video: s.druh === "video" }));
    el.innerHTML = `<summary><h2>Fotky a videa${fotky.length ? ` <span class="mutted" style="font-weight:400;font-size:15px">· ${popisPoctu(fotky)}</span>` : ""}</h2></summary>
      <div class="radek-tlacitek">
        <label class="tl tl-hlavni">📷 Vyfotit<input type="file" accept="image/*" capture="environment" multiple hidden data-nahrat></label>
        <label class="tl">🎥 Natočit video<input type="file" accept="video/*" capture="environment" hidden data-nahrat></label>
        <label class="tl">Vybrat z galerie<input type="file" accept="image/*,video/*" multiple hidden data-nahrat></label>
        ${fotky.length ? `<button type="button" class="tl" id="poslat-fotky" aria-pressed="${!!E.vyber}">${E.vyber ? "✕ Zrušit výběr" : "📤 Poslat zákazníkovi"}</button>` : ""}
        <select class="vstup" id="faze-fotek" style="max-width:200px" aria-label="Kdy vyfoceno">${FAZE_FOTEK.map(([k, t]) => `<option value="${k}" ${k === (E.fazeFotek || "prubeh") ? "selected" : ""}>${t}</option>`).join("")}</select>
      </div>
      <div id="nahravani-detail"></div>
      ${E.vyber ? `<div class="info vyber-fotek"><span>Klepnutím vyberte fotky (<b id="pocet-vybranych">${E.vyber.size}</b>).</span>
        <span class="radek-tlacitek"><button type="button" class="tl tl-male" id="vybrat-vse" title="Vybere všechny kromě skrytých (🚫)">Vybrat vše</button>
        <button type="button" class="tl tl-hlavni" id="odeslat-fotky" ${E.vyber.size ? "" : "disabled"}>📤 Poslat (WhatsApp…)</button></span></div>` : ""}
      ${[FAZE_FOTEK[0], ["skryte", "🚫 Neveřejné"], ...FAZE_FOTEK.slice(1)].map(([k, t]) => { const f = fotky.filter(x => k === "skryte" ? x.verejne === false : x.verejne !== false && (x.faze || "prijem") === k); return f.length ? `<p class="faze-nadpis"><b>${t}</b> <span class="mutted">${popisPoctu(f)}${k === "profil" ? " · v E-servisce nahoře vpravo" : k === "skryte" ? " · zákazník je v E-servisce nevidí (👁 je vrátí zpět)" : ""}</span></p><div class="fotky" data-faze="${k}">${f.map(x => `<div class="fotka" data-klic="${esc(x.klic)}"><span class="mutted" style="font-size:12px">Načítám…</span></div>`).join("")}</div>` : ""; }).join("")}
      ${fotky.length ? "" : `<p class="mutted" style="margin:12px 0 0">Zatím žádné fotky.</p>`}`;
    el.querySelector("#faze-fotek").onchange = e => { E.fazeFotek = e.target.value; };
    const pf = el.querySelector("#poslat-fotky");
    if (pf) pf.onclick = () => { E.vyber = E.vyber ? null : new Set(); vykresliFotkyDetail(); };
    el.querySelectorAll("[data-nahrat]").forEach(i => i.addEventListener("change", e => { const s = [...e.target.files]; e.target.value = ""; if (s.length) nahratFotkyKZakazce(s); }));
    if (!fotky.length) return;
    try {
      const odk = await db.odkazy(fotky.map(f => f.klic));
      fotky.forEach((f, i) => {
        const box = el.querySelector(`.fotka[data-klic="${CSS.escape(f.klic)}"]`); if (!box) return;
        const u = odk[i]?.signedUrl; if (!u) return;
        box.innerHTML = (f.video ? `<video src="${esc(u)}#t=0.5" controls playsinline preload="metadata"></video>`
          : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`)
          + (uzivatel.role === "majitel" ? `<button type="button" class="odebrat" data-smazat-fotku="${f.id}" aria-label="Smazat">×</button>` : "")
          + `<button type="button" class="viditelnost" data-verejne="${f.id}" aria-pressed="${f.verejne !== false}" title="${f.verejne === false ? "Skryto v E-servisce – klepnutím zobrazit" : "Vidí zákazník v E-servisce – klepnutím skrýt"}">${f.verejne === false ? "🚫" : "👁"}</button>`;
        if (!f.video) box.insertAdjacentHTML("beforeend", `<button type="button" class="profil-tl" data-profil="${f.id}" aria-pressed="${f.faze === "profil"}" title="${f.faze === "profil" ? "Profilová fotka (E-serviska nahoře) – klepnutím přesunout mezi servisní" : "Servisní fotka – klepnutím udělat profilovou (E-serviska nahoře)"}" aria-label="Profilová fotka">${f.faze === "profil" ? "⭐" : "☆"}</button>`);
        box.classList.toggle("skryto", f.verejne === false);
        (E.urlFotek ||= {})[f.id] = u;
        if (E.vyber) { box.classList.add("vybiram"); box.classList.toggle("vybrana", E.vyber.has(f.id)); box.dataset.vybrat = f.id;
          box.insertAdjacentHTML("beforeend", `<span class="znacka-vyberu" aria-hidden="true">${E.vyber.has(f.id) ? "✓" : ""}</span>`); }
      });
      if (E.vyber) {                                      // výběr fotek k odeslání: klepnutí vybírá místo otevření
        const obnov = () => { el.querySelector("#pocet-vybranych").textContent = E.vyber.size; el.querySelector("#odeslat-fotky").disabled = !E.vyber.size; };
        el.querySelectorAll(".fotka[data-vybrat]").forEach(box => box.addEventListener("click", e => {
          if (e.target.closest("button")) return; e.preventDefault();
          const id = box.dataset.vybrat; E.vyber.has(id) ? E.vyber.delete(id) : E.vyber.add(id);
          box.classList.toggle("vybrana", E.vyber.has(id)); box.querySelector(".znacka-vyberu").textContent = E.vyber.has(id) ? "✓" : ""; obnov();
        }, true));
        el.querySelector("#vybrat-vse").onclick = () => { fotky.filter(f => f.verejne !== false).forEach(f => E.vyber.add(f.id)); vykresliFotkyDetail(); };   // skryté (🚫) nikdy hromadně
        el.querySelector("#odeslat-fotky").onclick = () => poslatFotky(fotky.filter(f => E.vyber.has(f.id)));
      }
      el.querySelectorAll("[data-profil]").forEach(b => b.onclick = async () => {        // profilová ⭐ / servisní fotka
        const s = E.z.soubory.find(x => x.id === b.dataset.profil); if (!s) return;
        const nova = s.faze === "profil" ? "prubeh" : "profil";
        try { await db.upravit("soubory", s.id, { faze: nova }); s.faze = nova; vykresliFotkyDetail(); hlaska(nova === "profil" ? "Profilová fotka – v E-servisce bude nahoře vpravo." : "Fotka přesunuta mezi servisní (Během opravy)."); }
        catch (e) { hlaska(chybaText(e), true); }
      });
      el.querySelectorAll("[data-verejne]").forEach(b => b.onclick = async () => {      // E2: fotka v E-servisce ano / ne
        const s = E.z.soubory.find(x => x.id === b.dataset.verejne); if (!s) return;
        const nove = s.verejne === false;
        try { await db.upravit("soubory", s.id, { verejne: nove }); s.verejne = nove; vykresliFotkyDetail(); hlaska(nove ? "Fotka se zákazníkovi zobrazí v E-servisce." : "Fotka je v E-servisce skrytá."); }
        catch (e) { hlaska(chybaText(e), true); }
      });
      el.querySelectorAll("[data-smazat-fotku]").forEach(b => b.onclick = async () => {
        if (!confirm("Smazat tuto fotku / video ze zakázky?")) return;
        try { const s = E.z.soubory.find(x => x.id === b.dataset.smazatFotku);
          await db.smazatZaznamSouboru(b.dataset.smazatFotku); if (s) { uklidSoubory({ klice: [s.klic] }); s.smazano = new Date().toISOString(); }
          vykresliFotkyDetail(); hlaska("Smazáno."); }
        catch (e) { hlaska(chybaText(e), true); }
      });
    } catch (e) { el.insertAdjacentHTML("beforeend", `<div class="info chyba">${esc(chybaText(e))}</div>`); }
  }
  /* ---------- servisní úkony: zaškrtnuté úkony → E-serviska spočítá „Co je příště na řadě“ ---------- */
  async function vykresliServisniUkony() {
    const el = document.getElementById("sekce-servis"); if (!el || !E) return;
    let K; try { K = await nactiKatalogServisu(); } catch (e) { el.innerHTML = `<summary><h2>Servisní úkony</h2></summary><div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (!document.getElementById("sekce-servis")) return;
    const v = E.z.vozidla || {}, sk = skupinaServisu(v), zvol = new Set(E.z.servisni_ukony || []), S2 = servisVozu(v, K);
    const ukony = S2.ukony.concat(K.ukony.filter(u => zvol.has(u.ukon) && !S2.ukony.includes(u)));   // už zaškrtnuté nikdy nezmizí
    el.innerHTML = `<summary><h2>Servisní úkony <span class="mutted" id="souhrn-servisu" style="font-weight:400;font-size:15px">${zvol.size ? `· ${zvol.size} zaškrtnut${zvol.size === 1 ? "ý" : zvol.size < 5 ? "é" : "ých"}` : ""}</span> <span class="napoveda" style="margin-left:auto;font-weight:400">pro E-servisku · ${S2.motor ? `motor ${esc(S2.motor)}` : "motor neurčen"} (${S2.palivo === "diesel" ? "diesel" : "benzín"}) · intervaly ${sk}</span></h2></summary>
      <p class="napoveda" style="margin:0 0 6px">Zaškrtněte, co se při této návštěvě provedlo. E-serviska podle toho spočítá, co je příště na řadě.${S2.motor ? "" : ` Motor jde určit v <a href="#/vozidlo/${E.z.vozidlo_id || v.id}">údajích vozidla</a>.`}</p>
      <div class="cipy">${ukony.map(u =>
        `<label class="cip zaskrt"><input type="checkbox" data-servis="${u.ukon}" ${zvol.has(u.ukon) ? "checked" : ""}> ${esc(u.nazev)}</label>`).join("")}</div>
      <div class="napoveda" id="stav-servisu" style="margin-top:8px"></div>`;
    el.querySelectorAll("[data-servis]").forEach(i => i.onchange = async () => {
      const nove = [...el.querySelectorAll("[data-servis]:checked")].map(x => x.dataset.servis), stav = el.querySelector("#stav-servisu");
      stav.textContent = "Ukládám…";
      try { await ulozitZmenu("zakazky", E.id, { servisni_ukony: nove }, stav); E.z.servisni_ukony = nove;
        const ss = el.querySelector("#souhrn-servisu"); if (ss) ss.textContent = nove.length ? `· ${nove.length} zaškrtnut${nove.length === 1 ? "ý" : nove.length < 5 ? "é" : "ých"}` : ""; }
      catch (e) { i.checked = !i.checked; stav.textContent = ""; hlaska(chybaText(e), true); }
    });
  }

  /* ---------- archiv (legacy): původní PDF ze starého systému (Excel), jen pro čtení, nic se z nich nedigitalizuje ---------- */
  function vykresliArchiv() {
    const el = document.getElementById("sekce-archiv"); if (!el || !E) return;
    const v = E.z.vozidla || {};
    const arch = (E.z.soubory || []).filter(s => s.druh === "archiv" && !s.smazano).sort((a, b) => (a.nazev || "").localeCompare(b.nazev || "", "cs"));
    el.innerHTML = `<summary><h2>Ostatní dokumenty${arch.length ? ` <span class="mutted" style="font-weight:400">${arch.length}</span>` : ""}</h2></summary>
      <p class="napoveda" style="margin:0 0 10px">PDF i fotky dokumentů (JPG, HEIC…) k této zakázce, např. původní doklady ze starého systému. 👁 = zákazník je vidí v E-servisce u této návštěvy, 🚫 = skryté.</p>
      <div class="doklady">${arch.map(f => { const pdf = /\.pdf$/i.test(f.klic || "") && !f.podepsany_z, podep = arch.find(g => g.podepsany_z === f.id);
        const stavPodpisu = !pdf ? "" : podep ? `<br><small style="color:var(--zelena)">✓ podepsáno zákazníkem v E-servisce ${datumCz(String(podep.vytvoreno || "").slice(0, 10))}</small>`
          : f.podpis_pozadan ? `<br><small style="color:var(--oranzova)">⏳ čeká na podpis zákazníka v E-servisce</small>` : "";
        return `<div class="doklad"><span>${/^image\//.test(f.mime || "") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.nazev || "") ? "🖼" : f.podepsany_z ? "✍️" : "📄"} ${esc(f.nazev || "dokument")}${stavPodpisu}</span><span class="radek-tlacitek">
        ${pdf && !podep && v.vin ? (f.podpis_pozadan ? `<button class="tl tl-male" data-archiv-podpis-odkaz="${f.id}" title="Poslat zákazníkovi znovu odkaz do E-servisky">🔗 Poslat odkaz</button><button class="tl tl-male" data-archiv-podpis-zrusit="${f.id}" title="Zrušit žádost o podpis">✕</button>`
          : `<button class="tl tl-male" data-archiv-podpis="${f.id}" title="Zákazník PDF podepíše prstem v E-servisce; vznikne kopie …_signed.pdf a originál zůstane">✍️ Nechat podepsat</button>`) : ""}
        <button class="tl tl-male" data-archiv-verejne="${f.id}" title="${f.verejne === false ? "Skryto v E-servisce – klepnutím zobrazit" : "Vidí zákazník v E-servisce – klepnutím skrýt"}" aria-label="Viditelnost v E-servisce">${f.verejne === false ? "🚫" : "👁"}</button>
        <button class="tl tl-male" data-archiv-otevrit="${esc(f.klic)}">Otevřít</button>
        ${uzivatel.role === "majitel" ? `<button class="tl tl-male tl-kos" data-archiv-smazat="${f.id}" aria-label="Smazat dokument">🗑</button>` : ""}</span></div>`; }).join("")
        || `<p class="mutted" style="margin:0">Zatím žádné dokumenty.</p>`}</div>
      <div class="radek-tlacitek" style="margin-top:12px"><label class="tl">📎 Přidat dokument (PDF / foto)<input type="file" accept="application/pdf,image/*,.heic,.heif,.jpg,.jpeg,.png" multiple hidden id="archiv-nahrat"></label></div>
      <div id="archiv-stav"></div>`;
    el.querySelectorAll("[data-archiv-otevrit]").forEach(b => b.onclick = async () => {
      const okno = window.open("", "_blank");
      try { const u = await db.odkaz(b.dataset.archivOtevrit, 600); if (okno) okno.location = u; else location.href = u; }
      catch (e) { okno?.close(); hlaska(chybaText(e), true); }
    });
    // starý zakázkový list → zákazník ho podepíše v E-servisce (vznikne …_signed.pdf, originál zůstane)
    const zadejPodpis = async (id, kdy) => { const s = E.z.soubory.find(x => x.id === id); if (!s) return;
      try { await db.upravit("soubory", id, { podpis_pozadan: kdy }); s.podpis_pozadan = kdy; vykresliArchiv(); return true; } catch (e) { hlaska(chybaText(e), true); } };
    el.querySelectorAll("[data-archiv-podpis]").forEach(b => b.onclick = async () => {
      if (await zadejPodpis(b.dataset.archivPodpis, new Date().toISOString())) { hlaska("Zákazník uvidí v E-servisce výzvu k podpisu. Pošlete mu odkaz."); sdiletOdkazEservisky(v, E.z.jazyk === "en", true); }
    });
    el.querySelectorAll("[data-archiv-podpis-odkaz]").forEach(b => b.onclick = () => sdiletOdkazEservisky(v, E.z.jazyk === "en", true));
    el.querySelectorAll("[data-archiv-podpis-zrusit]").forEach(b => b.onclick = async () => {
      if (!confirm("Zrušit žádost o podpis? Zákazník už v E-servisce výzvu neuvidí.")) return;
      if (await zadejPodpis(b.dataset.archivPodpisZrusit, null)) hlaska("Žádost o podpis zrušena.");
    });
    el.querySelectorAll("[data-archiv-verejne]").forEach(b => b.onclick = async () => {    // E5: původní doklad v E-servisce ano / ne
      const s = E.z.soubory.find(x => x.id === b.dataset.archivVerejne); if (!s) return;
      const nove = s.verejne === false;
      try { await db.upravit("soubory", s.id, { verejne: nove }); s.verejne = nove; vykresliArchiv(); hlaska(nove ? "Zákazník dokument uvidí v E-servisce." : "Dokument je v E-servisce skrytý."); }
      catch (e) { hlaska(chybaText(e), true); }
    });
    el.querySelectorAll("[data-archiv-smazat]").forEach(b => b.onclick = async () => {
      if (!confirm("Opravdu smazat tento dokument ze zakázky?")) return;
      try { const s = E.z.soubory.find(x => x.id === b.dataset.archivSmazat);
        await db.smazatZaznamSouboru(b.dataset.archivSmazat); if (s) { uklidSoubory({ klice: [s.klic] }); s.smazano = new Date().toISOString(); }
        vykresliArchiv(); hlaska("Odebráno."); }
      catch (e) { hlaska(chybaText(e), true); }
    });
    el.querySelector("#archiv-nahrat").onchange = async e => {
      const vse = [...e.target.files]; e.target.value = "";
      // úložiště bere PDF, JPG, PNG a HEIC (fotky z iPhonu)
      const typSouboru = f => { const t = (f.type || "").replace("image/heif", "image/heic").replace("image/jpg", "image/jpeg");
        return ["application/pdf", "image/jpeg", "image/png", "image/heic"].includes(t) ? t : (/\.pdf$/i.test(f.name) ? "application/pdf" : /\.hei[cf]$/i.test(f.name) ? "image/heic" : /\.png$/i.test(f.name) ? "image/png" : /\.jpe?g$/i.test(f.name) ? "image/jpeg" : ""); };
      const soubory = vse.filter(f => ["application/pdf", "image/jpeg", "image/png", "image/heic"].includes(typSouboru(f)));
      if (soubory.length < vse.length) hlaska("Některé soubory nejsou PDF, JPG, PNG ani HEIC – přeskočeny.", true);
      if (!soubory.length) return;
      const zak = E, box = el.querySelector("#archiv-stav"); let ok = 0;
      for (const f of soubory) {
        box.innerHTML = `<div class="info">Nahrávám ${esc(f.name)}…</div>`;
        try {
          const mime = typSouboru(f), pr = (f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] || (mime === "application/pdf" ? "pdf" : "jpg")).toLowerCase();
          const klic = `archiv/${zak.z.cislo}/${uuid()}.${pr}`;
          await db.nahrat(klic, f, mime, () => {});
          const [rad] = await db.vlozit("soubory", [{ zakazka_id: zak.id, vozidlo_id: zak.z.vozidlo_id || zak.z.vozidla?.id, druh: "archiv", klic, nazev: f.name, velikost: f.size, mime, verejne: archivProZakaznika(f.name) }]);
          (zak.z.soubory ||= []).push(rad || { druh: "archiv", klic, nazev: f.name, mime }); ok++;
        } catch (er) { hlaska(`${f.name}: ${chybaText(er)}`, true); }
      }
      if (E === zak) { vykresliArchiv(); if (ok) hlaska(`Přidáno ${ok} ${ok === 1 ? "dokument" : ok < 5 ? "dokumenty" : "dokumentů"}.`); }
    };
  }
  async function nahratFotkyKZakazce(soubory) {
    const sf = document.getElementById("sekce-fotky-detail"); if (sf && !sf.open) sf.open = true;   // ať je vidět průběh nahrávání
    const zak = E, faze = E.fazeFotek || "prubeh", box = document.getElementById("nahravani-detail");
    const radky = soubory.map(s => ({ s, stav: "čeká", video: jeVideo(s) }));
    const kresli = () => { if (box && box.isConnected) box.innerHTML = `<div class="info">${radky.map(r => `${esc(r.s.name || (r.video ? "video" : "fotka"))}: <b>${r.stav}</b>`).join("<br>")}</div>`; };
    kresli();
    let ok = 0;
    for (const r of radky) {
      try {
        if (r.video && r.s.size > MAX_VIDEO_MB * 1024 * 1024) { r.stav = `moc velké (nejvýš ${MAX_VIDEO_MB} MB)`; kresli(); continue; }
        const mime = r.video ? (r.s.type || "video/quicktime") : "image/jpeg";
        const blob = r.video ? r.s : (await zmensi(r.s)).blob;
        const d = new Date(), id = uuid();
        const klic = `${r.video ? "videa" : "fotky"}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${id}.${PRIPONA[mime] || "bin"}`;
        await db.nahrat(klic, blob, mime, x => { r.stav = `nahrávám ${Math.round(x * 100)} %`; kresli(); });
        const [rad] = await db.vlozit("soubory", [{ zakazka_id: zak.id, vozidlo_id: zak.z.vozidlo_id || zak.z.vozidla?.id, druh: r.video ? "video" : "foto", faze, klic, nazev: r.s.name || null, mime }]);
        (zak.z.soubory ||= []).push(rad || { id, druh: r.video ? "video" : "foto", faze, klic });
        r.stav = "✓ nahráno"; ok++; kresli();
      } catch (e) { r.stav = "chyba – " + chybaText(e); kresli(); }
    }
    if (E === zak) { await vykresliFotkyDetail(); if (ok) hlaska(`Nahráno ${ok} ${ok === 1 ? "soubor" : ok < 5 ? "soubory" : "souborů"}.`); }
  }

  /* ---------- práce bez signálu: neodeslané změny se drží v zařízení a odešlou se samy ---------- */
  const FRONTA = "werk-fronta";
  const jeVypadek = e => !navigator.onLine || [408, 429, 500, 502, 503, 504].includes(Number(e?.status || e?.code))
    || /failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout|ERR_INTERNET|ERR_NETWORK|unexpected token|JSON|JWT|refresh token|Nepřihlášený|5\d\d|Bad Gateway|Service Unavailable/i.test(chybaText(e));
  const fronta = () => nacti(FRONTA) || [];
  let odesilamFrontu = false, casovacFronty = null;
  function doFronty(x) {                                   // x = {klic, druh: "upravit"|"prace"|"dily", ...}; novější změna téže věci nahradí starší
    uloz(FRONTA, fronta().filter(y => y.klic !== x.klic).concat({ ...x, uid: uzivatel?.id || null, cas: Date.now() }));
    ukazFrontu(); clearTimeout(casovacFronty); casovacFronty = setTimeout(() => odeslatFrontu(), navigator.onLine ? 3000 : 20000);
  }
  function ukazFrontu() {
    const el = document.getElementById("fronta-odznak"); if (!el) return;
    const n = fronta().length;
    el.hidden = !n && navigator.onLine;
    el.className = "fronta-odznak" + (n ? " ceka" : " offline");
    el.textContent = n ? `⏳ ${n} čeká na odeslání` : "📵 Bez signálu";
    el.title = n ? "Změny uložené v tomto zařízení – odešlou se samy, až bude signál. Klepnutím zkusit hned." : "Bez připojení k internetu";
  }
  async function provedZFronty(x) {
    if (x.druh === "upravit") {                        // 0 upravených řádků = bez oprávnění / ještě neověřeno → zkusit později
      const r = await db.upravit(x.tabulka, x.id, x.zmeny);
      if (Array.isArray(r) && !r.length) throw Object.assign(new Error("Failed to fetch (0 řádků)"), { opakovat: true });
      return r;
    }
    if (x.druh === "prace") return db.ulozitPolozky(x.zid, x.data);
    if (x.druh === "dily") return db.ulozitDily(x.zid, x.data);
  }
  async function odeslatFrontu(rucne = false) {
    if (odesilamFrontu || !fronta().length || !uzivatel) return ukazFrontu();   // až po přihlášení a ověření kódem
    odesilamFrontu = true; let ok = 0;
    try {
      for (const x of fronta()) {
        if (x.uid && x.uid !== uzivatel.id) continue;    // změny jiného člověka na tomto zařízení počkají na něj
        try { await provedZFronty(x); ok++; }
        catch (e) {
          if (jeVypadek(e)) break;                         // pořád bez signálu – zkusit později
          hlaska(`Změnu se nepodařilo uložit ani dodatečně: ${chybaText(e)}`, true, 9000);   // server ji odmítl – nedržet donekonečna
        }
        uloz(FRONTA, fronta().filter(y => !(y.klic === x.klic && y.cas === x.cas)));
      }
    } finally { odesilamFrontu = false; }
    ukazFrontu();
    if (ok && !fronta().length) { hlaska("✓ Změny z doby bez signálu jsou odeslané."); document.querySelectorAll("[data-ceka-fronta]").forEach(e => { e.textContent = "✓ Uloženo"; delete e.dataset.cekaFronta; }); }
    else if (rucne && fronta().length && navigator.onLine) hlaska("Zatím se nepodařilo odeslat – zkusím to znovu za chvíli.", true);
    if (fronta().length) { clearTimeout(casovacFronty); casovacFronty = setTimeout(() => odeslatFrontu(), 30000); }
  }
  window.addEventListener("online", () => { ukazFrontu(); odeslatFrontu(); });
  window.addEventListener("offline", ukazFrontu);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") odeslatFrontu(); });
  // uložit změnu řádku; bez signálu ji podržet ve frontě (vrací "fronta"), jiné chyby vyhodit
  async function ulozitZmenu(tabulka, id, zmeny, stavEl) {
    if (fronta().some(x => x.klic === `upravit:${tabulka}:${id}:${Object.keys(zmeny).join(",")}`)) { doFronty({ klic: `upravit:${tabulka}:${id}:${Object.keys(zmeny).join(",")}`, druh: "upravit", tabulka, id, zmeny }); }
    else try { await db.upravit(tabulka, id, zmeny); if (stavEl) stavEl.textContent = "✓ Uloženo"; return "ok"; }
    catch (e) { if (!jeVypadek(e)) throw e; doFronty({ klic: `upravit:${tabulka}:${id}:${Object.keys(zmeny).join(",")}`, druh: "upravit", tabulka, id, zmeny }); }
    if (stavEl) { stavEl.textContent = "⏳ Bez signálu – odešle se samo"; stavEl.dataset.cekaFronta = "1"; }
    return "fronta";
  }
  // po otevření zakázky použít neodeslané změny z fronty (ať se nepřepíšou starší verzí ze serveru)
  function zFronty(zid, z, E2) {
    for (const x of fronta()) {
      if (x.druh === "upravit" && x.id === zid && x.tabulka === "zakazky") Object.assign(z, x.zmeny);
      if (x.druh === "upravit" && x.tabulka === "vozidla" && z.vozidla && x.id === z.vozidla.id) Object.assign(z.vozidla, x.zmeny);
      if (x.druh === "prace" && x.zid === zid) E2.polozky = x.data.map(p => ({ ...p }));
      if (x.druh === "dily" && x.zid === zid) E2.dily = x.data.map(d => ({ ...d }));
    }
  }

  /* ---------- automatické ukládání prací a dílů ---------- */
  // naplánované (čekají 0,7 s), právě běžící a neúspěšné uložení – nic z toho se nesmí ztratit bez varování
  const cekajiciUlozeni = {}, beziciUlozeni = {}, neulozene = {};
  async function dokoncitUkladani() {
    const fns = Object.values(cekajiciUlozeni).map(x => x.fn).concat(Object.values(neulozene));
    for (const k in cekajiciUlozeni) { clearTimeout(cekajiciUlozeni[k].t); delete cekajiciUlozeni[k]; }
    for (const k in neulozene) delete neulozene[k];
    const v = await Promise.all([...fns.map(fn => fn()), ...Object.values(beziciUlozeni)]);
    return v.every(x => x !== false);
  }
  function ulozitPozdeji(co, ihned) {
    const el = document.getElementById(co === "prace" ? "stav-prace" : "stav-dilu");
    if (el) el.textContent = "Ukládám…";
    const zakazka = E;                                   // uložit vždy k té zakázce, kde se psalo
    if (cekajiciUlozeni[co]) clearTimeout(cekajiciUlozeni[co].t);
    delete neulozene[co];
    const uloz = async () => {
      const E = zakazka, zid = E.id;
      const data = co === "prace" ? E.polozky.map(p => ({ typ: p.typ, popis: p.popis || "", mnozstvi: p.mnozstvi ?? null, jednotka: p.jednotka || null, sazba: p.sazba ?? null, castka: p.castka ?? null }))
        : E.dily.map(d => ({ id: d.id, nazev: d.nazev, cislo_mb: d.cislo_mb, vyrobce: d.vyrobce, dodavatel_id: d.dodavatel_id || null,
          mnozstvi: d.mnozstvi, jednotka: d.jednotka || "ks", nakupni_cena: d.nakupni_cena ?? null, mena: d.mena || "CZK", kurz: d.kurz ?? 1,
          marze_pct: d.marze_pct ?? 30, prodejni_cena: d.prodejni_cena ?? null, stav: d.stav || "potreba", puvod: d.puvod || null, poznamka: d.poznamka || null }));
      const klic = `${co}:${zid}`;
      try {
        if (fronta().some(x => x.klic === klic)) throw Object.assign(new Error("Failed to fetch"), { fronta: true });   // starší změna ještě neodešla → pořadí zachovat
        if (co === "prace") await db.ulozitPolozky(zid, data); else await db.ulozitDily(zid, data);
        if (el && el.isConnected) el.textContent = "✓ Uloženo";
        return true;
      } catch (e) {
        if (jeVypadek(e)) {                              // bez signálu: podržet v zařízení, odešle se samo
          doFronty({ klic, druh: co, zid, data });
          if (el && el.isConnected) { el.textContent = "⏳ Bez signálu – odešle se samo"; el.dataset.cekaFronta = "1"; }
          return true;
        }
        neulozene[co] = fn;                              // zkusí se znovu při dalším pokusu o odchod
        if (el && el.isConnected) { el.innerHTML = `<span style="color:var(--cervena)">Neuloženo – ${esc(chybaText(e))}</span> <button type="button" class="tl tl-male">Zkusit znovu</button>`;
          el.querySelector("button").onclick = () => { delete neulozene[co]; fn(); }; }
        return false;
      }
    };
    // ukládání téže věci jde vždy jedno po druhém (starší nesmí přepsat novější)
    const fn = () => {
      delete cekajiciUlozeni[co];
      const p = (beziciUlozeni[co] || Promise.resolve()).then(uloz);
      beziciUlozeni[co] = p; p.finally(() => { if (beziciUlozeni[co] === p) delete beziciUlozeni[co]; });
      return p;
    };
    if (ihned) return fn();
    cekajiciUlozeni[co] = { fn, t: setTimeout(fn, 700) };
  }
  window.addEventListener("beforeunload", e => { if (Object.keys(cekajiciUlozeni).length + Object.keys(beziciUlozeni).length + Object.keys(neulozene).length) { e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") dokoncitUkladani(); });   // iPad: přepnutí aplikace

  // daň: navýšení ceny práce o daň, kterou pak odvedu (výchozí 30 %, u zakázky jde změnit)
  // celková marže na dílech (prodej − nákup × kurz), jen díly s nákupní cenou – pro můj přehled
  function marzeDilu(dily) {
    let nakup = 0, prodej = 0, bezNakupu = 0;
    for (const d of dily) {
      if (d.stav === "nepouzito") continue;
      if (d.nakupni_cena == null || d.prodejni_cena == null) { if (d.prodejni_cena != null) bezNakupu++; continue; }
      const mn = Number(d.mnozstvi) || 0;
      nakup += Number(d.nakupni_cena) * (Number(d.kurz) || 1) * mn; prodej += Number(d.prodejni_cena) * mn;
    }
    return { nakup: zaokrouhli(nakup), marze: zaokrouhli(prodej - nakup), bezNakupu };
  }
  const DAN_VYCHOZI = 50;
  const sazbaDane = z => z?.dan_pct == null || isNaN(Number(z.dan_pct)) ? DAN_VYCHOZI : Number(z.dan_pct);
  const danZakazky = z => z?.dan_zapnuto === false ? 0 : sazbaDane(z);       // políčko „Daň“ u zakázky (výchozí zapnuto)
  // daň se rozpustí do ceny práce a do marže dílů (nákupní cena dílu zůstane) – na nabídce a faktuře žádný řádek „daň“
  function sDani(z, polozky, dily) {
    const k = 1 + danZakazky(z) / 100;
    if (k === 1) return [polozky.map(p => ({ ...p })), dily.map(d => ({ ...d }))];
    const P2 = polozky.map(p => (p.typ || "prace") === "prace" && p.sazba != null ? { ...p, sazba: zaokrouhli(Number(p.sazba) * k) }
      : p.typ === "pausal" && p.castka != null ? { ...p, castka: zaokrouhli(Number(p.castka) * k) } : { ...p });
    const D2 = dily.map(d => {
      if (d.nakupni_cena == null || d.prodejni_cena == null) return { ...d };
      const nakup = Number(d.nakupni_cena) * (Number(d.kurz) || 1), prodej = Number(d.prodejni_cena), marze = Math.max(0, prodej - nakup);
      return { ...d, prodejni_cena: zaokrouhli(prodej + marze * (k - 1)) };   // jen marže se navýší; sleva / díl zdarma zůstane
    });
    return [P2, D2];
  }
  function vykresliSouhrnZakazky() {
    const sdh = document.getElementById("souhrn-dilu");
    if (sdh && E) { const n = E.dily.filter(d => d.stav !== "nepouzito").length; sdh.textContent = E.dily.length ? `· ${n} ${n === 1 ? "díl" : n > 1 && n < 5 ? "díly" : "dílů"} · ${kc(soucty([], E.dily).material)}` : ""; }
    const el = document.getElementById("souhrn"); if (!el || !E) return;
    const s = soucty(E.polozky, E.dily), pct = sazbaDane(E.z), zap = E.z.dan_zapnuto !== false;
    const sD = p => soucty(...sDani({ dan_pct: p }, E.polozky, E.dily)).celkem, danP = p => sD(p) - s.celkem;
    const dan = danP(pct), celkem = s.celkem + (zap ? dan : 0);
    const bezNakupu = E.dily.filter(d => d.stav !== "nepouzito" && d.prodejni_cena != null && d.nakupni_cena == null).length;
    const nakupDilu = marzeDilu(E.dily).nakup, zisk = d => s.celkem + (zap ? d : 0) - nakupDilu - d;   // co zbyde: cena − nákup dílů − daň
    el.innerHTML = `<summary><h2>Cena <span class="mutted" id="souhrn-cena-h" style="font-weight:400;font-size:15px">· ${kc(celkem)}</span></h2></summary><div class="souhrn-radky">
      <div><span>Práce${s.hodin ? ` (${mnozstviCz(s.hodin)} h)` : ""}</span><b>${kc(s.prace)}</b></div>
      <div><span>Materiál (díly)</span><b>${kc(s.material)}</b></div>
      ${(() => { const m = marzeDilu(E.dily); return m.nakup && jeMajitel() ? `<div class="mutted" style="font-size:14px"><span>z toho marže ${mnozstviCz(Math.round(m.marze / m.nakup * 1000) / 10)} %${m.bezNakupu ? " (bez dílů bez nákupní ceny)" : ""}</span><b>${kc(m.marze)}</b></div>` : ""; })()}
      <div class="${zap ? "" : "dan-vypnuta"}" id="radek-dane"><span class="dan-pole"><label class="dan-zap"><input type="checkbox" id="dan-zap" ${zap ? "checked" : ""}> Daň</label> <input class="vstup cislo" id="dan-pct" value="${mnozstviCz(pct)}" inputmode="decimal" aria-label="Daň v procentech z práce a marže" title="Navýšení práce a marže dílů o daň (výchozí 50 %)"> % z práce a marže</span><b id="dan-kc">${zap ? "" : "("}${kc(dan)}${zap ? "" : ")"}</b></div>
      <div class="celkem"><span>Celkem${zap ? "" : " bez daně"}</span><b id="souhrn-celkem">${kc(celkem)}</b></div>
      ${zap ? "" : `<div class="mutted" id="s-dani"><span>S daní by to bylo</span><b>${kc(s.celkem + dan)}</b></div>`}
      ${jeMajitel() ? `<div class="zisk" title="Celková cena − nákupní cena všech dílů − daň"><span>Zisk <small class="mutted">(cca, po odečtení nákupu dílů a daně)</small></span><b id="souhrn-zisk">${kc(zisk(dan))}</b></div>` : ""}</div>
      <p class="napoveda" style="margin:6px 0 0;text-align:right">${zap ? "Na nabídce a faktuře je daň rozpuštěná do ceny práce a dílů (bez řádku „daň“)." : "Daň je vypnutá – nabídka a faktura budou bez ní."}${bezNakupu ? ` ${bezNakupu} ${bezNakupu === 1 ? "díl nemá" : "díly nemají"} nákupní cenu – ${bezNakupu === 1 ? "jeho" : "jejich"} marži neznám, daň se k ${bezNakupu === 1 ? "němu" : "nim"} nepřičte.` : ""} <span id="stav-dane"></span></p>
      ${E.z.odhad_ceny != null ? `<p class="napoveda" style="margin:8px 0 0">Odhad při příjmu: ${kc(E.z.odhad_ceny)}${E.z.odhad_ceny && celkem > E.z.odhad_ceny * 1.15 ? ` – <b style="color:var(--oranzova)">o víc než 15 % vyšší, podle podmínek je potřeba to se zákazníkem probrat</b>` : ""}</p>` : ""}`;
    const inp = el.querySelector("#dan-pct"), zid = E.z.id;
    el.querySelector("#dan-zap").onchange = async e => {
      E.z.dan_zapnuto = e.target.checked; vykresliSouhrnZakazky();
      const st = document.getElementById("stav-dane");
      try { await ulozitZmenu("zakazky", zid, { dan_zapnuto: E.z.dan_zapnuto }, st); } catch (er) { if (st) st.innerHTML = `<span style="color:var(--cervena)">Neuloženo – ${esc(chybaText(er))}</span>`; }
    };
    inp.addEventListener("input", () => {
      const n = cisloZ(inp.value), ok = n != null && !isNaN(n) && n >= 0 && n <= 100;
      inp.classList.toggle("neplatne", !ok); if (!ok) return;
      E.z.dan_pct = n; const d = danP(n);
      el.querySelector("#dan-kc").textContent = zap ? kc(d) : `(${kc(d)})`; el.querySelector("#souhrn-celkem").textContent = kc(s.celkem + (zap ? d : 0));
      el.querySelector("#souhrn-cena-h").textContent = "· " + kc(s.celkem + (zap ? d : 0));
      const zi = el.querySelector("#souhrn-zisk"); if (zi) zi.textContent = kc(zisk(d));
      const sd = el.querySelector("#s-dani b"); if (sd) sd.textContent = kc(s.celkem + d);
      clearTimeout(inp._u); inp._u = setTimeout(async () => {
        const st = el.querySelector("#stav-dane");
        try { await ulozitZmenu("zakazky", zid, { dan_pct: n }, st); } catch (e) { st.innerHTML = `<span style="color:var(--cervena)">Neuloženo – ${esc(chybaText(e))}</span>`; }
      }, 700);
    });
  }
  const mnozstviCz = n => Number(n).toLocaleString("cs-CZ", { maximumFractionDigits: 2 });

  /* ---------- práce ---------- */
  function vykresliPrace() {
    const el = document.getElementById("prace"); if (!el) return;
    const P2 = E.polozky;
    el.innerHTML = `
      <div class="tabulka-polozek">
        ${P2.length ? `<div class="radek-pol hlavicka-pol"><span>Popis</span><span>Mn.</span><span>Mj</span><span>Kč/Mj</span><span>Celkem</span><span></span></div>` : ""}
        ${P2.map((p, i) => `
        <div class="radek-pol typ-${p.typ}" data-i="${i}">
          ${p.typ === "prazdny" ? `<span class="mutted prazdny-radek">— prázdný řádek —</span>` :
            `<input class="vstup" data-f="popis" value="${esc(p.popis)}" placeholder="${p.typ === "nadpis" ? "Nadpis, např. Dodatečné práce dle další domluvy" : p.typ === "pausal" ? "Paušál, např. Likvidace kapalin" : "Popis práce"}">`}
          ${p.typ === "prace" ? `
            <input class="vstup cislo" data-f="mnozstvi" value="${p.mnozstvi ?? ""}" inputmode="decimal" placeholder="0">
            <select class="vstup" data-f="jednotka"><option value="h" ${p.jednotka === "h" ? "selected" : ""}>h</option><option value="ks" ${p.jednotka === "ks" ? "selected" : ""}>ks</option></select>
            <input class="vstup cislo" data-f="sazba" value="${p.sazba ?? ""}" inputmode="numeric" placeholder="1500">
            <span class="celkem-pol">${kc(cenaPrace(p))}</span>`
          : p.typ === "pausal" ? `<span></span><span></span><span class="mutted" style="font-size:13px">paušál</span>
            <input class="vstup cislo" data-f="castka" value="${p.castka ?? ""}" inputmode="numeric" placeholder="Kč">` : `<span></span><span></span><span></span><span></span>`}
          <span class="akce-pol">
            <button type="button" class="tl tl-male" data-nahoru="${i}" aria-label="Posunout nahoru" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="tl tl-male" data-smaz="${i}" aria-label="Smazat">×</button></span>
        </div>`).join("")}
      </div>
      ${P2.length > MAX_POLOZEK ? `<div class="info pozor">Na nabídku a fakturu se vejde ${MAX_POLOZEK} řádků – máte ${P2.length}. Sloučte prosím některé práce.</div>` : ""}
      <div class="cipy" style="margin-top:12px">
        <button type="button" class="cip" data-pridat-pol="inspekce">＋ Inspekce (1 200 Kč/h)</button>
        <button type="button" class="cip" data-pridat-pol="prace">＋ Práce (1 500 Kč/h)</button>
        <button type="button" class="cip" data-pridat-pol="kus">＋ Položka v ks</button>
        <button type="button" class="cip" data-pridat-pol="pausal">＋ Paušál</button>
        <button type="button" class="cip" data-pridat-pol="nadpis">＋ Nadpis</button>
        <button type="button" class="cip" data-pridat-pol="prazdny">＋ Prázdný řádek</button>
      </div>
      ${E.z.zavady?.length ? `<div class="cipy"><span class="napoveda" style="align-self:center">Ze zakázkového listu:</span>${E.z.zavady.map((t, i) => `<button type="button" class="cip" data-ze-zavady="${i}">＋ ${esc(t)}</button>`).join("")}</div>` : ""}`;
    el.querySelectorAll(".radek-pol[data-i]").forEach(r => {
      const p = E.polozky[+r.dataset.i];
      r.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener("input", () => {
        const f = inp.dataset.f;
        if (["mnozstvi", "sazba", "castka"].includes(f)) { const v = ciselnyVstup(inp, f === "castka" ? {} : { min: 0, max: f === "mnozstvi" ? 10000 : 1000000 }); if (v === undefined) return; p[f] = v; } else p[f] = inp.value;
        const c = r.querySelector(".celkem-pol"); if (c) c.textContent = kc(cenaPrace(p));
        vykresliSouhrnZakazky(); ulozitPozdeji("prace");
      }));
    });
    el.querySelectorAll("[data-smaz]").forEach(b => b.onclick = () => {
      const p = E.polozky[+b.dataset.smaz];
      if (p && (p.popis || p.castka || p.mnozstvi) && !confirm(`Opravdu smazat řádek „${p.popis || (p.typ === "pausal" ? "paušál" : "práce")}“?`)) return;
      E.polozky.splice(+b.dataset.smaz, 1); vykresliPrace(); vykresliSouhrnZakazky(); ulozitPozdeji("prace"); });
    el.querySelectorAll("[data-nahoru]").forEach(b => b.onclick = () => { const i = +b.dataset.nahoru; [E.polozky[i - 1], E.polozky[i]] = [E.polozky[i], E.polozky[i - 1]]; vykresliPrace(); ulozitPozdeji("prace"); });
    const nova = { inspekce: { typ: "prace", popis: "Inspekce", mnozstvi: 1, jednotka: "h", sazba: 1200 }, prace: { typ: "prace", popis: "", mnozstvi: 1, jednotka: "h", sazba: 1500 },
      kus: { typ: "prace", popis: "", mnozstvi: 1, jednotka: "ks", sazba: null }, pausal: { typ: "pausal", popis: "", castka: null }, nadpis: { typ: "nadpis", popis: "" }, prazdny: { typ: "prazdny" } };
    el.querySelectorAll("[data-pridat-pol]").forEach(b => b.onclick = () => {
      E.polozky.push({ ...nova[b.dataset.pridatPol] }); vykresliPrace(); vykresliSouhrnZakazky(); ulozitPozdeji("prace");
      const rows = el.querySelectorAll(".radek-pol[data-i] input[data-f=popis]"); const last = rows[rows.length - 1]; if (last && !last.value) last.focus();
    });
    el.querySelectorAll("[data-ze-zavady]").forEach(b => b.onclick = () => {
      E.polozky.push({ typ: "prace", popis: E.z.zavady[+b.dataset.zeZavady], mnozstvi: 1, jednotka: "h", sazba: 1500 }); vykresliPrace(); vykresliSouhrnZakazky(); ulozitPozdeji("prace");
    });
  }

  /* ---------- díly ---------- */
  function vykresliDily() {
    const el = document.getElementById("dily"); if (!el) return;
    const dod = E.dodavatele;
    // „master“ marže: výchozí je ta, kterou má většina dílů (jinak 30 %)
    if (E.marze == null) {
      const pocty = {}; for (const d of E.dily) { const m = Number(d.marze_pct ?? 30); pocty[m] = (pocty[m] || 0) + 1; }
      E.marze = Number(Object.entries(pocty).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 30);
    }
    el.innerHTML = `
      ${E.dily.length && jeMajitel() ? `<details class="marze-sbal" id="marze-sbal" ${E.marzeOtevrena ? "open" : ""}>
        <summary><span class="sipka" aria-hidden="true">▸</span> Marže <span class="mutted">(${mnozstviCz(E.marze)} %)</span></summary>
        <div class="marze-vse">
        <label>Marže pro všechny díly<span class="marze-pole"><input class="vstup cislo" id="marze-vse" value="${E.marze}" inputmode="decimal" aria-label="Marže v procentech"> %</span></label>
        <button type="button" class="tl tl-hlavni tl-male" id="marze-pouzit">Použít na všechny díly</button>
        <span class="napoveda">Přepočítá prodejní cenu všech dílů s nákupní cenou. U jednotlivých dílů jde marže dál změnit zvlášť.</span>
      </div></details>` : ""}
      ${E.dily.map((d, i) => `
      <div class="dil" data-i="${i}">
        <div class="dil-r1">
          <input class="vstup" data-f="nazev" value="${esc(d.nazev || "")}" placeholder="Název dílu">
          <input class="vstup" data-f="cislo_mb" value="${esc(d.cislo_mb || "")}" placeholder="Číslo dílu (A 126 …)" autocapitalize="characters" spellcheck="false">
          <select class="vstup" data-f="dodavatel_id"><option value="">Dodavatel…</option>${dod.map(x => `<option value="${x.id}" ${x.id === d.dodavatel_id ? "selected" : ""}>${esc(x.nazev)}</option>`).join("")}</select>
          <select class="vstup" data-f="stav">${STAVY_DILU.map(([k, t]) => `<option value="${k}" ${k === (d.stav || "potreba") ? "selected" : ""}>${t}</option>`).join("")}</select>
          <button type="button" class="tl tl-male" data-smaz-dil="${i}" aria-label="Smazat díl">×</button>
        </div>
        <div class="dil-r2">
          <label>Ks<input class="vstup cislo" data-f="mnozstvi" value="${d.mnozstvi ?? 1}" inputmode="decimal"></label>
          <label>Nákup / ks<input class="vstup cislo" data-f="nakupni_cena" value="${d.nakupni_cena ?? ""}" inputmode="decimal" placeholder="0"></label>
          <label>Měna<select class="vstup" data-f="mena"><option ${d.mena !== "EUR" ? "selected" : ""}>CZK</option><option ${d.mena === "EUR" ? "selected" : ""}>EUR</option></select></label>
          ${d.mena === "EUR" ? `<label title="${kurzCnb ? `ČNB ${esc(kurzCnb.datum)}: ${String(kurzEur()).replace(".", ",")} Kč/€` : "Kurz Kč za 1 €"}">Kurz Kč/€<input class="vstup cislo" data-f="kurz" value="${String(d.kurz ?? kurzEur()).replace(".", ",")}" inputmode="decimal"></label>` : ""}
          ${jeMajitel() ? `<label>Marže %<input class="vstup cislo" data-f="marze_pct" value="${d.marze_pct ?? 30}" inputmode="decimal"></label>` : ""}
          <label>Prodej / ks (Kč)<input class="vstup cislo" data-f="prodejni_cena" value="${d.prodejni_cena ?? ""}" inputmode="numeric"></label>
          <label>Původ<select class="vstup" data-f="puvod"><option value="" ${!d.puvod ? "selected" : ""}>—</option><option value="original" ${d.puvod === "original" ? "selected" : ""}>MB (original)</option><option value="aftermarket" ${d.puvod === "aftermarket" ? "selected" : ""}>Aftermarket</option></select></label>
          <label class="siroke">Poznámka (Remarks v parts listu)<input class="vstup" data-f="poznamka" value="${esc(d.poznamka || "")}" placeholder="např. Original MB, + o-rings"></label>
          <span class="celkem-dil ${d.stav === "nepouzito" ? "mutted" : ""}">${d.stav === "nepouzito" ? "nepoužito" : kc(cenaDilu(d))}</span>
        </div>
      </div>`).join("")}
      <div class="radek-tlacitek" style="margin-top:12px">
        <button type="button" class="tl" id="pridat-dil">＋ Přidat díl</button>
        <button type="button" class="tl" id="import-dilu" aria-expanded="${!!E.imp}">📥 Import z e-mailu</button>
        ${E.dily.length ? `<button type="button" class="tl" id="parts-list">📄 Parts list (PDF)</button>
          <label class="cip zaskrt"><input type="checkbox" id="parts-ceny" checked> s cenami</label>
          <button type="button" class="tl tl-smazat" id="smazat-dily" style="margin-left:auto">🗑 Smazat všechny díly</button>` : ""}
        <span class="napoveda">Prodejní cena = nákup × kurz + marže. Jde přepsat ručně.</span>
      </div>
      ${E.imp ? panelImportu() : ""}`;
    el.querySelectorAll(".dil[data-i]").forEach(r => {
      const d = E.dily[+r.dataset.i];
      r.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", () => {
        const f = inp.dataset.f;
        if (["mnozstvi", "nakupni_cena", "kurz", "marze_pct", "prodejni_cena"].includes(f)) {
          const v = ciselnyVstup(inp, { mnozstvi: { min: 0, max: 10000 }, nakupni_cena: { min: 0, max: 10000000 }, kurz: { min: 0.01, max: 1000 }, marze_pct: { min: 0, max: 1000 }, prodejni_cena: { min: 0, max: 10000000 } }[f]);
          if (v === undefined) return; d[f] = v;
        } else d[f] = inp.value;
        if (f === "mena") { d.kurz = d.mena === "EUR" ? (d.kurz && d.kurz !== 1 ? d.kurz : kurzEur()) : 1; }
        if (f === "dodavatel_id" && d.dodavatel_id) d.puvod = puvodPodleDodavatele(d.dodavatel_id);   // MB (original) → original, ostatní → aftermarket
        if (["nakupni_cena", "kurz", "marze_pct", "mena"].includes(f)) {          // přepočítat prodejní cenu
          d.prodejni_cena = d.nakupni_cena == null ? null : prodejDilu(d);
          const pc = r.querySelector('[data-f="prodejni_cena"]'); if (pc) pc.value = d.prodejni_cena ?? "";
        }
        if (f === "mena" || f === "stav" || f === "dodavatel_id") { vykresliDily(); }
        else { const c = r.querySelector(".celkem-dil"); if (c) c.textContent = d.stav === "nepouzito" ? "nepoužito" : kc(cenaDilu(d)); }
        vykresliSouhrnZakazky(); ulozitPozdeji("dily");
      }));
    });
    el.querySelectorAll("[data-smaz-dil]").forEach(b => b.onclick = () => {
      const d = E.dily[+b.dataset.smazDil];
      if (!confirm(`Opravdu smazat díl „${d.nazev || "bez názvu"}“?`)) return;
      E.dily.splice(+b.dataset.smazDil, 1); vykresliDily(); vykresliSouhrnZakazky(); ulozitPozdeji("dily");
    });
    const plb = el.querySelector("#parts-list");
    if (plb) plb.onclick = async () => {
      const okno = window.open("", "_blank");
      try {
        await dokoncitUkladani();
        const b = await pdfZeSablony("parts-list.html", dataPartsListu(E.z, sDani(E.z, [], E.dily)[1], el.querySelector("#parts-ceny").checked), "cs", { nazev: `Parts list ${E.z.cislo}` });
        const u = URL.createObjectURL(new Blob([b], { type: "application/pdf" }));
        if (okno) okno.location = u; else window.open(u, "_blank");
      } catch (e) { okno?.close(); hlaska("Parts list se nepodařil: " + chybaText(e), true); }
    };
    const ms = el.querySelector("#marze-sbal");
    if (ms) ms.addEventListener("toggle", () => { E.marzeOtevrena = ms.open; if (ms.open) el.querySelector("#marze-vse")?.focus(); });
    const mv = el.querySelector("#marze-vse");
    if (mv) {
      const pouzit = () => {
        const m = cisloZ(mv.value);
        if (m == null || !Number.isFinite(m) || m < 0 || m > 1000) { mv.classList.add("chybi"); return hlaska("Zadejte marži v procentech, např. 30.", true); }
        mv.classList.remove("chybi");
        E.marze = m;
        for (const d of E.dily) { d.marze_pct = m; if (d.nakupni_cena != null) d.prodejni_cena = prodejDilu(d); }
        vykresliDily(); vykresliSouhrnZakazky(); ulozitPozdeji("dily");
        hlaska(`Marže ${mnozstviCz(m)} % nastavena u všech dílů (${E.dily.length}).`);
      };
      el.querySelector("#marze-pouzit").onclick = pouzit;
      mv.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); pouzit(); } });
    }
    const sd = el.querySelector("#smazat-dily");
    if (sd) sd.onclick = () => {
      const n = E.dily.length;
      if (!confirm(`Opravdu smazat všechny díly této zakázky (${n} ${n === 1 ? "díl" : n < 5 ? "díly" : "dílů"})?\n\nUž vystavené nabídky a faktury zůstanou beze změny.`)) return;
      E.dily = []; vykresliDily(); vykresliSouhrnZakazky(); ulozitPozdeji("dily");
      hlaska(`Smazáno ${n} ${n === 1 ? "díl" : n < 5 ? "díly" : "dílů"}.`);
    };
    el.querySelector("#import-dilu").onclick = () => { E.imp = E.imp ? null : { text: "", vysledek: null }; vykresliDily(); if (E.imp) el.querySelector("#imp-text")?.focus(); };
    if (E.imp) obsluhaImportu(el);
    el.querySelector("#pridat-dil").onclick = () => {
      E.dily.push({ id: uuid(), nazev: "", mnozstvi: 1, jednotka: "ks", mena: "CZK", kurz: 1, marze_pct: E.marze ?? 30, stav: "potreba" });
      vykresliDily(); ulozitPozdeji("dily");
      const n = el.querySelectorAll('.dil [data-f="nazev"]'); n[n.length - 1]?.focus();
    };
  }

  /* ---------- import dílů z e-mailu dodavatele (pevný převodník v import-dilu.js) ---------- */
  const jeMbDodavatel = id => /^MB\b|mercedes/i.test(E?.dodavatele.find(x => x.id === id)?.nazev || "");
  const puvodPodleDodavatele = id => !id ? null : jeMbDodavatel(id) ? "original" : "aftermarket";
  function panelImportu() {
    const I = E.imp, v = I.vysledek;
    return `<div class="import-dilu" id="panel-importu">
      <b>Import dílů z e-mailu dodavatele</b>
      <p class="napoveda" style="margin:4px 0 10px">Zkopírujte text e-mailu (Auto Kelly – faktura nebo potvrzení objednávky, Landsmann…) nebo tabulku z Excelu a vložte sem.
        Nejpřesnější je <b>faktura v příloze</b> – PDF od Granexu, CSV nebo PDF od Auto Kelly (tlačítko „📎 Faktura“). Ceny se berou s DPH.</p>
      <textarea class="vstup" id="imp-text" placeholder="Sem vložte text e-mailu…">${esc(I.text)}</textarea>
      <div class="radek-tlacitek" style="margin-top:8px">
        <button type="button" class="tl tl-hlavni" id="imp-rozpoznat">Rozpoznat díly</button>
        <label class="tl" style="cursor:pointer">📎 Faktura (PDF / CSV)<input type="file" id="imp-soubor" accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain" hidden></label>
        <button type="button" class="tl" id="imp-zavrit">Zavřít</button>
      </div>
      ${v ? (v.polozky.length ? `
        <div class="radek-tlacitek" style="margin-top:12px">
          <span class="napoveda">Rozpoznáno: <b>${esc(v.format)}</b> · ${v.polozky.length} ${v.polozky.length === 1 ? "položka" : v.polozky.length < 5 ? "položky" : "položek"}</span>
          <select class="vstup" id="imp-dodavatel" style="max-width:220px"><option value="">Dodavatel…</option>${E.dodavatele.map(x => `<option value="${x.id}" ${x.id === I.dodavatel_id ? "selected" : ""}>${esc(x.nazev)}</option>`).join("")}</select>
          <select class="vstup" id="imp-stav" style="max-width:180px">${STAVY_DILU.map(([k, t]) => `<option value="${k}" ${k === (I.stav || "objednano") ? "selected" : ""}>${t}</option>`).join("")}</select>
        </div>
        ${v.polozky.some(p => p.odhad) ? `<div class="info pozor" style="margin-top:8px">Text nemá známý formát dodavatele – řádky jsou odhad. Zkontrolujte prosím názvy, čísla a ceny.</div>` : ""}
        <table class="import-tabulka"><thead><tr><th></th><th>Název</th><th>Číslo dílu</th><th class="c">Ks</th><th class="c">Nákup / ks</th></tr></thead><tbody>
        ${v.polozky.map((p, i) => `<tr class="${p.odhad ? "odhad" : ""}" data-ip="${i}">
          <td><input type="checkbox" data-if="vybrano" ${p.vybrano !== false ? "checked" : ""} aria-label="Přidat"></td>
          <td><input class="vstup" data-if="nazev" value="${esc(p.nazev)}"></td>
          <td><input class="vstup" data-if="cislo" value="${esc(p.cislo)}" spellcheck="false"></td>
          <td class="c"><input class="vstup cislo" data-if="mnozstvi" value="${p.mnozstvi}" inputmode="decimal" style="width:64px"></td>
          <td class="c"><input class="vstup cislo" data-if="cena" value="${p.cena ?? ""}" inputmode="decimal" style="width:100px"> ${p.mena === "EUR" ? "€" : "Kč"}</td></tr>`).join("")}
        </tbody></table>
        <div class="radek-tlacitek" style="margin-top:10px"><button type="button" class="tl tl-hlavni" id="imp-pridat">＋ Přidat vybrané do zakázky</button></div>`
        : `<div class="info pozor" style="margin-top:10px">V textu jsem nenašel žádné díly. Zkuste zkopírovat celý e-mail (i s tabulkou položek), nebo CSV přílohu faktury.</div>`) : ""}
    </div>`;
  }
  function obsluhaImportu(el) {
    const I = E.imp;
    const t = el.querySelector("#imp-text");
    t.addEventListener("input", () => { I.text = t.value; });
    const rozpoznat = () => {
      const v = window.rozeberDily(I.text);
      I.vysledek = v;
      const najdi = n => E.dodavatele.find(x => x.nazev.toLowerCase() === String(n || "").toLowerCase());
      I.dodavatel_id = (najdi(v.dodavatel) || (v.dodavatel ? najdi("Jiný") : null) || {}).id || I.dodavatel_id || "";
      vykresliDily();
    };
    el.querySelector("#imp-rozpoznat").onclick = rozpoznat;
    el.querySelector("#imp-zavrit").onclick = () => { E.imp = null; vykresliDily(); };
    el.querySelector("#imp-soubor").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const buf = await f.arrayBuffer();
      let text;
      if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
        const h = prekryv("Čtu PDF…");
        try { text = await window.textZPdf(new Uint8Array(buf)); }
        catch (err) { h?.zavri(); return hlaska("PDF se nepodařilo přečíst: " + chybaText(err), true); }
        h?.zavri();
        if (!text.trim()) return hlaska("V PDF není text (asi je to sken) – zkopírujte prosím text e-mailu.", true, 7000);
      } else {
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (err) { text = new TextDecoder("windows-1250").decode(buf); }
      }
      I.text = text; rozpoznat();
    };
    const v = I.vysledek; if (!v || !v.polozky.length) return;
    el.querySelector("#imp-dodavatel").onchange = e => { I.dodavatel_id = e.target.value; };
    el.querySelector("#imp-stav").onchange = e => { I.stav = e.target.value; };
    el.querySelectorAll("tr[data-ip]").forEach(r => {
      const p = v.polozky[+r.dataset.ip];
      r.querySelectorAll("[data-if]").forEach(inp => inp.addEventListener(inp.type === "checkbox" ? "change" : "input", () => {
        const f = inp.dataset.if;
        if (["mnozstvi", "cena"].includes(f)) { const v = ciselnyVstup(inp); if (v === undefined) return; p[f] = v; } else p[f] = f === "vybrano" ? inp.checked : inp.value;
      }));
    });
    el.querySelector("#imp-pridat").onclick = () => {
      const vybrane = v.polozky.filter(p => p.vybrano !== false && (p.nazev || p.cislo));
      if (!vybrane.length) return hlaska("Není vybraný žádný díl.", true);
      const dod = I.dodavatel_id || null;
      for (const p of vybrane) {
        const d = { id: uuid(), nazev: p.nazev || "", cislo_mb: p.cislo || "", mnozstvi: p.mnozstvi || 1, jednotka: "ks", nakupni_cena: p.cena ?? null,
          mena: p.mena === "EUR" ? "EUR" : "CZK", kurz: p.mena === "EUR" ? kurzEur() : 1, marze_pct: E.marze ?? 30, stav: I.stav || "objednano",
          dodavatel_id: dod, puvod: puvodPodleDodavatele(dod) };
        d.prodejni_cena = d.nakupni_cena == null ? null : prodejDilu(d);
        E.dily.push(d);
      }
      E.imp = null;
      vykresliDily(); vykresliSouhrnZakazky(); ulozitPozdeji("dily");
      const sd = document.getElementById("sekce-dily"); if (sd) { sd.open = false; sd.scrollIntoView({ behavior: "smooth", block: "nearest" }); }   // po importu sbalit, ať je stránka přehledná
      hlaska(`Přidáno ${vybrane.length} ${vybrane.length === 1 ? "díl" : vybrane.length < 5 ? "díly" : "dílů"} – sekce Díly je sbalená, klepnutím ji rozbalíte.`);
    };
  }

  /* ================= vystavení nabídky / faktury / protokolu ================= */
  async function vystavit(id, co) {
    const n0 = navId;
    const druh = { nabidka: "nabidka", faktura: "faktura", protokol: "predavaci_protokol", zaloha: "zalohova", opravny: "opravny" }[co];
    if (["faktura", "zalohova", "opravny"].includes(druh) && !jeMajitel()) { app.innerHTML = `<div class="info pozor">Fakturu, zálohovou fakturu a opravný doklad vystavuje majitel.</div><p><a href="#/zakazka/${id}">← Zpět na zakázku</a></p>`; return; }
    app.innerHTML = `<div class="nacitani">Připravuji…</div>`;
    let z, polozky, dily;
    try { [z, polozky, dily] = await Promise.all([db.detail(id), db.polozky(id), db.dily(id)]); }
    catch (e) { app.innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
    if (!z) { app.innerHTML = `<div class="info chyba">Zakázka nenalezena.</div>`; return; }
    if (druh === "nabidka" || druh === "faktura") [polozky, dily] = sDani(z, polozky, dily);   // daň v ceně práce a marže dílů
    const jazyk = z.jazyk || "cs", en = jazyk === "en";
    const verze = (z.doklady || []).filter(d => d.druh === druh).length + 1;
    const cislo = cisloDokladu(z.cislo, druh, verze), vs = vsDokladu(z.cislo, druh, verze);
    const s = soucty(polozky, dily);
    const jeFaktura = druh !== "predavaci_protokol";
    // zálohové faktury této zakázky (u konečné faktury se odečtou)
    // záloha snížená / stornovaná opravným dokladem se odečítá jen zbytkem (nebo vůbec)
    const opravyZaloh = (z.doklady || []).filter(d => d.druh === "opravny" && d.data?.opravuje);
    const ucinnaZaloha = d => Number(d.celkem) + opravyZaloh.filter(o => o.data.opravuje === d.cislo).reduce((a, o) => a + (Number(o.celkem) || 0), 0);
    const zalohy = (z.doklady || []).filter(d => d.druh === "zalohova" && d.celkem && ucinnaZaloha(d) > 0);
    const nabidkaCislo = (z.doklady || []).filter(d => d.druh === "nabidka").map(d => d.cislo).sort().pop();
    // opravný doklad jde jen k vystavené faktuře nebo zálohové faktuře
    const opravitelne = (z.doklady || []).filter(d => ["faktura", "zalohova"].includes(d.druh))
      .sort((a, b) => (a.druh === "faktura" ? 0 : 1) - (b.druh === "faktura" ? 0 : 1) || b.cislo.localeCompare(a.cislo, "cs", { numeric: true }));   // výchozí = poslední faktura
    if (druh === "opravny" && !opravitelne.length) {
      app.innerHTML = `<div class="karta"><h1>Opravný doklad</h1><div class="info pozor">Zakázka nemá žádnou vystavenou fakturu – není co opravovat.</div>
        <div class="radek-tlacitek" style="margin-top:14px"><a class="tl tl-hlavni" href="#/zakazka/${id}">← Zpět na zakázku</a></div></div>`;
      return;
    }
    if (!["zalohova", "opravny"].includes(druh) && jeFaktura && !polozky.some(p => (p.typ || "prace") !== "prazdny") && !s.material) {
      app.innerHTML = `<div class="karta"><h1>${NAZEV_DOKLADU.cs[druh]}</h1><div class="info pozor">Zakázka zatím nemá žádné práce ani díly. Doplňte je v detailu zakázky.</div>
        <div class="radek-tlacitek" style="margin-top:14px"><a class="tl tl-hlavni" href="#/zakazka/${id}">← Zpět na zakázku</a></div></div>`;
      return;
    }
    // výchozí hodnoty formuláře
    const f = druh === "nabidka" ? { vystaveno: dnes(), platnost: plusDni(dnes(), 7) }
      : druh === "faktura" ? { vystaveno: dnes(), splatnost: plusDni(dnes(), 14), odecist: Object.fromEntries(zalohy.map(d => [d.cislo, !!d.zaplaceno])) }   // předvybrat jen zaplacené zálohy
      : druh === "opravny" ? { vystaveno: dnes(), splatnost: plusDni(dnes(), 14), opravuje: opravitelne[0].cislo, duvod: "", radky: [{ popis: "", castka: "" }] }
      : druh === "zalohova" ? { vystaveno: dnes(), splatnost: plusDni(dnes(), 7), castka: s.material || "",
          popis: en ? `Advance payment for parts${nabidkaCislo ? ` according to quotation ${nabidkaCislo}` : ""}` : `Záloha na materiál${nabidkaCislo ? ` dle cenové nabídky ${nabidkaCislo}` : ""}` }
      : { vystaveno: dnes(), prevzeti: dnes(), km: z.km_predani ?? z.km_prijem ?? "", nadrz: z.nadrz_predani || z.nadrz_prijem || "1/2", tp: z.tp_prilozen ?? true,
          foto: false, jizda: true, kola: false, stav: z.stav_predani?.length ? [...z.stav_predani] : [""] };
    const podpisZakPovinny = druh === "predavaci_protokol";
    // faktura / zálohová: zákazník spěchá nebo auto předává někdo jiný → podepíše z domu v E-servisce (Vašek 30.10.2026)
    const lzePozdeji = (druh === "faktura" || druh === "zalohova") && !!z.vozidla?.vin;
    const titulek = `${NAZEV_DOKLADU.cs[druh]} ${cislo}`;

    app.innerHTML = `
      <div class="hlavicka-prehledu"><div><div class="mutted"><a href="#/zakazka/${id}">← Zakázka #${z.cislo}</a></div><h1 style="margin:0">${esc(titulek)}</h1></div></div>
      ${verze > 1 ? `<div class="info" style="margin:0 0 14px">K zakázce už ${druh === "nabidka" ? "nabídka existuje" : druh === "faktura" ? "faktura existuje" : "protokol existuje"} – tahle bude verze ${verze} (${esc(cislo)}). Předchozí zůstává beze změny.</div>` : ""}
      <section class="karta"><h2>Údaje dokladu</h2><div class="mrizka" id="pole-dokladu">
        ${druh === "nabidka" ? `
          <label class="pole s2">Datum vystavení<input type="date" data-d="vystaveno" value="${f.vystaveno}"></label>
          <label class="pole s2">Platnost do<input type="date" data-d="platnost" value="${f.platnost}"></label>
          <div class="pole s2"><span>Celkem</span><div class="velka-castka">${kc(s.celkem)}</div></div>` : ""}
        ${druh === "faktura" ? `
          <label class="pole s2">Datum vystavení<input type="date" data-d="vystaveno" value="${f.vystaveno}"></label>
          <label class="pole s2">Datum splatnosti<input type="date" data-d="splatnost" value="${f.splatnost}"></label>
          <div class="pole s2"><span>Celkem k úhradě · VS ${vs}</span><div class="velka-castka" id="k-uhrade">${kc(s.celkem)}</div></div>
          ${zalohy.length ? `<div class="s6"><label class="pole">Odečíst zálohy</label><div class="cipy" style="margin:0">${zalohy.map(d => `
            <label class="cip zaskrt"><input type="checkbox" data-odecist="${esc(d.cislo)}" ${f.odecist[d.cislo] ? "checked" : ""}> ${esc(d.cislo)} · ${kc(ucinnaZaloha(d))}${ucinnaZaloha(d) !== Number(d.celkem) ? ` (po opravě, původně ${kc(d.celkem)})` : ""}${d.zaplaceno ? " · zaplaceno" : " · <b>nezaplaceno</b>"}</label>`).join("")}</div></div>` : ""}` : ""}
        ${druh === "opravny" ? `
          <label class="pole s3"><span class="povinne">Opravuje doklad</span><select data-d="opravuje">${opravitelne.map(d => `<option value="${esc(d.cislo)}" ${d.cislo === f.opravuje ? "selected" : ""}>${esc(d.cislo)} · ${DRUHY[d.druh]} · ${kc(d.celkem)} · ${datumCz(d.vystaveno)}</option>`).join("")}</select></label>
          <label class="pole s3"><span class="povinne">Důvod opravy</span><input data-d="duvod" value="" placeholder="${en ? "e.g. Discount agreed with the customer" : "např. Sleva dohodnutá se zákazníkem"}"></label>
          <label class="pole s2">Datum vystavení<input type="date" data-d="vystaveno" value="${f.vystaveno}"></label>
          <label class="pole s2">Datum splatnosti<input type="date" data-d="splatnost" value="${f.splatnost}"></label>
          <div class="pole s2"><span>Celkem · VS ${vs}</span><div class="velka-castka" id="k-uhrade">0 Kč</div></div>
          <div class="s6"><label class="pole"><span class="povinne">Položky opravy</span></label>
            <p class="napoveda" style="margin:0 0 8px">Záporná částka = vracíte zákazníkovi (sleva, storno, vrácený díl). Kladná = doúčtování.</p>
            <div id="radky-opravy"></div>
            <div class="cipy"><button type="button" class="cip" id="opr-storno">Stornovat celý doklad</button>
              <button type="button" class="cip" data-opr-cip="${en ? "Discount" : "Sleva z ceny"}">${en ? "Discount" : "Sleva z ceny"}</button>
              <button type="button" class="cip" data-opr-cip="${en ? "Returned part" : "Vrácený nepoužitý díl"}">${en ? "Returned part" : "Vrácený nepoužitý díl"}</button></div></div>` : ""}
        ${druh === "zalohova" ? `
          <label class="pole s4"><span class="povinne">Text položky</span><input data-d="popis" value="${esc(f.popis)}"></label>
          <label class="pole s2"><span class="povinne">Částka zálohy (Kč)</span><input data-d="castka" inputmode="numeric" value="${f.castka}"></label>
          <label class="pole s2">Datum vystavení<input type="date" data-d="vystaveno" value="${f.vystaveno}"></label>
          <label class="pole s2">Datum splatnosti<input type="date" data-d="splatnost" value="${f.splatnost}"></label>
          <div class="pole s2"><span>VS ${vs}</span><div class="napoveda" style="padding-top:12px">Předvyplněno: materiál ze zakázky ${kc(s.material)}</div></div>` : ""}
        ${druh === "predavaci_protokol" ? `
          <label class="pole s2">Datum předání<input type="date" data-d="prevzeti" value="${f.prevzeti}"></label>
          <label class="pole s2"><span>Stav tachometru (${(z.vozidla?.jednotka_tachometru) === "mi" ? "míle" : "km"}) – nepovinné, předvyplněno z příjmu</span><input data-d="km" inputmode="numeric" value="${esc(f.km)}" placeholder="${z.km_prijem ?? ""}"></label>
          <div class="s2"><label class="pole">TP předán</label><div class="segment" data-seg="tp"><button type="button" data-h="true" aria-pressed="${!!f.tp}">Ano</button><button type="button" data-h="false" aria-pressed="${!f.tp}">Ne</button></div></div>
          <div class="s4"><label class="pole">Stav nádrže</label><div class="segment" data-seg="nadrz">${NADRZ.map(n => `<button type="button" data-h='"${n}"' aria-pressed="${f.nadrz === n}">${n}</button>`).join("")}</div></div>
          <div class="s2"><label class="pole">Fotodokumentace při předání</label><div class="segment" data-seg="foto"><button type="button" data-h="true" aria-pressed="${!!f.foto}">Ano</button><button type="button" data-h="false" aria-pressed="${!f.foto}">Ne</button></div></div>
          <div class="s3"><label class="pole">Zákazník absolvoval zkušební jízdu</label><div class="segment" data-seg="jizda"><button type="button" data-h="true" aria-pressed="${!!f.jizda}">Ano</button><button type="button" data-h="false" aria-pressed="${!f.jizda}">Ne</button></div></div>
          <div class="s3"><label class="pole">Kola byla demontována (dotažení kol)</label><div class="segment" data-seg="kola"><button type="button" data-h="true" aria-pressed="${!!f.kola}">Ano</button><button type="button" data-h="false" aria-pressed="${!f.kola}">Ne</button></div></div>
          <div class="s6"><label class="pole"><span class="povinne">Stav při předání zákazníkovi</span></label>
            <div class="seznam-radku" id="stav-predani"></div>
            <div class="cipy">${(en ? ["Car drivable, starts and drives", "Repairs carried out according to the work order", "Car cleaned"] : ["Auto pojízdné, startuje, jede", "Opravy provedeny dle zakázkového listu", "Vůz předán umytý"]).map(t => `<button type="button" class="cip" data-cip-stav>${esc(t)}</button>`).join("")}</div></div>` : ""}
      </div></section>
      <div class="nahled-obal"><div class="nahled-ram" id="ram"><iframe id="nahled" title="Náhled dokladu"></iframe></div></div>
      <section class="karta" style="margin-top:16px">
        <h2>Podpis zákazníka – ${esc(z.zakaznici?.jmeno || "")}${podpisZakPovinny ? "" : ` <span class="napoveda" style="font-weight:400">(nepovinný – jen když je zákazník u vás)</span>`}</h2>
        <div class="podpis-pole"><canvas id="podpis"></canvas><div class="linka-podpisu"></div><div class="text-podpisu">${en ? "Customer signature" : "Podpis zákazníka (prstem nebo pero)"}</div></div>
        <div class="radek-tlacitek" style="margin-top:10px"><button type="button" class="tl tl-male" id="smazat-podpis">Smazat podpis</button></div>
      </section>
      <section class="karta" id="muj-podpis-sekce" hidden>
        <h2>Váš podpis – ${esc(uzivatel.jmeno)}</h2>
        <p class="popis">Zatím nemáte uložený podpis. Podepište se jednou – uloží se do profilu.</p>
        <div class="podpis-pole"><canvas id="muj-podpis"></canvas><div class="linka-podpisu"></div><div class="text-podpisu">${esc(uzivatel.jmeno)}</div></div>
      </section>
      <div class="akce-dole"><div class="vnitrek">
        <a class="tl" href="#/zakazka/${id}">← Zpět</a>
        <span class="co-chybi" id="co-chybi" hidden></span>
        ${lzePozdeji ? `<button type="button" class="tl tl-velke" id="pozdeji" disabled title="Zákazník spěchá nebo auto předává někdo jiný: faktura se vystaví bez jeho podpisu a zákazník ji podepíše z domu v E-servisce">✍️ Podepíše později</button>` : ""}
        <button type="button" class="tl tl-hlavni tl-velke" id="vystavit" disabled>Vystavit ${esc(cislo)}</button>
      </div></div>`;

    // náhled
    const iframe = app.querySelector("#nahled"), ram = app.querySelector("#ram"), W = 794, H = 1123;
    const meritko = () => { const k = Math.min(1, (ram.parentElement.clientWidth - 28) / W);
      iframe.style.width = W + "px"; iframe.style.height = H * 2 + "px"; iframe.style.transform = `scale(${k})`; ram.style.width = W * k + "px"; ram.style.height = H * 2 * k + "px"; };
    meritko(); window.addEventListener("resize", meritko);
    const sablona = jeFaktura ? "faktura.html" : "zakazkovy-list.html";
    let vyh = await podpisVyhotovil(), mujPad = null, pad = null;
    const podpisVyh = () => vyh || mujPad?.png() || null;
    const odecty = () => druh !== "faktura" ? [] : zalohy.filter(d => f.odecist[d.cislo]).map(d => ({ typ: "pausal", popis: `${en ? "Advance payment" : "Odečet zálohy"} ${d.cislo}`, castka: -ucinnaZaloha(d) }));
    const opravovany = () => opravitelne.find(d => d.cislo === f.opravuje);
    const polozkyOpravy = () => {
      const o = opravovany(); if (!o) return [];
      return [{ typ: "nadpis", popis: en ? `Correction of ${o.druh === "zalohova" ? "advance invoice" : "invoice"} ${o.cislo} dated ${datumCz(o.vystaveno)}` : `Oprava ${o.druh === "zalohova" ? "zálohové faktury" : "faktury"} ${o.cislo} ze dne ${datumCz(o.vystaveno)}` },
        { typ: "nadpis", popis: `${en ? "Reason" : "Důvod"}: ${String(f.duvod || "").trim()}` },
        ...f.radky.filter(r => String(r.popis).trim() || cisloZ(r.castka)).map(r => ({ typ: "pausal", popis: String(r.popis).trim(), castka: cisloZ(r.castka) || 0 }))];
    };
    const celkemOpravy = () => f.radky.reduce((a, r) => a + (cisloZ(r.castka) || 0), 0);
    const data = () => jeFaktura
      ? dataFaktury({ z, polozky: druh === "zalohova" ? [{ typ: "pausal", popis: f.popis, castka: cisloZ(f.castka) || 0 }] : druh === "opravny" ? polozkyOpravy() : polozky, dily, druh, cislo, vs,
          vystaveno: f.vystaveno, splatnost: druh === "nabidka" ? f.platnost : f.splatnost, platnost: f.platnost, podpisVyh: podpisVyh(), podpisZak: pad?.png(), odecty: odecty() })
      : dataProtokolu({ z, cislo, f, podpisVyh: podpisVyh(), podpisZak: pad?.png() });
    const chybi = () => {
      const ch = [];
      const rl = sablona === "zakazkovy-list.html" ? iframe.contentWindow?.__posledniVysledek?.radky : null;   // protokol: nic se nesmí oříznout
      if (rl?.zavady && rl.zavady.potreba > rl.zavady.max) ch.push(`kratší popis prací (max. ${rl.zavady.max} řádků)`);
      if (rl?.stav && rl.stav.potreba > rl.stav.max) ch.push(`kratší stav při předání (max. ${rl.stav.max} řádků)`);
      if (f.vystaveno && PRAVIDLA.datum(f.vystaveno)) ch.push("datum vystavení");
      if (f.splatnost && f.vystaveno && f.splatnost < f.vystaveno) ch.push(druh === "nabidka" ? "platnost nabídky je dřív než vystavení" : "splatnost je dřív než vystavení");
      if (druh === "predavaci_protokol" && f.km != null && String(f.km).trim() && PRAVIDLA.km(f.km)) ch.push("stav tachometru (0 – 2 000 000)");
      if (!vyh && (!mujPad || mujPad.prazdny())) ch.push("váš podpis");
      if (podpisZakPovinny && (!pad || pad.prazdny())) ch.push("podpis zákazníka");
      if (druh === "zalohova") { if (!(cisloZ(f.castka) > 0)) ch.push("částka zálohy"); if (!String(f.popis || "").trim()) ch.push("text položky"); }
      if (druh === "opravny") {
        if (!String(f.duvod || "").trim()) ch.push("důvod opravy");
        if (!f.radky.some(r => String(r.popis).trim() && cisloZ(r.castka))) ch.push("položka s popisem a částkou");
        if (f.radky.length + 2 > MAX_POLOZEK) ch.push(`méně řádků (max. ${MAX_POLOZEK - 2})`);
      }
      if (druh === "faktura" || druh === "zalohova" || druh === "nabidka") { if (polozkyCelkem() > MAX_POLOZEK) ch.push(`méně řádků (max. ${MAX_POLOZEK})`); }
      if (druh === "predavaci_protokol") {
        if (!f.stav.some(t => t.trim())) ch.push("stav při předání");
      }
      return ch;
    };
    const polozkyCelkem = () => (druh === "zalohova" ? 1 : polozky.length) + odecty().length;
    const kontrola = () => {
      const ku = app.querySelector("#k-uhrade"); if (ku) ku.textContent = kc(druh === "opravny" ? celkemOpravy() : s.celkem + odecty().reduce((a, o) => a + o.castka, 0));
      const ch = chybi(), b = app.querySelector("#vystavit"), i = app.querySelector("#co-chybi");
      b.disabled = ch.length > 0; i.hidden = !ch.length;
      const pz = app.querySelector("#pozdeji"); if (pz) pz.disabled = ch.length > 0; i.textContent = ch.length ? "Chybí: " + ch.join(", ") : "";
      i.dataset.kratce = ch.length ? `Chybí ${ch.length} ${ch.length === 1 ? "údaj" : ch.length < 5 ? "údaje" : "údajů"}` : ""; };
    let cekani = null;
    const obnov = () => { clearTimeout(cekani); cekani = setTimeout(async () => { try { await vykresliSablonu(iframe, sablona, data(), jazyk); } catch (e) { hlaska("Náhled se nepodařil: " + chybaText(e), true); } kontrola(); }, 250); };

    // pole dokladu
    app.querySelectorAll("[data-d]").forEach(inp => inp.addEventListener("input", () => { f[inp.dataset.d] = inp.value; obnov(); }));
    app.querySelectorAll("[data-odecist]").forEach(ch => ch.addEventListener("change", () => { f.odecist[ch.dataset.odecist] = ch.checked; obnov(); }));
    app.querySelectorAll("[data-seg]").forEach(seg => seg.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      f[seg.dataset.seg] = JSON.parse(b.dataset.h); seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); obnov();
    }));
    const stavEl = app.querySelector("#stav-predani");
    const vykresliStav = () => {
      if (!stavEl) return;
      stavEl.innerHTML = f.stav.map((t, i) => `<div class="radek-polozky"><span class="tecka">●</span>
        <textarea class="vstup" rows="1" data-st="${i}" placeholder="Např. Auto pojízdné, startuje, jede">${esc(t)}</textarea>
        <button type="button" class="tl smazat" data-st-smaz="${i}">×</button></div>`).join("") +
        `<div class="radek-tlacitek"><button type="button" class="tl tl-male" id="st-pridat">＋ Přidat řádek</button></div>`;
      stavEl.querySelectorAll("[data-st]").forEach(t => t.addEventListener("input", () => { f.stav[+t.dataset.st] = t.value.replace(/\n/g, " "); obnov(); }));
      stavEl.querySelectorAll("[data-st-smaz]").forEach(b => b.onclick = () => { f.stav.splice(+b.dataset.stSmaz, 1); if (!f.stav.length) f.stav.push(""); vykresliStav(); obnov(); });
      stavEl.querySelector("#st-pridat").onclick = () => { f.stav.push(""); vykresliStav(); stavEl.querySelectorAll("textarea")[f.stav.length - 1]?.focus(); };
    };
    vykresliStav();
    const oprEl = app.querySelector("#radky-opravy");
    const vykresliOpravu = () => {
      if (!oprEl) return;
      oprEl.innerHTML = f.radky.map((r, i) => `<div class="radek-opravy"><input class="vstup" data-or="popis" data-i="${i}" value="${esc(r.popis)}" placeholder="${en ? "Item" : "Popis položky"}">
        <input class="vstup cislo" data-or="castka" data-i="${i}" value="${esc(r.castka)}" inputmode="decimal" placeholder="-1000">
        <button type="button" class="tl smazat" data-or-smaz="${i}" aria-label="Smazat řádek">×</button></div>`).join("") +
        `<div class="radek-tlacitek" style="margin-top:8px"><button type="button" class="tl tl-male" id="or-pridat">＋ Přidat řádek</button></div>`;
      oprEl.querySelectorAll("[data-or]").forEach(inp => inp.addEventListener("input", () => { f.radky[+inp.dataset.i][inp.dataset.or] = inp.value; obnov(); }));
      oprEl.querySelectorAll("[data-or-smaz]").forEach(b => b.onclick = () => { f.radky.splice(+b.dataset.orSmaz, 1); if (!f.radky.length) f.radky.push({ popis: "", castka: "" }); vykresliOpravu(); obnov(); });
      oprEl.querySelector("#or-pridat").onclick = () => { f.radky.push({ popis: "", castka: "" }); vykresliOpravu(); oprEl.querySelectorAll('[data-or="popis"]')[f.radky.length - 1]?.focus(); };
    };
    vykresliOpravu();
    const vlozRadek = (popis, castka = "") => { const i = f.radky.findIndex(r => !String(r.popis).trim() && !String(r.castka).trim());
      if (i >= 0) f.radky[i] = { popis, castka }; else f.radky.push({ popis, castka }); vykresliOpravu(); obnov(); };
    app.querySelector("#opr-storno")?.addEventListener("click", () => { const o = opravovany(); if (!o) return;
      f.radky = [{ popis: en ? `Cancellation of ${o.cislo}` : `Storno dokladu ${o.cislo}`, castka: String(-Number(o.celkem || 0)) }];
      const d = app.querySelector('[data-d="duvod"]'); if (d && !d.value) { d.value = f.duvod = en ? "Document cancelled" : "Storno dokladu"; }
      vykresliOpravu(); obnov(); });
    app.querySelectorAll("[data-opr-cip]").forEach(b => b.onclick = () => vlozRadek(b.dataset.oprCip));
    app.querySelectorAll("[data-cip-stav]").forEach(b => b.onclick = () => {
      if (f.stav.includes(b.textContent)) return; const i = f.stav.findIndex(t => !t.trim()); if (i >= 0) f.stav[i] = b.textContent; else f.stav.push(b.textContent); vykresliStav(); obnov();
    });

    pad = new PodpisPad(app.querySelector("#podpis"), { onZmena: obnov });
    app.querySelector("#smazat-podpis").onclick = () => pad.smazat();
    if (!vyh) { app.querySelector("#muj-podpis-sekce").hidden = false; mujPad = new PodpisPad(app.querySelector("#muj-podpis"), { onZmena: obnov }); }
    uklid = () => { window.removeEventListener("resize", meritko); pad?.zrus(); mujPad?.zrus(); };
    await vykresliSablonu(iframe, sablona, data(), jazyk); kontrola();

    let nabidkaVystaveni = null;
    let bezi = false;
    const vystavit = async (pozdeji = false) => {
      if (chybi().length || bezi) return;
      if (pozdeji && !pad.prazdny()) return hlaska("Zákazník už se podepsal – použijte „Vystavit“ (nebo podpis smažte).", true);
      const kUhrade = druh === "zalohova" ? cisloZ(f.castka) : druh === "opravny" ? celkemOpravy() : s.celkem + odecty().reduce((a, o) => a + o.castka, 0);
      if ((druh === "faktura" || druh === "zalohova") && !confirm(`Vystavit ${druh === "zalohova" ? "zálohovou fakturu" : "fakturu"} ${cislo} na ${kc(kUhrade)}${pozdeji ? " bez podpisu zákazníka" : ""}? Vydaná faktura se už nedá změnit (oprava jen opravným dokladem).${pozdeji ? "\n\nZákazník ji podepíše z domu v E-servisce (pošlete mu odkaz). Podpis se pak do faktury doplní sám." : ""}`)) return;
      bezi = true;
      if (druh === "opravny" && !confirm(`Vystavit opravný doklad ${cislo} k dokladu ${f.opravuje} na ${kc(kUhrade)}? Vydaný opravný doklad se už nedá změnit ani smazat.`)) return;
      const p = prekryv("Ukládám…");
      try {
        if (!vyh && mujPad && !mujPad.prazdny()) { const png = mujPad.png(); await db.ulozitMujPodpis(uzivatel.id, png); uzivatel.podpis_obrazek = png; }
        if (druh === "nabidka" && !nabidkaVystaveni) { const [n] = await db.vlozit("nabidky", [{ zakazka_id: id, verze, stav: "odeslano", platnost: f.platnost }]); nabidkaVystaveni = n.id; }
        const nabidka_id = druh === "nabidka" ? nabidkaVystaveni : null;     // při opakovaném pokusu stejná nabídka
        const pl = dataPartsListu(z, dily, true, { druh, cislo });
        const prilohy = (druh === "nabidka" || druh === "faktura") && pl.dily.length ? [{ sablona: "parts-list.html", data: pl, nazev: "parts list", slug: "parts-list" }] : [];
        const dd = druh === "opravny" ? { ...data(), opravuje: f.opravuje } : data();
        if (pozdeji) { delete dd.podpisZakaznik; dd.cekaPodpis = true; }
        await ulozitDoklad({ iframe, sablona, data: dd, jazyk, zakazka_id: id, vozidlo_id: z.vozidlo_id || z.vozidla?.id, cisloZakazky: z.cislo, druh, verze, prilohy,
          vystaveno: druh === "predavaci_protokol" ? f.prevzeti : f.vystaveno, splatnost: ["faktura", "zalohova", "opravny"].includes(druh) ? f.splatnost : druh === "nabidka" ? f.platnost : null,
          podpisZak: pozdeji ? null : pad.png(), jmenoZakaznika: z.zakaznici?.jmeno || "", vyhPodepsalNaIpadu: !vyh, nabidka_id, prubeh: p.text });
        if (pozdeji && posledniPdf) posledniPdf.cekaPodpis = true;
        // stav zakázky
        if (druh === "nabidka" && ["prijato", "poptavka"].includes(z.stav)) await db.upravit("zakazky", id, { stav: "nabidka" });
        if (druh === "faktura" && !["zaplaceno", "predano"].includes(z.stav)) await db.upravit("zakazky", id, { stav: "fakturovano" });
        if (druh === "predavaci_protokol") {
          await db.upravit("zakazky", id, { stav: "predano", datum_predani: f.prevzeti, km_predani: cisloZ(f.km), nadrz_predani: f.nadrz,
            stav_predani: f.stav.map(t => t.trim()).filter(Boolean), foto_predani: !!f.foto, zkusebni_jizda: !!f.jizda, kola_dotazena: !!f.kola });
          const vid = z.vozidlo_id || z.vozidla?.id; if (vid && cisloZ(f.km) != null) await db.upravit("vozidla", vid, { km_posledni: cisloZ(f.km) });
        }
        p.zavri(); location.hash = `#/hotovo/${id}`;
      } catch (e) { p.zavri(); hlaska("Vystavení se nepovedlo: " + chybaText(e), true, 8000); }
      finally { bezi = false; }
    };
    app.querySelector("#vystavit").onclick = () => vystavit(false);
    const pozdejiTl = app.querySelector("#pozdeji"); if (pozdejiTl) pozdejiTl.onclick = () => vystavit(true);
  }

  /* ================= přehled dokladů (všechny zakázky) ================= */
  const nazevMesice = m => { const [y, mm] = m.split("-"); return `${["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"][+mm - 1]} ${y}`; };
  /* ================= díly: kolikrát a na jaká auta (statistika ze zakázek) ================= */
  async function dilyPrehled() {
    const n0 = navId;
    app.innerHTML = `<div class="hlavicka-prehledu"><div><h1>Díly</h1><div class="mutted">Všechny díly zadané do zakázek – kolikrát a na jaká auta</div></div></div>
      <input class="vstup" id="filtr-dilu" type="search" placeholder="Hledat: název, číslo MB, výrobce, model auta" style="margin-bottom:10px">
      <div class="filtry-zakazek"><select class="vstup" id="dily-rada" aria-label="Typ vozu"><option value="">Všechny typy</option></select>
        <select class="vstup" id="dily-razeni" aria-label="Řazení"><option value="pocet">Nejpoužívanější</option><option value="datum">Naposledy použité</option><option value="nazev">Podle názvu A–Z</option></select>
        <span class="napoveda" id="dily-pocet"></span></div>
      <div id="seznam-dilu"><div class="nacitani">Načítám díly…</div></div>`;
    let D = [];
    try { [D] = await Promise.all([db.vsechnyDily(), nactiKatalogVozu()]); } catch (e) { app.querySelector("#seznam-dilu").innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (navId !== n0) return;
    const klicDilu = d => { const c = String(d.cislo_mb || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return c ? "c:" + c : "n:" + String(d.nazev || "").trim().toLowerCase(); };
    const popisAuta = v => { if (!v) return { text: "neznámé auto", rada: "" };
      const k = vuzVKatalogu(v)[0], rada = k?.rada || (v.typ ? (/^\d/.test(v.typ) ? "W" : "") + v.typ : "");
      return { text: [rada, v.model].filter(Boolean).join(" ") + (v.rok ? ` (${v.rok})` : ""), motor: v.motor || k?.motor || "", rada: cislaRady(rada) }; };
    const G = {};
    D.filter(d => d.nazev || d.cislo_mb).forEach(d => {
      const g = G[klicDilu(d)] ||= { nazvy: {}, cislo: d.cislo_mb || "", vyrobci: new Set(), mnozstvi: 0, jednotka: d.jednotka || "ks", pouziti: [], ceny: [] };
      g.nazvy[d.nazev || ""] = (g.nazvy[d.nazev || ""] || 0) + 1; if (d.vyrobce) g.vyrobci.add(d.vyrobce);
      g.mnozstvi += Number(d.mnozstvi) || 0;
      if (d.nakupni_cena != null) g.ceny.push(Number(d.nakupni_cena) * (Number(d.kurz) || 1));
      const z = d.zakazky || {}, a = popisAuta(z.vozidla);
      g.pouziti.push({ zid: z.id, cislo: z.cislo, datum: z.datum_prijmu || "", mnozstvi: d.mnozstvi, ...a });
    });
    const skupiny = Object.values(G).map(g => ({ ...g, nazev: Object.entries(g.nazvy).sort((a, b) => b[1] - a[1])[0][0] || g.cislo,
      zakazek: new Set(g.pouziti.map(x => x.zid)).size, posledni: g.pouziti.map(x => x.datum).sort().pop() || "",
      rady: new Set(g.pouziti.map(x => x.rada).filter(Boolean)) }));
    const vsechnyRady = [...new Set(skupiny.flatMap(g => [...g.rady]))].sort();
    app.querySelector("#dily-rada").insertAdjacentHTML("beforeend", vsechnyRady.map(r => `<option value="${r}">${r}</option>`).join(""));
    const F = { rada: "", razeni: "pocet", ...(nacti("werk-filtr-dilu") || {}) };
    app.querySelector("#dily-rada").value = vsechnyRady.includes(F.rada) ? F.rada : ""; app.querySelector("#dily-razeni").value = F.razeni;
    const otevrene = new Set();
    const vykresli = () => {
      const q = app.querySelector("#filtr-dilu").value.trim().toLowerCase(), rada = app.querySelector("#dily-rada").value, raz = app.querySelector("#dily-razeni").value;
      const r = skupiny.filter(g => (!rada || g.rady.has(rada)) && (!q || [g.nazev, g.cislo, ...g.vyrobci, ...g.pouziti.map(x => x.text + " " + x.motor)].some(x => String(x).toLowerCase().includes(q))))
        .sort(raz === "nazev" ? (a, b) => a.nazev.localeCompare(b.nazev, "cs") : raz === "datum" ? (a, b) => b.posledni.localeCompare(a.posledni) : (a, b) => b.zakazek - a.zakazek || b.mnozstvi - a.mnozstvi);
      app.querySelector("#dily-pocet").textContent = `${r.length} dílů`;
      app.querySelector("#seznam-dilu").innerHTML = r.length ? `<div class="doklady">${r.map((g, i) => {
        const auta = {}; g.pouziti.forEach(x => { const k = x.text + (x.motor ? " · " + x.motor : ""); auta[k] = (auta[k] || 0) + 1; });
        const k = g.cislo || g.nazev, cena = g.ceny.length && jeMajitel() ? ` · nákup ⌀ ${kc(g.ceny.reduce((a, b) => a + b, 0) / g.ceny.length)}` : "";
        return `<div class="doklad dil-stat"><button type="button" class="dil-hlava" data-dil="${esc(k)}" aria-expanded="${otevrene.has(k)}">
          <span><b>${esc(g.nazev)}</b>${g.cislo ? ` <span class="mutted">· ${esc(g.cislo)}</span>` : ""}${g.vyrobci.size ? ` <small class="mutted">· ${esc([...g.vyrobci].join(", "))}</small>` : ""}
            <br><small class="mutted">${g.zakazek}× v zakázkách · celkem ${mnozstviCz(g.mnozstvi)} ${esc(g.jednotka)}${g.posledni ? ` · naposledy ${datumCz(g.posledni)}` : ""}${cena}</small>
            <span class="cipy" style="margin-top:6px">${Object.entries(auta).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a, n]) => `<span class="cip">${esc(a)}${n > 1 ? ` ×${n}` : ""}</span>`).join("")}</span></span>
          <b class="dil-pocet">${g.zakazek}×</b></button>
          ${otevrene.has(k) ? `<div class="dil-pouziti">${g.pouziti.sort((a, b) => b.datum.localeCompare(a.datum)).map(x => `<a class="odkaz-radek" href="#/zakazka/${x.zid}">#${x.cislo} · ${esc(x.text)}${x.motor ? " · " + esc(x.motor) : ""} · ${datumCz(x.datum)} · ${mnozstviCz(Number(x.mnozstvi) || 0)} ${esc(g.jednotka)}</a>`).join("")}</div>` : ""}</div>`; }).join("")}</div>`
        : `<div class="prazdne">${skupiny.length ? "Nic nenalezeno." : "Zatím žádné díly – přidávají se v zakázce v sekci Díly."}</div>`;
      app.querySelectorAll("[data-dil]").forEach(b => b.onclick = () => { const k = b.dataset.dil; otevrene.has(k) ? otevrene.delete(k) : otevrene.add(k); vykresli(); });
    };
    vykresli();
    app.querySelector("#filtr-dilu").oninput = vykresli;
    ["rada", "razeni"].forEach(k => app.querySelector("#dily-" + k).onchange = e => { F[k] = e.target.value; uloz("werk-filtr-dilu", F); vykresli(); });
  }
  async function prehledDokladu() {
    const n0 = navId;
    app.innerHTML = `<h1>Doklady</h1><div class="nacitani">Načítám doklady…</div>`;
    let vse = [];
    try { vse = await db.vsechnyDoklady(); } catch (e) { app.innerHTML = `<h1>Doklady</h1><div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
    const F = { druh: "vse", mesic: "", nezaplacene: false };          // po otevření z menu vždy „Vše“
    const mesice = [...new Set(vse.map(d => String(d.vystaveno).slice(0, 7)))].sort().reverse();
    const DRUHY_FILTR = [["vse", "Vše"], ["faktury", "Faktury"], ["nabidka", "Nabídky"], ["predavaci_protokol", "Protokoly"], ["zakazkovy_list", "Zakázkové listy"]];
    const jeFa = d => d.druh === "faktura" || d.druh === "zalohova" || d.druh === "opravny";
    const poSplatnosti = d => jeFa(d) && !d.zaplaceno && d.splatnost && d.splatnost < dnes();
    app.innerHTML = `
      <h1>Doklady</h1>
      <div class="segment" id="f-druh" style="margin-bottom:12px">${DRUHY_FILTR.map(([k, t]) => `<button type="button" data-k="${k}" aria-pressed="${F.druh === k}">${t}</button>`).join("")}</div>
      <div class="radek-tlacitek" style="margin-bottom:14px">
        <select class="vstup" id="f-mesic" style="max-width:220px"><option value="">Všechny měsíce</option>${mesice.map(m => `<option value="${m}" ${F.mesic === m ? "selected" : ""}>${nazevMesice(m)}</option>`).join("")}</select>
        <label class="cip zaskrt"><input type="checkbox" id="f-nezapl" ${F.nezaplacene ? "checked" : ""}> Jen nezaplacené</label>
      </div>
      <div class="dlazdice" id="dlazdice"></div>
      <div class="doklady" id="seznam-dokladu"></div>`;
    const vykresli = () => {
      const r = vse.filter(d => (F.druh === "vse" || (F.druh === "faktury" ? jeFa(d) : d.druh === F.druh))
        && (!F.mesic || String(d.vystaveno).startsWith(F.mesic)) && (!F.nezaplacene || (jeFa(d) && !d.zaplaceno)));
      const fa = r.filter(d => d.druh === "faktura" || d.druh === "opravny"), za = r.filter(d => d.druh === "zalohova");
      const suma = a => a.reduce((x, d) => x + (Number(d.celkem) || 0), 0);
      const nezapl = r.filter(d => jeFa(d) && !d.zaplaceno), po = r.filter(poSplatnosti);
      app.querySelector("#dlazdice").innerHTML = F.druh === "faktury" || F.druh === "vse" ? `
        <div class="dlazdice-k"><small>Faktury${F.mesic ? " – " + nazevMesice(F.mesic) : ""}</small><b>${kc(suma(fa))}</b><span>${fa.length} ks${za.length ? ` + zálohové ${kc(suma(za))}` : ""}</span></div>
        <div class="dlazdice-k"><small>Nezaplaceno</small><b>${kc(suma(nezapl))}</b><span>${nezapl.length} ks</span></div>
        <div class="dlazdice-k ${po.length ? "cervena" : ""}"><small>Po splatnosti</small><b>${kc(suma(po))}</b><span>${po.length} ks</span></div>` : "";
      app.querySelector("#seznam-dokladu").innerHTML = r.length ? r.map(d => `
        <div class="doklad"><span><b>${esc(d.cislo)}</b> · ${DRUHY[d.druh] || d.druh} · ${esc(d.zakazky?.zakaznici?.jmeno || "")}
          <br><small class="mutted">${esc([d.zakazky?.vozidla?.typ, d.zakazky?.vozidla?.model].filter(Boolean).join(" "))} · ${datumCz(d.vystaveno)}${jeFa(d) && d.splatnost ? ` · splatnost ${datumCz(d.splatnost)}` : ""}
          ${jeFa(d) ? (d.zaplaceno ? ` · <b style="color:var(--zelena)">zaplaceno ${datumCz(d.zaplaceno)}</b>` : poSplatnosti(d) ? ` · <b style="color:var(--cervena)">po splatnosti</b>` : " · nezaplaceno") : ""}</small></span>
          <span class="radek-tlacitek">${d.celkem != null ? `<b style="font-variant-numeric:tabular-nums">${kc(d.celkem)}</b>` : ""}
            ${d.soubory?.klic ? `<button class="tl tl-male" data-pdf="${esc(d.soubory.klic)}">PDF</button>` : ""}
            ${d.zakazky?.id ? `<a class="tl tl-male" href="#/zakazka/${d.zakazky.id}">#${d.zakazky.cislo}</a>` : ""}
            ${lzeSmazatDoklad(d, vse) ? `<button class="tl tl-male tl-kos" data-smazat-doklad="${d.id}" title="Smazat doklad ${esc(d.cislo)}" aria-label="Smazat doklad ${esc(d.cislo)}">🗑</button>` : ""}</span></div>`).join("")
        : `<div class="prazdne">Žádné doklady pro tento výběr.</div>`;
      app.querySelectorAll("[data-pdf]").forEach(b => b.onclick = async () => {
        const okno = window.open("", "_blank");
        try { const u = await db.odkaz(b.dataset.pdf, 600); if (okno) okno.location = u; else location.href = u; } catch (e) { okno?.close(); hlaska(chybaText(e), true); }
      });
      app.querySelectorAll("[data-smazat-doklad]").forEach(b => b.onclick = () => smazatDokladDotaz(vse.find(x => x.id === b.dataset.smazatDoklad), async () => {
        try { vse = await db.vsechnyDoklady(); } catch (e) { hlaska(chybaText(e), true); } vykresli();
      }));
    };
    app.querySelector("#f-druh").onclick = e => { const b = e.target.closest("button"); if (!b) return; F.druh = b.dataset.k;
      app.querySelectorAll("#f-druh button").forEach(x => x.setAttribute("aria-pressed", x === b)); vykresli(); };
    app.querySelector("#f-mesic").onchange = e => { F.mesic = e.target.value; vykresli(); };
    app.querySelector("#f-nezapl").onchange = e => { F.nezaplacene = e.target.checked; vykresli(); };
    vykresli();
  }

  /* ================= dokumenty vozidla (TP) ================= */
  async function vykresliDokumentyVozidla(vid, el, upravy = false) {
    if (!el || !vid) return;
    try {
      const dok = await db.dokumentyVozidla(vid);
      if (!dok.length) { el.innerHTML = `<span class="mutted" style="grid-column:1/-1">Žádné dokumenty.${upravy ? "" : " TP nafotíte při příjmu nebo v kartě vozidla."}</span>`; return; }
      const odk = await db.odkazy(dok.map(d => d.klic));
      el.innerHTML = dok.map((d, i) => `<a class="fotka dokument" href="${esc(odk[i].signedUrl)}" target="_blank" rel="noopener" title="${esc(d.nazev || "")}">
        ${d.mime === "application/pdf" ? `<span class="tp-pdf" style="display:grid;place-items:center;height:100%">PDF</span>` : `<img src="${esc(odk[i].signedUrl)}" alt="" loading="lazy">`}
        <span class="stav-fotky">${esc(d.nazev || "Dokument")}</span></a>`).join("");
    } catch (e) { el.innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; }
  }

  /* ================= zákazníci ================= */
  const ZAK_POLE = [["jmeno", "Jméno a příjmení / název firmy", "s3", true], ["kontaktni_osoba", "Kontaktní osoba", "s3"], ["telefon", "Telefon", "s3"], ["email", "E-mail", "s3"],
    ["ulice", "Ulice a číslo", "s3"], ["psc", "PSČ", "s1"], ["mesto", "Město", "s2"], ["zeme", "Země", "s2"], ["ico", "IČO", "s2"], ["dic", "DIČ", "s2"]];
  async function zakaznici() {
    const n0 = navId;
    app.innerHTML = `<div class="hlavicka-prehledu"><h1>Zákazníci</h1><a class="tl tl-hlavni" href="#/zakaznik/novy">＋ Nový zákazník</a></div>
      <input class="vstup" id="filtr" type="search" placeholder="Hledat: jméno, telefon, e-mail, město" style="margin-bottom:14px">
      <div class="doklady" id="seznam"><div class="nacitani">Načítám…</div></div>`;
    let data = [];
    try { data = await db.seznamZakazniku(); } catch (e) { app.querySelector("#seznam").innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
    const vykresli = q => {
      const t = q.trim().toLowerCase();
      const r = data.filter(z => !t || [z.jmeno, z.telefon, z.email, z.mesto, z.kontaktni_osoba].some(x => String(x ?? "").toLowerCase().includes(t)));
      app.querySelector("#seznam").innerHTML = r.length ? r.map(z => {
        const auta = (z.vlastnictvi || []).filter(x => !x.vlastni_do && x.vozidla).map(x => [x.vozidla.typ, x.vozidla.model].filter(Boolean).join(" ")).filter(Boolean);
        const pocet = z.zakazky?.[0]?.count ?? 0;
        return `<div class="doklad odkaz-radek" data-href="#/zakaznik/${z.id}"><span><a class="jmeno-odkaz" href="#/zakaznik/${z.id}"><b>${esc(z.jmeno)}</b></a>${z.je_firma ? ` <span class="stitek">firma</span>` : ""}<br>
          <small class="mutted kontakty">${[telOdkaz(z.telefon), mailOdkaz(z.email), esc(z.mesto || "")].filter(Boolean).join(" · ")}</small></span>
          <span class="mutted" style="text-align:right">${esc(auta.join(", "))}<br><small>${pocet} ${pocet === 1 ? "zakázka" : pocet > 1 && pocet < 5 ? "zakázky" : "zakázek"}</small></span></div>`;
      }).join("") : `<div class="prazdne">${data.length ? "Nikdo nenalezen." : "Zatím žádní zákazníci."}</div>`;
    };
    vykresli(""); app.querySelector("#filtr").oninput = e => vykresli(e.target.value);
    // klik na řádek otevře zákazníka; klik na telefon / e-mail rovnou volá / píše
    app.querySelector("#seznam").onclick = e => { if (e.target.closest("a")) return; const r = e.target.closest("[data-href]"); if (r) location.hash = r.dataset.href; };
  }
  async function zakaznikDetail(id) {
    const n0 = navId;
    const novy = id === "novy";
    let z = { je_firma: false, zeme: "Česká Republika", jazyk: "cs", vlastnictvi: [], zakazky: [] };
    if (!novy) {
      app.innerHTML = `<div class="nacitani">Načítám…</div>`;
      try { z = await db.zakaznik(id); } catch (e) { app.innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
      if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
      if (!z) { app.innerHTML = `<div class="info chyba">Zákazník nenalezen.</div>`; return; }
    }
    const auta = (z.vlastnictvi || []).filter(x => x.vozidla);
    app.innerHTML = `
      <div class="mutted"><a href="#/zakaznici">← Zákazníci</a></div>
      <h1>${novy ? "Nový zákazník" : esc(z.jmeno)}</h1>
      ${novy ? "" : kontaktTlacitka(z)}
      <section class="karta"><h2>Údaje</h2>
        <form id="f" class="mrizka" autocomplete="off">
          <div class="s6"><div class="segment" id="firma"><button type="button" data-h="false" aria-pressed="${!z.je_firma}">Osoba</button><button type="button" data-h="true" aria-pressed="${!!z.je_firma}">Firma</button></div></div>
          ${ZAK_POLE.map(([k, t, w, pov]) => `<label class="pole ${w}"><span class="${pov ? "povinne" : ""}">${t}</span><input name="${k}" value="${esc(z[k] ?? "")}" ${k === "email" ? 'type="email" inputmode="email"' : k === "telefon" ? 'type="tel"' : ""}></label>`).join("")}
          <div class="s3"><label class="pole">Jazyk dokladů</label><div class="segment" id="jazyk"><button type="button" data-h="cs" aria-pressed="${z.jazyk !== "en"}">Čeština</button><button type="button" data-h="en" aria-pressed="${z.jazyk === "en"}">English</button></div></div>
          <label class="pole s6">Poznámka<textarea name="poznamka" rows="2">${esc(z.poznamka || "")}</textarea></label>
          <div class="s6 radek-tlacitek"><button class="tl tl-hlavni" type="submit">💾 Uložit</button>
            ${!novy && uzivatel.role === "majitel" ? `<button class="tl tl-smazat" type="button" id="smazat">🗑 Smazat zákazníka</button>` : ""}<span class="napoveda" id="stav"></span></div>
        </form></section>
      ${novy ? "" : `
      <section class="karta"><h2>Auta</h2><div class="doklady">${auta.map(x => `<a class="doklad odkaz-radek" href="#/vozidlo/${x.vozidla.id}"><span><b>${esc([x.vozidla.typ, x.vozidla.model].filter(Boolean).join(" ") || "Mercedes-Benz")}</b>${x.vozidla.rok ? ` (${x.vozidla.rok})` : ""}<br>
        <small class="mutted">${esc(x.vozidla.vin)}${x.vozidla.spz ? " · " + esc(x.vozidla.spz) : ""}</small></span><small class="mutted">${x.vlastni_do ? `bývalý majitel do ${datumCz(x.vlastni_do)}` : `majitel od ${datumCz(x.vlastni_od)}`}</small></a>`).join("") || `<span class="mutted">Žádné auto.</span>`}</div></section>
      <section class="karta"><h2>Zakázky</h2><div class="doklady">${(z.zakazky || []).sort((a, b) => b.cislo - a.cislo).map(k => `<a class="doklad odkaz-radek" href="#/zakazka/${k.id}"><span><b>#${k.cislo}</b> · ${esc([k.vozidla?.typ, k.vozidla?.model].filter(Boolean).join(" "))}<br><small class="mutted">přijato ${datumCz(k.datum_prijmu)}</small></span><span class="stitek">${STAVY[k.stav] || k.stav}</span></a>`).join("") || `<span class="mutted">Žádné zakázky.</span>`}</div></section>`}`;
    const sm = app.querySelector("#smazat");
    if (sm) sm.onclick = async () => {
      const pocet = (z.zakazky || []).length;
      if (pocet) return hlaska(`${z.jmeno} má ${pocet} ${pocet === 1 ? "zakázku" : pocet < 5 ? "zakázky" : "zakázek"} – nejdřív je smažte (nebo zákazníka nechte).`, true, 7000);
      if (!confirm(`Smazat zákazníka ${z.jmeno}? Jeho auta zůstanou v systému, jen bez majitele. Nejde to vrátit.`)) return;
      try { await db.smazatZakaznika(id); hlaska("Zákazník smazán."); location.hash = "#/zakaznici"; } catch (e) { hlaska("Smazat nejde: " + chybaText(e), true, 7000); }
    };
    const f = app.querySelector("#f"); let jeFirma = !!z.je_firma, jazyk = z.jazyk || "cs";
    const seg = (sel, fn) => app.querySelector(sel).onclick = e => { const b = e.target.closest("button"); if (!b) return; fn(JSON.parse(JSON.stringify(b.dataset.h))); app.querySelectorAll(sel + " button").forEach(x => x.setAttribute("aria-pressed", x === b)); };
    seg("#firma", h => (jeFirma = h === "true")); seg("#jazyk", h => (jazyk = h));
    const kontrolaZak = () => [...f.querySelectorAll("input[name]")].map(i => zkontrolujPole(i, i.name, f.zeme?.value)).filter(Boolean);
    f.addEventListener("input", e => { if (e.target.name) zkontrolujPole(e.target, e.target.name, f.zeme?.value); });
    f.onsubmit = async e => {
      e.preventDefault();
      const chyby = kontrolaZak(); if (chyby.length) return hlaska("Opravte červená pole: " + chyby.join(", "), true);
      const d = Object.fromEntries(new FormData(f)); for (const k in d) { d[k] = d[k].trim(); if (!d[k] && k !== "jmeno") d[k] = null; }
      if (!d.jmeno) return hlaska("Vyplňte jméno.", true);
      d.je_firma = jeFirma; d.jazyk = jazyk;
      if (f.dataset.bezi) return;                          // dvojí odeslání nesmí založit dva zákazníky
      const tl = f.querySelector('[type="submit"]'); f.dataset.bezi = "1"; if (tl) tl.disabled = true;
      try {
        if (novy) { const nid = await db.ulozitZakaznika(d); hlaska("Zákazník uložen."); location.hash = `#/zakaznik/${nid}`; }
        else { await db.upravit("zakaznici", id, d); app.querySelector("#stav").textContent = "✓ Uloženo"; hlaska("Změny uloženy."); }
      } catch (err) { hlaska("Nepodařilo se uložit: " + chybaText(err), true); }
      finally { delete f.dataset.bezi; if (tl) tl.disabled = false; }
    };
  }

  /* ================= vozidla ================= */
  async function vozidla() {
    const n0 = navId;
    app.innerHTML = `<div class="hlavicka-prehledu"><h1>Vozidla</h1></div>
      <input class="vstup" id="filtr" type="search" placeholder="Hledat: VIN, SPZ, typ, model, majitel" style="margin-bottom:14px">
      <div class="doklady" id="seznam"><div class="nacitani">Načítám…</div></div>`;
    let data = [];
    try { data = await db.seznamVozidel(); } catch (e) { app.querySelector("#seznam").innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
    const vykresli = q => {
      const t = q.trim().toLowerCase();
      const majitel = v => (v.vlastnictvi || []).filter(x => !x.vlastni_do && x.zakaznici).map(x => x.zakaznici.jmeno).join(", ");
      const r = data.filter(v => !t || [v.vin, v.spz, v.typ, v.model, v.rok, majitel(v)].some(x => String(x ?? "").toLowerCase().includes(t)));
      app.querySelector("#seznam").innerHTML = r.length ? r.map(v => `<a class="doklad odkaz-radek" href="#/vozidlo/${v.id}"><span><b>${esc([v.typ, v.model].filter(Boolean).join(" ") || "Mercedes-Benz")}</b>${v.rok ? ` (${v.rok})` : ""}${v.verze && v.verze !== "EU" ? ` · ${esc(v.verze)}` : ""}<br>
        <small class="mutted">${esc(v.vin)}${v.spz ? " · " + esc(v.spz) : ""}${v.km_posledni != null ? ` · ${Number(v.km_posledni).toLocaleString("cs-CZ")} ${v.jednotka_tachometru === "mi" ? "mi" : "km"}` : ""}</small></span>
        <span class="mutted" style="text-align:right">${esc(majitel(v))}<br><small>${v.zakazky?.[0]?.count ?? 0} zak.</small></span></a>`).join("")
        : `<div class="prazdne">${data.length ? "Nic nenalezeno." : "Zatím žádná vozidla."}</div>`;
    };
    vykresli(""); app.querySelector("#filtr").oninput = e => vykresli(e.target.value);
  }
  async function vozidloDetail(id) {
    const n0 = navId;
    app.innerHTML = `<div class="nacitani">Načítám…</div>`;
    let v;
    try { v = await db.vozidlo(id); } catch (e) { app.innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (navId !== n0) return;                         // mezitím se přešlo jinam – nepřekreslovat cizí stránku
    if (!v) { app.innerHTML = `<div class="info chyba">Vozidlo nenalezeno.</div>`; return; }
    const vin = rozlustitVin(v.vin);
    let K = null; try { K = await nactiKatalogServisu(); } catch (e) { /* bez katalogu jen bez výběru motoru */ }
    const motorAuto = K ? urciMotor({ ...v, motor: null }, K) : null;
    const majitele = (v.vlastnictvi || []).filter(x => x.zakaznici).sort((a, b) => (a.vlastni_do ? 1 : 0) - (b.vlastni_do ? 1 : 0));
    const VP = [["vin", "VIN / číslo podvozku", "s4"], ["spz", "SPZ", "s2"], ["typ", "Typ", "s2"], ["model", "Model", "s2"], ["rok", "Rok výroby", "s2"], ["barva", "Barva", "s2"],
      ["cislo_motoru", "Číslo motoru", "s2"], ["prevodovka", "Převodovka", "s2"], ["km_posledni", "Poslední stav tachometru", "s2"], ["baterie", "Baterie", "s2"], ["pneu_letni", "Pneu letní", "s2"], ["pneu_zimni", "Pneu zimní", "s2"]];
    app.innerHTML = `
      <div class="mutted"><a href="#/vozidla">← Vozidla</a></div>
      <h1>${esc([v.typ, v.model].filter(Boolean).join(" ") || "Mercedes-Benz")}${v.rok ? ` (${v.rok})` : ""}</h1>
      <section class="karta"><h2>Údaje</h2>
        <form id="f" class="mrizka" autocomplete="off">
          ${VP.map(([k, t, w]) => `<label class="pole ${w}">${t}<input name="${k}" value="${esc(v[k] ?? "")}" ${["rok", "km_posledni"].includes(k) ? 'inputmode="numeric"' : ""} ${k === "vin" ? 'class="vin" autocapitalize="characters" spellcheck="false"' : ""}>${k === "vin" && vin ? `<span class="napoveda">Typ ${vin.typ}, kód modelu ${vin.kod}</span>` : ""}</label>`).join("")}
          <label class="pole s2">Motor (pro servisní intervaly)<select name="motor"><option value="">${esc(motorAuto ? `automaticky (${motorAuto})` : "automaticky – neurčen")}</option>
            ${(K?.motory || []).map(m => `<option value="${m.kod}" ${v.motor === m.kod ? "selected" : ""}>${m.kod} · ${m.palivo === "diesel" ? "diesel" : "benzín"}${m.popis ? " · " + esc(m.popis) : ""}</option>`).join("")}</select></label>
          <div class="s2"><label class="pole">Verze</label><div class="segment" id="verze">${["EU", "US", "JP"].map(x => `<button type="button" data-h="${x}" aria-pressed="${(v.verze || "EU") === x}">${x}</button>`).join("")}</div></div>
          <div class="s2"><label class="pole">Tachometr</label><div class="segment" id="jedn">${[["km", "km"], ["mi", "míle"]].map(([x, t]) => `<button type="button" data-h="${x}" aria-pressed="${(v.jednotka_tachometru || "km") === x}">${t}</button>`).join("")}</div></div>
          <label class="pole s6">Poznámka<textarea name="poznamka" rows="2">${esc(v.poznamka || "")}</textarea></label>
          <div class="s6 radek-tlacitek"><button class="tl tl-hlavni" type="submit">💾 Uložit</button>
            ${uzivatel.role === "majitel" ? `<button class="tl tl-smazat" type="button" id="smazat">🗑 Smazat vozidlo</button>` : ""}<span class="napoveda" id="stav"></span></div>
        </form></section>
      <section class="karta"><h2>Technický průkaz (TP)</h2>
        <div class="fotky" id="dokumenty-vozidla"></div>
        <div class="radek-tlacitek" style="margin-top:12px">
          <label class="tl">📷 TP – přední strana<input type="file" accept="image/*,application/pdf" data-tp="TP – přední strana" hidden></label>
          <label class="tl">📷 TP – zadní strana<input type="file" accept="image/*,application/pdf" data-tp="TP – zadní strana" hidden></label>
          <span class="napoveda" id="stav-tp">Zobrazí se v E-servisce mezi dokumenty ke stažení.</span></div></section>
      <section class="karta"><h2>Majitel</h2>
        <div class="doklady">${majitele.map(x => `<div class="doklad"><span><a href="#/zakaznik/${x.zakaznici.id}"><b>${esc(x.zakaznici.jmeno)}</b></a><br><small class="mutted kontakty">${[telOdkaz(x.zakaznici.telefon), mailOdkaz(x.zakaznici.email)].filter(Boolean).join(" · ")}</small></span>
          <small class="mutted">${x.vlastni_do ? `${datumCz(x.vlastni_od)} – ${datumCz(x.vlastni_do)}` : `od ${datumCz(x.vlastni_od)} · <b style="color:var(--zelena)">současný</b>`}</small></div>`).join("") || `<span class="mutted">Majitel není zadaný.</span>`}</div>
        <p class="popis" style="margin:14px 0 8px">Změna majitele – staré zakázky a doklady zůstanou předchozímu majiteli:</p>
        <input class="vstup" id="hledat-majitele" type="search" placeholder="Najít nového majitele: jméno, telefon, e-mail" autocomplete="off">
        <div class="vysledky" id="vysledky-majitel"></div></section>
      <section class="karta"><h2>Zakázky</h2><div class="doklady">${(v.zakazky || []).sort((a, b) => b.cislo - a.cislo).map(k => `<a class="doklad odkaz-radek" href="#/zakazka/${k.id}"><span><b>#${k.cislo}</b> · přijato ${datumCz(k.datum_prijmu)}<br><small class="mutted">${k.km_prijem != null ? `${Number(k.km_prijem).toLocaleString("cs-CZ")} ${v.jednotka_tachometru === "mi" ? "mi" : "km"}` : ""}</small></span><span class="stitek">${STAVY[k.stav] || k.stav}</span></a>`).join("") || `<span class="mutted">Žádné zakázky.</span>`}</div></section>
      ${blokPoznamek([{ tabulka: "vozidla", id: v.id, hodnota: v.poznamky, popis: "Poznámky k autu", napoveda: "Zvláštnosti auta, historie, co hlídat příště…" }])}`;
    vykresliDokumentyVozidla(id, app.querySelector("#dokumenty-vozidla"), true);
    const sm = app.querySelector("#smazat");
    if (sm) sm.onclick = async () => {
      const pocet = (v.zakazky || []).length;
      if (pocet) return hlaska(`Auto má ${pocet} ${pocet === 1 ? "zakázku" : pocet < 5 ? "zakázky" : "zakázek"} – nejdřív je smažte.`, true, 7000);
      if (!confirm(`Smazat vozidlo ${[v.typ, v.model].filter(Boolean).join(" ")} (${v.vin}) včetně TP? Nejde to vrátit.`)) return;
      try { await db.smazatVozidlo(id); hlaska("Vozidlo smazáno."); location.hash = "#/vozidla"; } catch (e) { hlaska("Smazat nejde: " + chybaText(e), true, 7000); }
    };
    let verze = v.verze || "EU", jedn = v.jednotka_tachometru || "km";
    navazPoznamky(app, (tab, h) => { v.poznamky = h; });
    const seg = (sel, fn) => app.querySelector(sel).onclick = e => { const b = e.target.closest("button"); if (!b) return; fn(b.dataset.h); app.querySelectorAll(sel + " button").forEach(x => x.setAttribute("aria-pressed", x === b)); };
    seg("#verze", h => { verze = h; if (h === "US" && jedn !== "mi") { jedn = "mi"; app.querySelectorAll("#jedn button").forEach(x => x.setAttribute("aria-pressed", x.dataset.h === "mi")); } });
    seg("#jedn", h => (jedn = h));
    const f = app.querySelector("#f");
    f.addEventListener("input", e => { if (e.target.name) zkontrolujPole(e.target, e.target.name); });
    f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f)); for (const k in d) { d[k] = d[k].trim(); if (!d[k]) d[k] = null; }
      if (!d.vin || d.vin.replace(/\s/g, "").length < 8) return hlaska("Vyplňte VIN.", true);
      const chyby = [...f.querySelectorAll("input[name]")].map(i => zkontrolujPole(i, i.name)).filter(Boolean);
      if (chyby.length) return hlaska("Opravte červená pole: " + chyby.join(", "), true);
      d.rok = d.rok ? parseInt(d.rok, 10) : null; d.km_posledni = cisloZ(d.km_posledni); d.verze = verze; d.jednotka_tachometru = jedn;
      try { await db.upravit("vozidla", id, d); app.querySelector("#stav").textContent = "✓ Uloženo"; hlaska("Změny uloženy."); }
      catch (err) { hlaska(/duplicate|unique/i.test(chybaText(err)) ? "Auto s tímto VIN už v systému je." : "Nepodařilo se uložit: " + chybaText(err), true); }
    };
    app.querySelectorAll("[data-tp]").forEach(inp => inp.addEventListener("change", async e => {
      const soubor = e.target.files[0]; e.target.value = ""; if (!soubor) return;
      const st = app.querySelector("#stav-tp"); st.textContent = "Nahrávám…";
      try {
        const pdf = soubor.type === "application/pdf" || /\.pdf$/i.test(soubor.name || "");
        const blob = pdf ? soubor : (await zmensi(soubor, 2600, 0.86)).blob;
        const d = new Date(), klic = `dokumenty/tp/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${uuid()}.${pdf ? "pdf" : "jpg"}`;
        await db.nahrat(klic, blob, pdf ? "application/pdf" : "image/jpeg");
        await db.vlozit("soubory", [{ vozidlo_id: id, druh: "tp", klic, nazev: inp.dataset.tp, mime: pdf ? "application/pdf" : "image/jpeg", verejne: true }]);
        st.textContent = "✓ Nahráno"; vykresliDokumentyVozidla(id, app.querySelector("#dokumenty-vozidla"), true);
      } catch (err) { st.textContent = ""; hlaska("TP se nepodařilo nahrát: " + chybaText(err), true); }
    }));
    const hl = app.querySelector("#hledat-majitele");
    hl.oninput = () => { clearTimeout(hl._t); hl._t = setTimeout(async () => {
      const el = app.querySelector("#vysledky-majitel");
      if (hl.value.trim().length < 2) { el.innerHTML = ""; return; }
      try {
        const r = await db.hledatZakazniky(hl.value);
        el.innerHTML = r.map((z, i) => `<button type="button" class="vysledek" data-i="${i}"><span><b>${esc(z.jmeno)}</b><small> ${esc([z.telefon, z.email].filter(Boolean).join(" · "))}</small></span><small>Nastavit jako majitele</small></button>`).join("")
          || `<div class="vysledek" style="cursor:default"><span class="mutted">Nenalezeno – nového zákazníka založíte v kartě Zákazníci.</span></div>`;
        el.querySelectorAll("button.vysledek").forEach(b => b.onclick = async () => {
          const z = r[+b.dataset.i];
          if (!confirm(`Nastavit ${z.jmeno} jako nového majitele? Dosavadnímu majiteli se vlastnictví ukončí k dnešku.`)) return;
          try {
            await db.zmenitMajitele(id, z.id);            // ukončí dosavadní vlastnictví k dnešku a vytvoří nový odkaz na E-servisku
            hlaska("Majitel změněn."); vozidloDetail(id);
          } catch (err) { hlaska(chybaText(err), true); }
        });
      } catch (err) { el.innerHTML = `<div class="info chyba">${esc(chybaText(err))}</div>`; }
    }, 250); };
  }

  /* ================= můj účet ================= */
  // Můj účet: profil + (pro majitele) Lidé jako podzáložka, odhlášení
  const hlavickaUctu = akt => `
      <div class="hlavicka-prehledu"><h1>Můj účet</h1><button class="tl" id="odhlasit" type="button">Odhlásit</button></div>
      ${uzivatel.role === "majitel" ? `<div class="segment" style="max-width:380px;margin-bottom:16px;background:#e4e9ef"><button type="button" data-zal="#/ucet" aria-pressed="${akt === "ucet"}">Profil</button><button type="button" data-zal="#/lide" aria-pressed="${akt === "lide"}">Lidé</button></div>` : ""}`;
  function navazUcet() {
    app.querySelectorAll("[data-zal]").forEach(b => b.onclick = () => { location.hash = b.dataset.zal; });
    app.querySelector("#odhlasit").onclick = async () => { await db.odhlasit(); uzivatel = null; prihlaseni(); };
  }
  async function ucet() {
    app.innerHTML = `${hlavickaUctu("ucet")}
      <section class="karta"><h2>Údaje</h2>
        <div class="mrizka">
          <label class="pole s3">Jméno (tiskne se na doklady jako „Vyhotovil“)<input id="jmeno" value="${esc(uzivatel.jmeno)}"></label>
          <div class="pole s3"><span>Přihlášení</span><div style="padding:12px 0;font-weight:400;color:var(--text)">${esc(uzivatel.email || "")} · ${uzivatel.role === "majitel" ? "majitel" : "mechanik"}</div></div>
        </div>
        <div class="radek-tlacitek" style="margin-top:12px"><button class="tl" id="ulozit-jmeno">Uložit jméno</button></div>
      </section>
      <section class="karta"><h2>Můj podpis</h2>
        <p class="popis">Doplňuje se do políčka „Vyhotovil“ na zakázkových listech a dalších dokladech.</p>
        <div id="podpis-nahled">${uzivatel.podpis_obrazek ? `<img src="${uzivatel.podpis_obrazek}" alt="Můj podpis" style="max-height:110px;max-width:100%;background:#fff;border:1px solid var(--linka);border-radius:10px;padding:8px">` : `<div class="info pozor">Zatím nemáte uložený podpis.</div>`}</div>
        <div class="podpis-pole" style="margin-top:12px"><canvas id="novy-podpis"></canvas><div class="linka-podpisu"></div><div class="text-podpisu">${uzivatel.podpis_obrazek ? "Nový podpis (nahradí stávající)" : "Podepište se"}</div></div>
        <div class="radek-tlacitek" style="margin-top:10px"><button class="tl tl-male" id="smazat">Smazat</button><button class="tl tl-hlavni" id="ulozit-podpis" disabled>Uložit podpis</button></div>
      </section>
      <section class="karta"><h2>Změna hesla</h2>
        <form id="heslo-f" class="mrizka" autocomplete="on">
          <input type="email" autocomplete="username" value="${esc(uzivatel.email || "")}" hidden>
          <label class="pole s3">Nové heslo (aspoň 10 znaků)<input name="h1" type="password" autocomplete="new-password" minlength="10" required></label>
          <label class="pole s3">Nové heslo znovu<input name="h2" type="password" autocomplete="new-password" minlength="10" required></label>
          <div class="s6"><button class="tl" type="submit">Změnit heslo</button></div>
        </form>
      </section>`;
    navazUcet();
    const pad = new PodpisPad(app.querySelector("#novy-podpis"), { onZmena: ma => (app.querySelector("#ulozit-podpis").disabled = !ma) });
    uklid = () => pad.zrus();
    app.querySelector("#smazat").onclick = () => pad.smazat();
    app.querySelector("#ulozit-podpis").onclick = async () => {
      try { const png = pad.png(); await db.ulozitMujPodpis(uzivatel.id, png); uzivatel.podpis_obrazek = png; hlaska("Podpis uložen."); ucet(); }
      catch (e) { hlaska(chybaText(e), true); }
    };
    app.querySelector("#ulozit-jmeno").onclick = async () => {
      const j = app.querySelector("#jmeno").value.trim();
      if (j.length < 2) return hlaska("Vyplňte jméno.", true);
      try { await db.ulozitMojeJmeno(uzivatel.id, j); uzivatel.jmeno = j; lista(); hlaska("Jméno uloženo."); } catch (e) { hlaska(chybaText(e), true); }
    };
    app.querySelector("#heslo-f").onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      if (f.h1.value !== f.h2.value) return hlaska("Hesla se neshodují.", true);
      try { await db.noveHeslo(f.h1.value); f.reset(); hlaska("Heslo změněno."); } catch (err) { hlaska(chybaText(err), true); }
    };
  }

  /* ================= lidé v dílně (jen majitel) ================= */
  async function lide() {
    if (uzivatel.role !== "majitel") { location.hash = "#/"; return; }
    app.innerHTML = `${hlavickaUctu("lide")}
      <section class="karta"><h2>Kdo má přístup</h2><div class="doklady" id="seznam-lidi"><div class="nacitani">Načítám…</div></div></section>
      <section class="karta"><h2>Přidat člověka</h2>
        <p class="popis">Zadejte jeho e-mail a dočasné heslo, které mu sdělíte. Po prvním přihlášení si ho změní v „Můj účet“.</p>
        <form id="pridat" class="mrizka" autocomplete="off">
          <label class="pole s3"><span class="povinne">Jméno a příjmení</span><input name="jmeno" required minlength="2"></label>
          <label class="pole s3"><span class="povinne">E-mail</span><input name="email" type="email" required inputmode="email" autocomplete="off"></label>
          <label class="pole s3"><span class="povinne">Dočasné heslo (aspoň 10 znaků)</span><input name="heslo" type="text" required minlength="10" autocomplete="off" spellcheck="false"></label>
          <label class="pole s3">Role<select name="role"><option value="mechanik">Mechanik</option><option value="majitel">Majitel</option></select></label>
          <div class="s6"><button class="tl tl-hlavni" type="submit">Přidat</button></div>
        </form>
      </section>`;
    navazUcet();
    const vykresli = async () => {
      const el = app.querySelector("#seznam-lidi");
      try {
        const lidi = await db.uzivatele();
        el.innerHTML = lidi.map(u => `<div class="doklad"><span><b>${esc(u.jmeno)}</b>${u.id === uzivatel.id ? " (vy)" : ""}<br>
            <small class="mutted">${esc(u.email || "")} · ${u.role === "majitel" ? "majitel" : "mechanik"}${u.aktivni ? "" : " · <b style='color:var(--cervena)'>zablokovaný</b>"}</small></span>
          ${u.id === uzivatel.id ? "" : `<span class="radek-tlacitek">
            <button class="tl tl-male" data-heslo="${u.id}">Nové heslo</button>
            <button class="tl tl-male" data-reset2fa="${u.id}" title="Ztratil telefon s ověřovací aplikací – při příštím přihlášení si ji nastaví znovu">Reset ověření</button>
            <button class="tl tl-male ${u.aktivni ? "tl-nebezpecne" : ""}" data-aktivni="${u.id}" data-hodnota="${!u.aktivni}">${u.aktivni ? "Zablokovat" : "Odblokovat"}</button></span>`}</div>`).join("");
        el.querySelectorAll("[data-heslo]").forEach(b => b.onclick = async () => {
          const h = prompt("Nové dočasné heslo (aspoň 10 znaků):"); if (!h) return;
          try { await db.sprava({ akce: "heslo", id: b.dataset.heslo, heslo: h }); hlaska("Heslo nastaveno."); } catch (e) { hlaska(chybaText(e), true); }
        });
        el.querySelectorAll("[data-reset2fa]").forEach(b => b.onclick = async () => {
          if (!confirm("Zrušit ověřovací aplikaci tohoto člověka? Při příštím přihlášení si naskenuje nový QR kód.")) return;
          try { await db.sprava({ akce: "reset2fa", id: b.dataset.reset2fa }); hlaska("Ověření zrušeno – při přihlášení si ho nastaví znovu."); } catch (e) { hlaska(chybaText(e), true); }
        });
        el.querySelectorAll("[data-aktivni]").forEach(b => b.onclick = async () => {
          const aktivni = b.dataset.hodnota === "true";
          if (!aktivni && !confirm("Zablokovat přístup? Člověk se už nepřihlásí; jeho zakázky a doklady zůstanou.")) return;
          try { await db.sprava({ akce: "aktivni", id: b.dataset.aktivni, aktivni }); vykresli(); } catch (e) { hlaska(chybaText(e), true); }
        });
      } catch (e) { el.innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; }
    };
    vykresli();
    app.querySelector("#pridat").onsubmit = async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector("button"); b.disabled = true;
      try {
        await db.sprava({ akce: "pridat", jmeno: f.jmeno.value.trim(), email: f.email.value.trim(), heslo: f.heslo.value, role: f.role.value });
        hlaska(`${f.jmeno.value.trim()} přidán. Pošlete mu adresu aplikace, e-mail a dočasné heslo.`, false, 6000); f.reset(); vykresli();
      } catch (err) { hlaska(chybaText(err), true); } finally { b.disabled = false; }
    };
  }

  /* ================= dvoufázové přihlášení ================= */
  async function druhyKrok(rezim, factorId) {
    lista();
    const nastavit = rezim === "nastavit";
    app.innerHTML = `<div class="prihlaseni"><div class="karta">
      <h1>${nastavit ? "Zabezpečení účtu" : "Ověření kódem"}</h1>
      ${nastavit ? `<p class="popis">Pro přístup k datům dílny je potřeba druhý krok přihlášení. Nastavíte ho jednou: naskenujte QR kód v aplikaci <b>Google Authenticator</b> (nebo Hesla na iPhonu) a opište 6místný kód. Kód pak aplikace chce jednou za 30 dní na každém zařízení.</p>
        <div id="qr" class="mfa-qr"><div class="nacitani">Připravuji…</div></div>`
        : `<p class="popis">Otevřete Google Authenticator a opište 6místný kód pro Werkplaats. Na tomto zařízení se znovu zeptáme za 30 dní.</p>`}
      <form id="f2" autocomplete="off">
        <label class="pole">Kód z aplikace<input name="kod" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="123456" class="mfa-kod"></label>
        <button class="tl tl-hlavni tl-velke" type="submit">${nastavit ? "Dokončit nastavení" : "Ověřit"}</button>
        <button class="tl tl-text" type="button" id="odhlasit2">Odhlásit</button>
        <div id="zprava2"></div>
      </form></div></div>`;
    const f = app.querySelector("#f2"), z = app.querySelector("#zprava2");
    app.querySelector("#odhlasit2").onclick = async () => { try { await db.odhlasit(); } catch (e) { /* offline */ } uzivatel = null; prihlaseni(); };
    if (nastavit) {
      try {
        const e = await db.mfaNastavit(); factorId = e.id;
        app.querySelector("#qr").innerHTML = `<img src="${esc(e.totp.qr_code)}" alt="QR kód pro Google Authenticator" width="200" height="200">
          <a class="tl tl-male jen-telefon" href="${esc(e.totp.uri)}">Otevřít v aplikaci na tomto telefonu</a>
          <details><summary class="napoveda">Nejde naskenovat? Klíč pro ruční zadání</summary><code class="mfa-klic">${esc(String(e.totp.secret).replace(/(.{4})/g, "$1 ").trim())}</code></details>`;
      } catch (e) { app.querySelector("#qr").innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; }
    }
    const pole = f.kod; pole.focus();
    pole.oninput = () => { pole.value = pole.value.replace(/\D/g, "").slice(0, 6); if (pole.value.length === 6) f.requestSubmit(); };
    f.onsubmit = async e => {
      e.preventDefault(); const b = f.querySelector("button[type=submit]"); if (b.disabled) return; b.disabled = true; z.innerHTML = "";
      try { await db.mfaOverit(factorId, pole.value); hlaska(nastavit ? "Druhý krok přihlášení je nastavený." : "Ověřeno."); await start(); }
      catch (err) { z.innerHTML = `<div class="info chyba">${/invalid|expired|code/i.test(chybaText(err)) ? "Kód nesedí nebo už vypršel – opište aktuální kód z aplikace." : esc(chybaText(err))}</div>`; pole.value = ""; pole.focus(); }
      finally { b.disabled = false; }
    };
  }

  /* ================= start ================= */
  async function start() {
    if (obnovaHesla) return prihlaseni();
    if (chybaOdkazu && !start.hotovo) { start.hotovo = true; history.replaceState(null, "", location.pathname); return prihlaseni(chybaOdkazu); }
    let s = null;
    try { s = await db.relace(); } catch (e) { /* offline */ }
    if (!s) { uzivatel = null; return prihlaseni(); }
    // dvoufázové přihlášení: kód z aplikace jednou za 30 dní na každém zařízení
    if (db.mfaStav) {
      let m; try { m = await db.mfaStav(); } catch (e) { return prihlaseni("Nelze se spojit se serverem: " + chybaText(e)); }
      if (!m.overeno) return druhyKrok("nastavit");
      if (m.uroven !== "aal2" || Date.now() - m.naposledy > 30 * 864e5) return druhyKrok("overit", m.overeno.id);
    }
    try {
      const c = await db.clen(s.user.id);
      if (!c || c.aktivni === false) { uzivatel = null; await db.odhlasit(); return prihlaseni(c ? "Tento účet je zablokovaný." : "Tento účet zatím nemá přístup do dílny."); }
      uzivatel = c;
    } catch (e) { return prihlaseni("Nelze se spojit se serverem: " + chybaText(e)); }
    lista();
    navigace();
    setTimeout(() => odeslatFrontu(), 1500);              // neodeslané změny z doby bez signálu
  }
  /* ================= nová verze aplikace ================= */
  // obnovit jen když se zrovna nic nedělá (přehled, seznamy); uprostřed příjmu, faktury nebo podpisu ukázat lištu „Obnovit“
  let obnoveno = false;
  function obnovitKdyzLzeTo() {
    if (!novaVerze || obnoveno) return;
    const klid = ["", "#", "#/", "#/zakazky", "#/zakaznici", "#/vozidla", "#/dily", "#/doklady"].includes(location.hash)
      && !document.querySelector(".prekryv") && !Object.keys(cekajiciUlozeni).length;
    if (klid) { obnoveno = true; window.__OBNOVIT__ ? window.__OBNOVIT__() : location.reload(); return; }
    if (document.getElementById("nova-verze")) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="nova-verze" id="nova-verze" role="status"><span>Je k dispozici nová verze aplikace.</span>
      <button type="button" class="tl tl-male tl-hlavni" id="nova-verze-obnovit">Obnovit</button><button type="button" class="tl tl-male" id="nova-verze-pozdeji" aria-label="Později">✕</button></div>`);
    document.getElementById("nova-verze-obnovit").onclick = async () => { await dokoncitUkladani(); obnoveno = true; window.__OBNOVIT__ ? window.__OBNOVIT__() : location.reload(); };
    document.getElementById("nova-verze-pozdeji").onclick = () => document.getElementById("nova-verze")?.remove();
  }
  window.__TEST_NOVA_VERZE__ = () => { novaVerze = true; obnovitKdyzLzeTo(); };   // jen pro automatické testy

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    // nová verze aplikace převezme stránku → jednou obnovit, ať se hned načte nový kód
    const mel = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (mel) { novaVerze = true; obnovitKdyzLzeTo(); } });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => {
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") r.update().catch(() => {}); });
    }).catch(() => {});
  }
  start();
})();
