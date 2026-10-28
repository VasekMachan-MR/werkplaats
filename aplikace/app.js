/* Werkplaats – dílenská aplikace Mercedes Restorations
   Fáze 1: přihlášení, přehled zakázek, příjem vozu (zákazník → auto → závady → fotky → podpis → zakázkový list 7377-1), detail zakázky. */
(() => {
  "use strict";
  const K = window.WERK_KONFIG;
  const app = document.getElementById("app");

  /* ================= pomocné funkce ================= */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dnes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const plusDni = (d, n) => {                       // "2026-10-28" + 60 → "2026-12-27"
    const [y, m, dd] = String(d).split("-").map(Number); const x = new Date(y, m - 1, dd + n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const DNI_DOKONCENI = 60;                          // předpoklad dokončení = převzetí + 60 dní
  const datumCz = d => { if (!d) return ""; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : d; };
  const kc = n => (n == null || n === "" ? "" : Number(n).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " Kč");
  const cisloZ = s => { const t = String(s ?? "").replace(/\s/g, "").replace(",", "."); return t === "" ? null : Number(t); };
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
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const kos = () => sb.storage.from(K.kos);
    return {
      async relace() { return ok(await sb.auth.getSession()).session; },
      naZmenuPrihlaseni(fn) { sb.auth.onAuthStateChange((_u, s) => fn(s)); },
      async prihlasit(email, heslo) { return ok(await sb.auth.signInWithPassword({ email, password: heslo })); },
      async odhlasit() { await sb.auth.signOut(); },
      async obnovitHeslo(email) { return ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
      async noveHeslo(heslo) { return ok(await sb.auth.updateUser({ password: heslo })); },
      async clen(id) { return ok(await sb.from("uzivatele").select("id,jmeno,role,email,aktivni,podpis_obrazek").eq("id", id).maybeSingle()); },
      async uzivatele() { return ok(await sb.from("uzivatele").select("id,jmeno,role,email,aktivni,vytvoreno").order("vytvoreno")); },
      async ulozitMujPodpis(id, obrazek) { return ok(await sb.from("uzivatele").update({ podpis_obrazek: obrazek }).eq("id", id).select("id")); },
      async ulozitMojeJmeno(id, jmeno) { return ok(await sb.from("uzivatele").update({ jmeno }).eq("id", id).select("id")); },
      async sprava(telo) {                              // serverová funkce: přidat mechanika, heslo, zablokovat, role (jen majitel)
        const { data, error } = await sb.functions.invoke("sprava-uzivatelu", { body: telo });
        if (error) { let m = error.message; try { const j = await error.context.json(); m = j.chyba || m; } catch (e) { /* bez těla */ } throw new Error(m); }
        if (data?.chyba) throw new Error(data.chyba);
        return data;
      },
      async podpisVyhotovil() { const r = ok(await sb.from("nastaveni").select("hodnota").eq("klic", "podpis_vyhotovil").maybeSingle()); return r?.hodnota || null; },
      async dalsiCisloOdhad() { const r = ok(await sb.from("ciselne_rady").select("posledni").eq("rada", "zakazky").maybeSingle()); return r ? r.posledni + 1 : null; },
      async zakazky() {
        return ok(await sb.from("zakazky")
          .select("id,cislo,stav,datum_prijmu,predpoklad_dokonceni,vozidla(typ,model,vin,spz,rok),zakaznici(jmeno,telefon)")
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
          .select("*,vozidla(*),zakaznici(*),doklady(id,druh,cislo,verze,vystaveno,zamceno,pdf_soubor_id,soubory!doklady_pdf_soubor_id_fkey(klic)),soubory!soubory_zakazka_id_fkey(id,druh,faze,klic,nazev,vytvoreno,smazano,doklad_id)")
          .eq("id", id).maybeSingle());
      }
    };
  }
  const db = window.__WERK_DB__ || vytvorDb();
  let uzivatel = null;      // {id, jmeno, role, email, aktivni, podpis_obrazek}

  /* ================= směrování ================= */
  const trasy = [
    [/^#?\/?$/, prehled],
    [/^#\/novy$/, prijem],
    [/^#\/zakazka\/([\w-]+)$/, detail],
    [/^#\/hotovo\/([\w-]+)$/, hotovo],
    [/^#\/ucet$/, ucet],
    [/^#\/lide$/, lide]
  ];
  let uklid = null;
  async function navigace() {
    if (uklid) { try { uklid(); } catch (e) { /* nic */ } uklid = null; }
    if (!uzivatel) return;
    const h = location.hash || "#/";
    for (const [re, fn] of trasy) { const m = h.match(re); if (m) { window.scrollTo(0, 0); return fn(...m.slice(1)); } }
    location.hash = "#/";
  }
  window.addEventListener("hashchange", navigace);

  function lista() {
    const el = document.getElementById("lista-vpravo");
    if (!uzivatel) { el.innerHTML = ""; return; }
    el.innerHTML = `${uzivatel.role === "majitel" ? `<a class="tl tl-male" href="#/lide">Lidé</a>` : ""}
      <a class="tl tl-male uzivatel-tl" href="#/ucet" title="Můj účet">👤 <span>${esc(uzivatel.jmeno)}</span></a>
      <button class="tl tl-male" id="odhlasit">Odhlásit</button>`;
    el.querySelector("#odhlasit").onclick = async () => { await db.odhlasit(); uzivatel = null; prihlaseni(); };
  }

  /* ================= přihlášení ================= */
  function prihlaseni(zprava) {
    lista();
    const obnova = /type=recovery/.test(location.hash);
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
        if (obnova) { await db.noveHeslo(f.heslo.value); history.replaceState(null, "", location.pathname); hlaska("Heslo uloženo."); start(); }
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

  /* ================= přehled zakázek ================= */
  async function prehled() {
    app.innerHTML = `
      <div class="hlavicka-prehledu">
        <h1>Zakázky</h1>
        <a class="tl tl-hlavni tl-velke" href="#/novy">＋ Nový příjem vozu</a>
      </div>
      ${nacti("werk-koncept-prijmu") ? `<div class="info pozor" style="margin:0 0 14px">Máte rozpracovaný příjem. <a href="#/novy"><b>Pokračovat</b></a></div>` : ""}
      <input class="vstup" id="filtr" type="search" placeholder="Hledat: číslo, zákazník, model, VIN, SPZ" style="margin-bottom:14px">
      <div class="zakazky" id="seznam"><div class="nacitani">Načítám zakázky…</div></div>`;
    let data = [];
    try { data = await db.zakazky(); } catch (e) { app.querySelector("#seznam").innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    const vykresli = q => {
      const t = q.trim().toLowerCase();
      const r = data.filter(z => !t || [z.cislo, z.zakaznici?.jmeno, z.zakaznici?.telefon, z.vozidla?.model, z.vozidla?.typ, z.vozidla?.vin, z.vozidla?.spz]
        .some(x => String(x ?? "").toLowerCase().includes(t)));
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
  }

  /* ================= příjem vozu ================= */
  const KONCEPT = "werk-koncept-prijmu";
  function novyPrijem() {
    return {
      zakaznik: { id: null, je_firma: false, jmeno: "", kontaktni_osoba: "", ico: "", dic: "", ulice: "", psc: "", mesto: "", zeme: "Česká Republika", telefon: "", email: "", jazyk: "cs" },
      vozidlo: { vin: "", typ: "", model: "", rok: "", spz: "", barva: "", verze: "EU", jednotka_tachometru: "km" },
      zakazka: { datum_prijmu: dnes(), predpoklad_dokonceni: plusDni(dnes(), DNI_DOKONCENI), km_prijem: "", nadrz_prijem: "1/2", tp_prilozen: true, zavady: [""], stav_prijem: [""], odhad_ceny: "", jazyk: "cs" },
      fotky: [], podpisZakaznik: null, vysledek: null, krok: "formular",
      rucne: { datum: false, dokonceni: false }       // true = datum změněné ručně, pak ho aplikace sama nepřepisuje
    };
  }
  let P = null;               // rozpracovaný příjem
  const blobyFotek = {};      // id fotky → zmenšený soubor (jen v paměti, než se nahraje)
  let posledniPdf = null;     // {zakazka_id, cislo, bytes}

  function ulozKoncept() {
    if (!P) return;
    uloz(KONCEPT, { ...P, fotky: P.fotky.filter(f => f.klic && f.stav === "nahrano") });
    const s = document.getElementById("stav-ulozeni"); if (s) s.textContent = "Rozpracováno – uloženo v iPadu";
    kontrolaPripravenosti();
  }

  function prijem() {
    const koncept = nacti(KONCEPT);
    P = koncept || novyPrijem();
    P.rucne = P.rucne || { datum: false, dokonceni: false };
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
  function seznamRadku(klic, max) {
    return `<div class="seznam-radku" data-seznam="${klic}">${P.zakazka[klic].map((t, i) => `
      <div class="radek-polozky"><span class="tecka">●</span>
        <textarea class="vstup" rows="1" data-radek="${klic}" data-i="${i}" placeholder="${klic === "zavady" ? "Např. Svítí kontrolka ASD" : "Např. Zadní anténa nefunkční"}">${esc(t)}</textarea>
        <button type="button" class="tl smazat" data-smazat="${klic}" data-i="${i}" aria-label="Smazat řádek">×</button></div>`).join("")}
      </div>
      <div class="radek-tlacitek" style="margin-top:10px"><button type="button" class="tl tl-male" data-pridat="${klic}">＋ Přidat řádek</button>
        <span class="napoveda">Na zakázkový list se vejde ${max} řádků (dlouhé položky se zalomí).</span></div>
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
      </section>

      <section class="karta" id="sekce-vozidlo">
        <h2><span class="cislo-kroku">2</span>Vozidlo</h2>
        <div id="auta-zakaznika"></div>
        <div class="mrizka">
          ${pole("vozidlo.vin", "VIN / číslo podvozku", { sirka: "s4", povinne: true, attrs: 'class="vin" autocomplete="off" autocapitalize="characters" spellcheck="false"',
            napoveda: vin ? `Typ ${vin.typ}, kód modelu ${vin.kod}` : "" })}
          ${pole("vozidlo.spz", "SPZ", { sirka: "s2", attrs: 'autocapitalize="characters"' })}
          ${pole("vozidlo.typ", "Typ", { sirka: "s2", attrs: 'placeholder="126"' })}
          ${pole("vozidlo.model", "Model", { sirka: "s2", povinne: true, attrs: 'placeholder="300 SE"' })}
          ${pole("vozidlo.rok", "Rok výroby", { sirka: "s2", attrs: 'inputmode="numeric" placeholder="1989"' })}
          ${pole("vozidlo.barva", "Barva", { sirka: "s2" })}
          <div class="s2"><label class="pole">Verze</label>${segment("vozidlo.verze", [["EU", "EU"], ["US", "US"], ["JP", "JP"]])}</div>
          <div class="s2"><label class="pole">Tachometr</label>${segment("vozidlo.jednotka_tachometru", [["km", "km"], ["mi", "míle"]])}</div>
        </div>
        <div id="info-vin"></div>
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
        <p class="napoveda limity">
          <b>Fotky:</b> libovolný počet, samy se zmenší.<br>
          <b>Video:</b> nejvýš ${MAX_VIDEO_MB} MB na jedno video – to je asi <b>30 s ve Full HD (1080p)</b> nebo <b>15 s ve 4K</b>.
          Delší záběr natočte na víc kratších videí. Tip: v iPadu Nastavení → Fotoaparát → Záznam videa → 1080p.
        </p>
        <div id="souhrn-nahrani"></div>
        <div class="fotky" id="fotky"></div>
      </section>

      <div class="akce-dole"><div class="vnitrek">
        <button type="button" class="tl tl-text tl-nebezpecne" id="zahodit">Zahodit příjem</button>
        <span class="stav-ulozeni" id="stav-ulozeni"></span>
        <button type="button" class="co-chybi" id="co-chybi" hidden></button>
        <button type="button" class="tl tl-hlavni tl-velke" id="k-podpisu" disabled>Náhled a podpis →</button>
      </div></div>`;

    vazbyFormulare();
    vykresliFotky();
    kontrolaPripravenosti();
    if (v.vin) zkontrolujVin(false);
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
    const nahrava = P.fotky.filter(f => f.stav === "nahravam").length, chyba = P.fotky.filter(f => f.stav === "chyba").length;
    if (nahrava) ch.push([`nahrávají se fotky/videa (${nahrava})`, "#sekce-fotky"]);
    if (chyba) ch.push([`nenahrané fotky/videa (${chyba}) – nahrajte znovu nebo odeberte`, "#sekce-fotky"]);
    return ch;
  }
  function kontrolaPripravenosti() {
    const b = document.getElementById("k-podpisu"), info = document.getElementById("co-chybi");
    if (!b || !P) return;
    const ch = coChybi();
    b.disabled = ch.length > 0;
    info.hidden = !ch.length;
    const su = document.getElementById("stav-ulozeni"); if (su) su.hidden = ch.length > 0;
    info.textContent = ch.length ? "Chybí: " + ch.map(c => c[0]).join(", ") : "";
    app.querySelectorAll(".chybi").forEach(e => e.classList.remove("chybi"));
    if (kontrolaPripravenosti.ukazat) ch.forEach(([, sel]) => app.querySelector(sel)?.classList.add("chybi"));
  }

  function nastavHodnotu(cesta, hodnota) { const [o, k] = cesta.split("."); P[o][k] = hodnota; ulozKoncept(); }

  function vazbyFormulare() {
    app.querySelectorAll("[data-pole]").forEach(inp => {
      inp.addEventListener("input", () => {
        let h = inp.value;
        if (inp.dataset.pole === "vozidlo.vin") { h = h.toUpperCase(); }
        nastavHodnotu(inp.dataset.pole, h);
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
        if (["zakaznik.je_firma", "zakaznik.jazyk", "vozidlo.jednotka_tachometru", "vozidlo.verze"].includes(cesta)) { ulozKoncept(); return vykresliFormularZachovatPozici(); }
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
  async function zkontrolujVin(doplnit) {
    const vin = P.vozidlo.vin.replace(/\s/g, ""); const el = app.querySelector("#info-vin"); if (!el || vin.length < 8) return;
    const r = rozlustitVin(vin);
    if (r && !P.vozidlo.typ) { P.vozidlo.typ = r.typ; const t = app.querySelector('[data-pole="vozidlo.typ"]'); if (t) t.value = r.typ; ulozKoncept(); }
    try {
      const a = await db.vozidloPodleVin(vin);
      if (!a) { el.innerHTML = `<div class="info">Nové auto – v systému ho zatím nemáme.</div>`; return; }
      if (doplnit) for (const k of ["typ", "model", "rok", "spz", "barva", "verze", "jednotka_tachometru"]) if (a[k] != null && !String(P.vozidlo[k] || "").trim()) P.vozidlo[k] = String(a[k]);
      const majitele = (a.vlastnictvi || []).filter(x => !x.vlastni_do && x.zakaznici).map(x => x.zakaznici);
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
  function dataZakazkovehoListu(cislo, podpisVyh, podpisZak) {
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
      podpisVyhotovil: podpisVyh || undefined, podpisZakaznik: podpisZak || undefined
    };
  }

  /* Šablonu načte do rámečku, vykreslí a vrátí okno rámečku (pro náhled i pro PDF) */
  async function vykresliSablonu(iframe, sablona, data, jazyk) {
    if (!iframe.dataset.nacteno) {
      await new Promise((ok, chyba) => { iframe.onload = ok; iframe.onerror = chyba; iframe.src = `sablony/${sablona}`; });
      const w = iframe.contentWindow, d = iframe.contentDocument;
      for (const src of ["../vendor/pdf-lib.min.js", "../vendor/fontkit.umd.min.js", "do-pdf.js"]) {
        await new Promise((ok, chyba) => { const s = d.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error("Nelze načíst " + src)); d.head.appendChild(s); });
      }
      iframe.dataset.nacteno = "1";
      if (!w.render) throw new Error("Šablona se nenačetla");
    }
    await iframe.contentWindow.render(data, jazyk);
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
        <button type="button" class="tl" id="zpet">← Upravit údaje</button>
        <span class="stav-ulozeni" id="stav-ulozeni">${P.vysledek ? `Zakázka #${P.vysledek.cislo} je založená – dokončete uložení listu.` : ""}</span>
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
    const obnovNahled = async () => {
      try { await vykresliSablonu(iframe, "zakazkovy-list.html", dataZakazkovehoListu(odhadCisla, podpisVyh(), pad.png()), P.zakazka.jazyk); }
      catch (e) { hlaska("Náhled se nepodařil: " + chybaText(e), true); }
    };
    await obnovNahled();
    app.querySelector("#smazat-podpis").onclick = () => pad.smazat();
    app.querySelector("#zpet").onclick = () => {
      if (P.vysledek) return hlaska("Zakázka už je založená – údaje upravíte v detailu zakázky.", true);
      P.krok = "formular"; ulozKoncept(); vykresliFormular();
    };
    app.querySelector("#ulozit").onclick = async () => {
      if (!vyh && mujPad && !mujPad.prazdny()) {           // nový podpis přihlášeného → uložit do profilu
        try { const png = mujPad.png(); await db.ulozitMujPodpis(uzivatel.id, png); uzivatel.podpis_obrazek = png; }
        catch (e) { return hlaska("Váš podpis se nepodařilo uložit: " + chybaText(e), true); }
      }
      ulozitPrijem(iframe, podpisVyh(), pad.png(), !vyh);
    };
    uklid = () => { window.removeEventListener("resize", meritko); pad.zrus(); mujPad?.zrus(); };
  }

  async function ulozitPrijem(iframe, podpisVyh, podpisZak, vyhPodepsalNaIpadu = false) {
    if (!podpisZak) return hlaska("Chybí podpis zákazníka.", true);
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
        P.vysledek = await db.zalozitZakazku({ zakaznik: z, vozidlo: v, zakazka: k });
        ulozKoncept();
      }
      const { zakazka_id, vozidlo_id, cislo } = P.vysledek;
      // 3) zakázkový list s číslem a podpisy → PDF
      p.text("Vytvářím zakázkový list…");
      const data = dataZakazkovehoListu(cislo, podpisVyh, podpisZak);
      const w = await vykresliSablonu(iframe, "zakazkovy-list.html", data, P.zakazka.jazyk);
      const bytes = await w.dokumentDoPdf(w.document, { nazev: `${P.zakazka.jazyk === "en" ? "Work order" : "Zakázkový list"} ${cislo}-1`, predmet: `${data.vozidlo.typ} ${data.vozidlo.model} · ${data.vozidlo.vin}` });
      const otisk = await w.otiskPdf(bytes);
      // 4) uložit PDF a podpis zákazníka
      p.text("Ukládám PDF…");
      const klicPdf = `zakazky/${cislo}/${cislo}-1-${P.zakazka.jazyk === "en" ? "work-order" : "zakazkovy-list"}.pdf`;
      const klicPodpisu = `zakazky/${cislo}/podpis-zakaznika-${cislo}-1.png`;
      const ignorujDuplicitu = async fn => { try { await fn(); } catch (e) { if (!/exists|Duplicate/i.test(chybaText(e))) throw e; } };
      await ignorujDuplicitu(() => db.nahrat(klicPdf, new Blob([bytes], { type: "application/pdf" }), "application/pdf"));
      await ignorujDuplicitu(() => db.nahrat(klicPodpisu, dataUrlNaBlob(podpisZak), "image/png"));
      const [pdfSoubor, podpisSoubor] = await db.vlozit("soubory", [
        { zakazka_id, vozidlo_id, druh: "pdf", klic: klicPdf, nazev: `${cislo}-1.pdf`, velikost: bytes.length, mime: "application/pdf" },
        { zakazka_id, vozidlo_id, druh: "podpis", faze: "prijem", klic: klicPodpisu, nazev: "podpis zákazníka", mime: "image/png" }
      ]);
      // 5) doklad (zamčený) + podpisy
      const ulozenaData = { ...data }; delete ulozenaData.podpisVyhotovil; delete ulozenaData.podpisZakaznik;
      const [doklad] = await db.vlozit("doklady", [{
        zakazka_id, druh: "zakazkovy_list", verze: 1, cislo: `${cislo}-1`, variabilni_symbol: `${cislo}1`, jazyk: P.zakazka.jazyk,
        vystaveno: P.zakazka.datum_prijmu, data: ulozenaData, pdf_soubor_id: pdfSoubor.id, zamceno: true
      }]);
      await db.upravit("soubory", pdfSoubor.id, { doklad_id: doklad.id });
      await db.vlozit("podpisy", [
        { doklad_id: doklad.id, role: "zakaznik", jmeno: P.zakaznik.jmeno.trim(), zpusob: "ipad", otisk_dokumentu: otisk, obrazek_soubor_id: podpisSoubor.id },
        { doklad_id: doklad.id, role: "vyhotovil", jmeno: uzivatel.jmeno, uzivatel_id: uzivatel.id, zpusob: vyhPodepsalNaIpadu ? "ipad" : "ulozeny", otisk_dokumentu: otisk }
      ]);
      // 6) fotky k zakázce
      if (P.fotky.length) await db.vlozit("soubory", P.fotky.map(f => ({ zakazka_id, vozidlo_id, druh: f.video ? "video" : "foto", faze: "prijem", klic: f.klic, nazev: f.nazev || null, mime: f.mime || "image/jpeg" })));
      posledniPdf = { zakazka_id, cislo, bytes, nazev: `${cislo}-1.pdf` };
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
    app.innerHTML = `<div class="karta hotovo">
      <div class="fajfka">✓</div>
      <div class="mutted">Zakázkový list uložen</div>
      <div class="velke-cislo">${pdf ? `${pdf.cislo}-1` : ""}</div>
      <p class="mutted">PDF je uložené u zakázky. Zákazníkovi ho můžete hned poslat.</p>
      <div class="radek-tlacitek">
        ${pdf ? `<button class="tl tl-hlavni tl-velke" id="sdilet">Poslat / sdílet PDF</button><button class="tl tl-velke" id="otevrit">Otevřít PDF</button>` : ""}
        <a class="tl tl-velke" href="#/zakazka/${id}">Detail zakázky</a>
        <a class="tl tl-velke" href="#/">Přehled</a>
      </div></div>`;
    if (!pdf) return;
    const soubor = new File([pdf.bytes], pdf.nazev, { type: "application/pdf" });
    app.querySelector("#otevrit").onclick = () => window.open(URL.createObjectURL(soubor), "_blank");
    app.querySelector("#sdilet").onclick = async () => {
      if (navigator.canShare && navigator.canShare({ files: [soubor] })) {
        try { await navigator.share({ files: [soubor], title: pdf.nazev }); } catch (e) { /* zrušeno */ }
      } else {
        const a = document.createElement("a"); a.href = URL.createObjectURL(soubor); a.download = pdf.nazev; a.click();
      }
    };
  }

  /* ================= detail zakázky ================= */
  async function detail(id) {
    app.innerHTML = `<div class="nacitani">Načítám zakázku…</div>`;
    let z;
    try { z = await db.detail(id); } catch (e) { app.innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; return; }
    if (!z) { app.innerHTML = `<div class="info chyba">Zakázka nenalezena.</div>`; return; }
    const v = z.vozidla || {}, c = z.zakaznici || {};
    const fotky = (z.soubory || []).filter(s => (s.druh === "foto" || s.druh === "video") && !s.smazano).map(s => ({ ...s, video: s.druh === "video" }));
    const jedn = v.jednotka_tachometru === "mi" ? "mi" : "km";
    app.innerHTML = `
      <div class="hlavicka-prehledu">
        <div><div class="mutted">Zakázka</div><h1 style="margin:0">#${z.cislo} · ${esc([v.typ, v.model].filter(Boolean).join(" ") || "Mercedes-Benz")}</h1></div>
        <span class="stitek">${STAVY[z.stav] || z.stav}</span>
      </div>
      <section class="karta"><h2>Doklady</h2>
        <div class="doklady">${(z.doklady || []).sort((a, b) => a.cislo.localeCompare(b.cislo)).map(d => `
          <div class="doklad"><span><b>${esc(d.cislo)}</b> · ${DRUHY[d.druh] || d.druh}<br><small class="mutted">vystaveno ${datumCz(d.vystaveno)}${d.zamceno ? " · podepsáno, uzamčeno" : ""}</small></span>
            ${d.soubory?.klic ? `<button class="tl tl-male" data-pdf="${esc(d.soubory.klic)}">Otevřít PDF</button>` : ""}</div>`).join("")
          || `<div class="info pozor">Zakázkový list zatím nebyl uložen.</div>`}</div>
        <p class="napoveda" style="margin:12px 0 0">Cenová nabídka, faktura a předávací protokol přibudou v dalším kroku.</p>
      </section>
      <section class="karta"><h2>Vozidlo</h2><dl class="udaje">
        ${[["VIN", v.vin], ["Typ", v.typ], ["Model", v.model], ["Rok", v.rok], ["SPZ", v.spz], ["Barva", v.barva], ["Verze", v.verze],
           ["Tachometr při příjmu", z.km_prijem != null ? `${Number(z.km_prijem).toLocaleString("cs-CZ")} ${jedn}` : ""], ["Nádrž", z.nadrz_prijem], ["TP přiložen", z.tp_prilozen == null ? "" : z.tp_prilozen ? "Ano" : "Ne"]]
          .filter(([, x]) => x != null && x !== "").map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl></section>
      <section class="karta"><h2>Zákazník</h2><dl class="udaje">
        ${[["Jméno", c.jmeno], ["Kontaktní osoba", c.kontaktni_osoba], ["Telefon", c.telefon], ["E-mail", c.email], ["Adresa", [c.ulice, [c.psc, c.mesto].filter(Boolean).join(" "), c.zeme].filter(Boolean).join(", ")], ["IČO", c.ico]]
          .filter(([, x]) => x).map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl></section>
      <section class="karta"><h2>Příjem ${datumCz(z.datum_prijmu)}</h2>
        <dl class="udaje">${z.predpoklad_dokonceni ? `<div><dt>Předpoklad dokončení</dt><dd>${datumCz(z.predpoklad_dokonceni)}</dd></div>` : ""}
          ${z.odhad_ceny != null ? `<div><dt>Odhadovaná cena</dt><dd>${kc(z.odhad_ceny)}</dd></div>` : ""}</dl>
        ${z.zavady?.length ? `<p style="margin:14px 0 0"><b>Závady a objednané opravy</b></p><ul class="odrazky">${z.zavady.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        ${z.stav_prijem?.length ? `<p style="margin:14px 0 0"><b>Stav při převzetí do opravy</b></p><ul class="odrazky">${z.stav_prijem.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      </section>
      <section class="karta"><h2>Fotky a videa${fotky.length ? ` (${popisPoctu(fotky)})` : ""}</h2><div class="fotky" id="fotky-detail"></div></section>`;
    app.querySelectorAll("[data-pdf]").forEach(b => b.onclick = async () => {
      const okno = window.open("", "_blank");
      try { const u = await db.odkaz(b.dataset.pdf, 600); if (okno) okno.location = u; else location.href = u; }
      catch (e) { okno?.close(); hlaska(chybaText(e), true); }
    });
    if (fotky.length) {
      try {
        const odk = await db.odkazy(fotky.map(f => f.klic));
        app.querySelector("#fotky-detail").innerHTML = odk.map((o, i) => fotky[i].video
          ? `<div class="fotka"><video src="${esc(o.signedUrl)}#t=0.5" controls playsinline preload="metadata"></video></div>`
          : `<a class="fotka" href="${esc(o.signedUrl)}" target="_blank" rel="noopener"><img src="${esc(o.signedUrl)}" alt="" loading="lazy"></a>`).join("");
      } catch (e) { app.querySelector("#fotky-detail").innerHTML = `<div class="info chyba">${esc(chybaText(e))}</div>`; }
    }
  }

  /* ================= můj účet ================= */
  async function ucet() {
    app.innerHTML = `
      <h1>Můj účet</h1>
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
    app.innerHTML = `
      <h1>Lidé v dílně</h1>
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
    const vykresli = async () => {
      const el = app.querySelector("#seznam-lidi");
      try {
        const lidi = await db.uzivatele();
        el.innerHTML = lidi.map(u => `<div class="doklad"><span><b>${esc(u.jmeno)}</b>${u.id === uzivatel.id ? " (vy)" : ""}<br>
            <small class="mutted">${esc(u.email || "")} · ${u.role === "majitel" ? "majitel" : "mechanik"}${u.aktivni ? "" : " · <b style='color:var(--cervena)'>zablokovaný</b>"}</small></span>
          ${u.id === uzivatel.id ? "" : `<span class="radek-tlacitek">
            <button class="tl tl-male" data-heslo="${u.id}">Nové heslo</button>
            <button class="tl tl-male ${u.aktivni ? "tl-nebezpecne" : ""}" data-aktivni="${u.id}" data-hodnota="${!u.aktivni}">${u.aktivni ? "Zablokovat" : "Odblokovat"}</button></span>`}</div>`).join("");
        el.querySelectorAll("[data-heslo]").forEach(b => b.onclick = async () => {
          const h = prompt("Nové dočasné heslo (aspoň 10 znaků):"); if (!h) return;
          try { await db.sprava({ akce: "heslo", id: b.dataset.heslo, heslo: h }); hlaska("Heslo nastaveno."); } catch (e) { hlaska(chybaText(e), true); }
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

  /* ================= start ================= */
  async function start() {
    if (/type=recovery/.test(location.hash)) return prihlaseni();
    let s = null;
    try { s = await db.relace(); } catch (e) { /* offline */ }
    if (!s) { uzivatel = null; return prihlaseni(); }
    try {
      const c = await db.clen(s.user.id);
      if (!c || c.aktivni === false) { uzivatel = null; await db.odhlasit(); return prihlaseni(c ? "Tento účet je zablokovaný." : "Tento účet zatím nemá přístup do dílny."); }
      uzivatel = c;
    } catch (e) { return prihlaseni("Nelze se spojit se serverem: " + chybaText(e)); }
    lista();
    navigace();
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  start();
})();
