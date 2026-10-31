// E-serviska: veřejná data servisní knížky podle VIN pro web mercedesrestorations.cz (/e-serviska?vin=…).
// Přístup jen tajným odkazem ?k=… (vozidla.eserviska_kod, Vašek 29.10.2026 – E3); VIN sám nestačí. Při změně majitele se odkaz změní.
// Předchozí majitelé: vidět je historie prací a fotky (bez jmen, dokladů a dílů – E1b); údaje zákazníka jen u současného majitele (C1).
// Jen čtení. Odkazy na soubory jsou podepsané a platí 1 hodinu.
// „Co je příště na řadě“: intervaly z tabulky servisni_intervaly (skupina A/B/C podle roku), případně servisni_intervaly_motoru / servisni_intervaly_paliva, + zaškrtnuté servisní úkony u zakázek.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const POVOLENE = [/^https:\/\/(www\.)?mercedesrestorations\.cz$/, /^https:\/\/[\w-]+\.webflow\.io$/, /^https:\/\/werk\.mercedesrestorations\.cz$/, /^https:\/\/werkplaats\.pages\.dev$/];
const DOKLADY = ["zakazkovy_list", "nabidka", "zalohova", "faktura", "opravny", "predavaci_protokol"];
const PLATNOST = 3600;
const HOTOVO = ["hotovo", "fakturovano", "zaplaceno", "predano"];
const skupina = (v: any) => v.servisni_skupina || (!v.rok ? "A" : v.rok >= 1986 ? "A" : v.rok >= 1981 ? "B" : "C");
const normModel = (t: unknown) => String(t || "").toUpperCase().replace(/\s+/g, " ").trim();
// motor vozu: ruční určení → číslo motoru → typ z VIN → název modelu (tabulky motory, typy_motoru)
function urciMotor(v: any, motory: any[], typy: any[]) {
  const kody = new Set(motory.map(m => m.kod));
  if (v.motor && kody.has(v.motor)) return v.motor;
  const cm = String(v.cislo_motoru || "").toUpperCase().replace(/\s/g, "").match(/^(OM|M)?(\d{3})/);
  if (cm) { const k = (cm[1] || (cm[2][0] === "6" ? "OM" : "M")) + cm[2]; if (kody.has(k)) return k; }
  const t = Object.fromEntries(typy.map(x => [normModel(x.klic), x.motor]));
  const vk = String(v.vin || "").toUpperCase().match(/^(?:WDB)?(\d{3})(\d{3})/);
  if (vk && t[vk[1] + "." + vk[2]]) return t[vk[1] + "." + vk[2]];
  return t[normModel(v.model)] || null;
}
// druh převodovky z údajů vozidla (Vašek 31.10.2026): kód 722 / „automat…“ = automat, 711–717 / „manuál…“ = manuál, jinak SA kód 420/421
function druhPrevodovky(v: any) {
  const p = String(v?.prevodovka || "").toLowerCase().replace(/\s/g, "");
  if (/^722|automat/.test(p)) return "automat";
  if (/^71[1-7]|manu|ručn|rucn/.test(p)) return "manual";
  const k = Array.isArray(v?.kody_vybavy) ? v.kody_vybavy : [];
  if (k.some((x: any) => /^42[01]$/.test(String(x?.kod || "").trim()) || /automatic transmission|automatikgetriebe/i.test(String(x?.popis || "")))) return "automat";
  return null;
}
const plusMesice = (d: string, m: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

function hlavicky(origin: string | null) {
  const h: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin" };
  if (origin && POVOLENE.some(r => r.test(origin))) { h["access-control-allow-origin"] = origin; h["access-control-allow-methods"] = "GET, POST, OPTIONS"; h["access-control-allow-headers"] = "content-type"; }
  return h;
}

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: hlavicky(origin) });
  const odp = (s: number, o: unknown) => new Response(JSON.stringify(o), { status: s, headers: hlavicky(origin) });
  if (req.method !== "GET" && req.method !== "POST") return odp(405, { chyba: "jen GET/POST" });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (req.method === "POST") return podepsat(req, sb, odp);   // (archiv: podepsatArchiv)

  const kod = (new URL(req.url).searchParams.get("k") || "").replace(/[^0-9a-zA-Z_-]/g, "");
  if (kod.length < 16 || kod.length > 40) return odp(403, { chyba: "potreba-odkaz" });
  const { data: v } = await sb.from("vozidla")
    .select("id,vin,spz,znacka,typ,model,rok,mesic,verze,cislo_motoru,prevodovka,barva,rafky,pneu_letni,pneu_zimni,sady_kol,kody_vybavy,km_posledni,jednotka_tachometru,servisni_skupina,motor,eserviska_kod")
    .eq("eserviska_kod", kod).maybeSingle();
  if (!v) return odp(404, { chyba: "nenalezeno" });

  const sk = skupina(v);
  const [{ data: vl }, { data: zak }, { data: tp }, { data: intervaly }, { data: motory }, { data: typy }, { data: ukony }, { data: intMot }, { data: intPal }, { data: prof }] = await Promise.all([
    sb.from("vlastnictvi").select("zakaznik_id,vlastni_od,vlastni_do,zakaznici(jmeno,kontaktni_osoba,email,telefon)").eq("vozidlo_id", v.id).order("vlastni_od", { ascending: false }),
    sb.from("zakazky").select("id,cislo,stav,zakaznik_id,datum_prijmu,datum_predani,km_prijem,km_predani,zavady,servisni_ukony,ukoly,poznamky").eq("vozidlo_id", v.id).neq("stav", "zruseno").neq("stav", "poptavka").order("datum_prijmu", { ascending: false }),
    sb.from("soubory").select("klic,nazev,mime,vytvoreno").eq("vozidlo_id", v.id).eq("druh", "tp").eq("verejne", true).is("smazano", null).order("vytvoreno"),
    sb.from("servisni_intervaly").select("ukon,poradi,interval_km,interval_mesice,zdroj").eq("skupina", sk).order("poradi"),
    sb.from("motory").select("kod,palivo,serizovani_ventilu"),
    sb.from("typy_motoru").select("klic,motor"),
    sb.from("servisni_ukony").select("ukon,jen_palivo,jen_serizovani_ventilu,jen_prevodovka"),
    sb.from("servisni_intervaly_motoru").select("motor,ukon,interval_km,interval_mesice,zdroj"),
    sb.from("servisni_intervaly_paliva").select("palivo,ukon,rok_od,rok_do,krome_typu,interval_km,interval_mesice,zdroj").eq("skupina", sk),
    // profilové fotky patří k autu – ze všech návštěv, i ze smazaných / zrušených zakázek (Vašek 30.10.2026)
    sb.from("soubory").select("klic,verejne,vytvoreno").eq("vozidlo_id", v.id).eq("druh", "foto").eq("faze", "profil").is("smazano", null).order("vytvoreno")
  ]);
  const motor = urciMotor(v, motory || [], typy || []), mInfo = (motory || []).find(m => m.kod === motor);
  const palivo = mInfo ? mInfo.palivo : /\b\d{3}\s*(D|TD|SD|CD|SDL)\b/i.test(v.model || "") ? "diesel" : "benzin";
  // převodovka neurčená → olej automatu ani manuálu se zákazníkovi neukazuje (nic nepravdivého); kdo úkon zaškrtl, tomu se ukáže vždy
  const prevodovka = druhPrevodovky(v), zaskrtnute = new Set((zak || []).flatMap(z => z.servisni_ukony || []));
  const platne = new Set((ukony || []).filter(u => zaskrtnute.has(u.ukon) || ((!u.jen_palivo || u.jen_palivo === palivo) && (!u.jen_serizovani_ventilu || mInfo?.serizovani_ventilu) && (!u.jen_prevodovka || u.jen_prevodovka === prevodovka))).map(u => u.ukon));
  const aktualni = (vl || []).find(x => !x.vlastni_do) || null;
  // TP je u auta, ale je na něm jméno majitele → jen současnému majiteli a jen nahraný za jeho vlastnictví
  const tpVidi = (tp || []).filter((f: any) => aktualni && (!aktualni.vlastni_od || String(f.vytvoreno || "").slice(0, 10) >= String(aktualni.vlastni_od)));
  const ids = (zak || []).map(z => z.id);

  // co je příště na řadě
  const mil = v.jednotka_tachometru === "mi", naJed = (km: number | null) => km == null ? null : mil ? Math.round(km / 1.6 / 100) * 100 : km;
  const dnes = new Date().toISOString().slice(0, 10), za60 = plusMesice(dnes, 2);
  // zaškrtnutý servisní úkon platí hned – i když je vůz ještě v dílně (Vašek 31.10.2026: „zaškrtnu olej a v E-servisce se objeví V pořádku“)
  const hotove = (zak || []).filter(z => (z.servisni_ukony || []).length).sort((a, b) => String(b.datum_predani || b.datum_prijmu).localeCompare(String(a.datum_predani || a.datum_prijmu)));
  // interval podle motoru přebíjí interval podle paliva (diesel), ten přebíjí interval skupiny (047, Vašek 31.10.2026)
  const typVin = (() => { const m = String(v.vin || "").toUpperCase().match(/^(?:WDB)?(\d{3})(\d{3})/); return m ? m[1] + "." + m[2] : null; })();
  const podlePaliva = (ukon: string) => (intPal || []).find((x: any) => x.ukon === ukon && x.palivo === palivo
    && (x.rok_od == null || (v.rok != null && v.rok >= x.rok_od)) && (x.rok_do == null || (v.rok != null && v.rok <= x.rok_do))
    && !(typVin && (x.krome_typu || []).includes(typVin)));
  const servis = (intervaly || []).filter(it => platne.has(it.ukon)).map(it => (intMot || []).find(x => x.motor === motor && x.ukon === it.ukon) || podlePaliva(it.ukon) || it).map(it => {
    const z = hotove.find(x => (x.servisni_ukony || []).includes(it.ukon));
    const interval = naJed(it.interval_km);
    if (!z) return { ukon: it.ukon, interval_km: interval, interval_mesice: it.interval_mesice, zdroj: it.zdroj, posledni: null, pristi: null, stav: "nezname" };
    const datum = z.datum_predani || z.datum_prijmu, km = z.km_prijem ?? z.km_predani ?? null;   // km se zapisují při převzetí (F4)
    const pDatum = it.interval_mesice ? plusMesice(datum, it.interval_mesice) : null, pKm = interval != null && km != null ? km + interval : null;
    const nyni = v.km_posledni;
    const po = (pDatum && pDatum <= dnes) || (pKm != null && nyni != null && nyni >= pKm);
    const brzy = (pDatum && pDatum <= za60) || (pKm != null && nyni != null && nyni >= pKm - Math.min(1500, Math.round(interval! / 10)));
    return { ukon: it.ukon, interval_km: interval, interval_mesice: it.interval_mesice, zdroj: it.zdroj,
      posledni: { datum, km, cislo: z.cislo }, pristi: { datum: pDatum, km: pKm }, stav: po ? "po" : brzy ? "brzy" : "ok" };
  });
  // nejnaléhavější nahoře: Po termínu → Brzy → V pořádku → Nezaznamenáno (v rámci skupiny pořadí z manuálu) – Vašek 31.10.2026
  const NALEH: Record<string, number> = { po: 0, brzy: 1, ok: 2, nezname: 3 };
  servis.sort((a, b) => NALEH[a.stav] - NALEH[b.stav]);
  // Werkplaats (sekce Servisní úkony) chce jen tenhle seznam – stejný jako v E-servisce (Vašek 31.10.2026)
  if (new URL(req.url).searchParams.get("jen") === "servis") return odp(200, { servis, servis_skupina: sk, motor, palivo, prevodovka });


  const [{ data: pol }, { data: dily }, { data: dok }, { data: soub }] = ids.length ? await Promise.all([
    sb.from("polozky").select("zakazka_id,poradi,typ,popis,poznamka").in("zakazka_id", ids).is("nabidka_id", null).in("typ", ["prace", "pausal", "nadpis"]).order("poradi"),
    sb.from("dily").select("zakazka_id,poradi,nazev,cislo_mb,vyrobce,mnozstvi,jednotka,stav").in("zakazka_id", ids).neq("stav", "nepouzito").order("poradi"),
    sb.from("doklady").select("id,zakazka_id,druh,cislo,verze,vystaveno,jazyk,pdf_soubor_id,data,soubory!doklady_pdf_soubor_id_fkey(klic),podpisy(role),dalkove_podpisy!dalkove_podpisy_doklad_id_fkey(podepsano)").in("zakazka_id", ids).eq("zamceno", true).in("druh", DOKLADY).order("verze", { ascending: false }),
    sb.from("soubory").select("id,zakazka_id,doklad_id,druh,faze,klic,nazev,mime,vytvoreno,verejne,podpis_pozadan,podepsany_z").in("zakazka_id", ids).in("druh", ["foto", "video", "pdf", "archiv"]).is("smazano", null).order("vytvoreno")
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  // podepsané odkazy najednou
  const klice = new Set<string>();
  tpVidi.forEach((f: any) => klice.add(f.klic));
  (prof || []).forEach((f: any) => { if (f.verejne !== false) klice.add(f.klic); });
  (soub || []).forEach(f => { if (f.druh === "pdf" || f.verejne !== false || (f.druh === "archiv" && f.podpis_pozadan)) klice.add(f.klic); });
  (dok || []).forEach(d => (d as any).soubory?.klic && klice.add((d as any).soubory.klic));
  const url: Record<string, string> = {};
  if (klice.size) {
    const { data: podp } = await sb.storage.from("soubory").createSignedUrls([...klice], PLATNOST);
    (podp || []).forEach(p => { if (p.path && p.signedUrl) url[p.path] = p.signedUrl; });
  }

  const navstevy = (zak || []).map(z => {
    const vlastni = !!aktualni && z.zakaznik_id === aktualni.zakaznik_id;   // doklady a díly předchozího majitele se neukazují
    const posledni: Record<string, any> = {};
    (dok || []).filter(d => d.zakazka_id === z.id).forEach(d => { if (!posledni[d.druh]) posledni[d.druh] = d; });
    const dokumenty = vlastni ? Object.values(posledni).map((d: any) => ({ druh: d.druh, cislo: d.cislo, vystaveno: d.vystaveno, url: url[d.soubory?.klic] || null })).filter(d => d.url) : [];
    // parts list až s vystavenou fakturou (u nabídky ani během prací ne) – Vašek 30.10.2026
    if (vlastni && posledni.faktura) (soub || []).filter(f => f.zakazka_id === z.id && f.druh === "pdf" && /parts.list/i.test(f.nazev || "") && f.doklad_id === posledni.faktura.id)
      .forEach(f => dokumenty.push({ druh: "parts_list", cislo: f.nazev, vystaveno: null, url: url[f.klic] || null }));
    // E5: původní doklady ze starého systému (archiv) – jen ty, které jsou označené 👁
    // původní PDF, ke kterému už existuje podepsaná kopie (…_signed.pdf), se nezobrazuje – místo něj je podepsaná
    if (vlastni) (soub || []).filter(f => f.zakazka_id === z.id && f.druh === "archiv" && f.verejne !== false && url[f.klic] && !(soub || []).some(g => g.podepsany_z === f.id)).forEach(f => {
      const n = f.nazev || "", druh = /^(zak[aá]zkov|work[ _]order)/i.test(n) ? "zakazkovy_list" : /^parts[ _]list/i.test(n) ? "parts_list"
        : /^p[řr]ed[aá]vac/i.test(n) ? "predavaci_protokol" : /^(invoice|faktura)[ _]/i.test(n) ? "faktura" : "puvodni";
      dokumenty.push({ druh, cislo: null, nazev: n.replace(/\.pdf$/i, ""), puvodni: true, vystaveno: null, url: url[f.klic] });
    });
    return {
      cislo: z.cislo, stav: z.stav, predchozi_majitel: !vlastni, servisni_ukony: z.servisni_ukony || [], datum_prijmu: z.datum_prijmu, datum_predani: z.datum_predani, km_prijem: z.km_prijem, km_predani: z.km_predani,
      // postup opravy: zákazník vidí jen kolik je hotovo, ne text odrážek
      postup: !vlastni ? null : (() => { const u = (Array.isArray(z.ukoly) ? z.ukoly : []).filter((x: any) => String(x?.t || "").trim()); return u.length ? { hotovo: u.filter((x: any) => x.h).length, celkem: u.length } : null; })(),
      zavady: (z.zavady || []).filter(Boolean),
      prace: (pol || []).filter(p => p.zakazka_id === z.id && p.popis).map(p => (p.poznamka ? { typ: p.typ, popis: p.popis, poznamka: p.poznamka } : { typ: p.typ, popis: p.popis })),   // poznámka k úkonu → modré „i“ (Vašek 31.10.2026)
      poznamky: String(z.poznamky || "").trim() || null,   // poznámky k zakázce = záznam v servisní knížce, vidí je i další majitelé
      dily: !vlastni ? [] : (dily || []).filter(d => d.zakazka_id === z.id).map(d => ({ nazev: d.nazev, cislo_mb: d.cislo_mb, vyrobce: d.vyrobce, mnozstvi: d.mnozstvi, jednotka: d.jednotka })),
      fotky: (soub || []).filter(f => f.zakazka_id === z.id && (f.druh === "foto" || f.druh === "video") && f.faze !== "profil" && f.verejne !== false && url[f.klic]).map(f => ({ url: url[f.klic], video: f.druh === "video", faze: f.faze })),
      dokumenty
    };
  });


  // doklad čekající na podpis zákazníka (jen současný majitel): zakázkový list (poslední verze, rozpracovaná zakázka)
  // nebo faktura / zálohová faktura vystavená s „Podepíše později“ (Vašek 30.10.2026 – i u hotové zakázky)
  let podpis: any = null;
  const ceka = (d: any) => d && d.data?.cekaPodpis && !(d.podpisy || []).some((x: any) => x.role === "zakaznik")
    && !(Array.isArray(d.dalkove_podpisy) ? d.dalkove_podpisy[0] : d.dalkove_podpisy);   // už podepsáno – podepsané PDF je rovnou v Dokumentech k návštěvě
  for (const z of (zak || [])) {
    if (!aktualni || z.zakaznik_id !== aktualni.zakaznik_id) continue;
    const zl = HOTOVO.includes(z.stav) ? null : (dok || []).filter((d: any) => d.zakazka_id === z.id && d.druh === "zakazkovy_list")[0] as any;
    // cenová nabídka s „Podepíše později“ (Vašek 31.10.2026): jen poslední verze a jen u rozpracované zakázky
    const nb = HOTOVO.includes(z.stav) ? null : (dok || []).filter((x: any) => x.zakazka_id === z.id && x.druh === "nabidka")[0] as any;
    // předávací protokol s „Podepíše později“ (Vašek 31.10.2026): jen poslední protokol, i u předané zakázky
    const pp = (dok || []).filter((x: any) => x.zakazka_id === z.id && x.druh === "predavaci_protokol")[0] as any;
    const d = ceka(zl) ? zl : ((dok || []).find((x: any) => x.zakazka_id === z.id && (x.druh === "faktura" || x.druh === "zalohova") && ceka(x)) as any) || (ceka(nb) ? nb : null) || (ceka(pp) ? pp : null);
    if (!d) continue;
    podpis = { cislo: d.cislo, druh: d.druh, zakazka: z.cislo, url: url[d.soubory?.klic] || null, podepsano: null, jazyk: d.jazyk || null };
    break;
  }
  // starý zakázkový list (PDF v Ostatních dokumentech), který dílna poslala k podpisu a ještě nemá podepsanou kopii
  if (!podpis && aktualni) {
    const mojeZak = new Set((zak || []).filter(z => z.zakaznik_id === aktualni.zakaznik_id).map(z => z.id));
    const a = (soub || []).find(f => f.druh === "archiv" && f.podpis_pozadan && mojeZak.has(f.zakazka_id) && /\.pdf$/i.test(f.klic) && !(soub || []).some(g => g.podepsany_z === f.id));
    if (a) podpis = { cislo: String((zak || []).find(z => z.id === a.zakazka_id)?.cislo || ""), archiv: a.id, url: url[a.klic] || null, podepsano: null };
  }

  const { id: _id, servisni_skupina: _s, motor: _m, eserviska_kod: _k, ...vuz } = v;
  return odp(200, {
    vuz,
    zakaznik: aktualni?.zakaznici || null,
    tp: tpVidi.filter((f: any) => url[f.klic]).map(f => ({ nazev: f.nazev, url: url[f.klic], pdf: f.mime === "application/pdf" })),
    // profilové fotky auta (nahoře vpravo) – jen fotky označené ⭐, nejnovější první; servisní fotky jsou jen u návštěv
    profil: (prof || []).filter((f: any) => f.verejne !== false && url[f.klic]).reverse().map((f: any) => url[f.klic]),
    navstevy, podpis,
    servis, servis_skupina: sk, motor, palivo, prevodovka,
    platnost_odkazu_s: PLATNOST
  });
});

// POST {k, cislo, druh?, podpis: "data:image/png;base64,…", souhlas: true} – zákazník dopodepíše zakázkový list / nabídku / fakturu / předávací protokol z domu
async function podepsat(req: Request, sb: any, odp: (s: number, o: unknown) => Response) {
  let b: any; try { b = await req.json(); } catch { return odp(400, { chyba: "spatny-pozadavek" }); }
  const kod = String(b?.k || "").replace(/[^0-9a-zA-Z_-]/g, "");
  if (kod.length < 16 || kod.length > 40) return odp(403, { chyba: "potreba-odkaz" });
  if (b?.souhlas !== true) return odp(400, { chyba: "chybi-souhlas" });
  const png = String(b?.podpis || "");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) || png.length > 400000 || png.length < 200) return odp(400, { chyba: "spatny-podpis" });
  const { data: v } = await sb.from("vozidla").select("id").eq("eserviska_kod", kod).maybeSingle();
  if (!v) return odp(404, { chyba: "nenalezeno" });
  if (b?.archiv) return podepsatArchiv(req, sb, odp, v, String(b.archiv), png);
  const druh = ["faktura", "zalohova", "nabidka", "predavaci_protokol"].includes(b?.druh) ? b.druh : "zakazkovy_list";
  const jenPosledni = druh === "zakazkovy_list" || druh === "nabidka" || druh === "predavaci_protokol";   // podepsat jde jen poslední verzi
  const jenRozpracovana = druh === "zakazkovy_list" || druh === "nabidka";   // protokol se podepisuje u už předané zakázky
  const { data: d } = await sb.from("doklady").select("id,cislo,druh,verze,data,zakazka_id,zamceno,zakazky!inner(id,cislo,stav,vozidlo_id,zakaznik_id),podpisy(role),dalkove_podpisy!dalkove_podpisy_doklad_id_fkey(id)")
    .eq("cislo", String(b?.cislo || "")).eq("druh", druh).maybeSingle();
  if (!d || !d.zamceno || d.zakazky?.vozidlo_id !== v.id || !d.data?.cekaPodpis || (jenRozpracovana && HOTOVO.includes(d.zakazky.stav))) return odp(404, { chyba: "nenalezeno" });
  // zakázkový list: podepsat jde jen poslední verzi (tu, kterou zákazník v E-servisce vidí)
  if (jenPosledni) {
    const { data: novejsi } = await sb.from("doklady").select("id").eq("zakazka_id", d.zakazka_id).eq("druh", druh).gt("verze", d.verze ?? 1).limit(1);
    if (novejsi?.length) return odp(404, { chyba: "nenalezeno" });
  }
  const { data: maj } = await sb.from("vlastnictvi").select("zakaznik_id").eq("vozidlo_id", v.id).is("vlastni_do", null).maybeSingle();
  if (!maj || maj.zakaznik_id !== d.zakazky.zakaznik_id) return odp(404, { chyba: "nenalezeno" });
  if ((d.podpisy || []).some((x: any) => x.role === "zakaznik") || (Array.isArray(d.dalkove_podpisy) ? d.dalkove_podpisy.length : d.dalkove_podpisy)) return odp(409, { chyba: "uz-podepsano" });
  const bin = Uint8Array.from(atob(png.split(",")[1]), c => c.charCodeAt(0));
  const klic = `zakazky/${d.zakazky.cislo}/eserviska-${Date.now().toString(36)}/podpis-zakaznika-${d.cislo}.png`;
  const { error: eu } = await sb.storage.from("soubory").upload(klic, bin, { contentType: "image/png", upsert: false });
  if (eu) return odp(500, { chyba: "ulozeni" });
  const { data: sf, error: es } = await sb.from("soubory").insert({ zakazka_id: d.zakazka_id, vozidlo_id: v.id, druh: "podpis", klic, nazev: "podpis zákazníka (E-serviska)", mime: "image/png", velikost: bin.length, verejne: false }).select("id").single();
  if (es) { await sb.storage.from("soubory").remove([klic]); return odp(500, { chyba: "ulozeni" }); }
  // nejdřív si podpis „zabrat“ (dalkove_podpisy má unikátní doklad_id): když přijdou dva podpisy naráz (dvě okna, opakované
  // odeslání), druhý tady skončí a do PDF se razítkuje jen jednou (noční kontrola 31.10.2026). IP adresa se neukládá (Vašek 30.10.2026).
  const { data: dp, error: ed } = await sb.from("dalkove_podpisy").insert({ doklad_id: d.id, soubor_id: sf.id, ip: null, zarizeni: (req.headers.get("user-agent") || "").slice(0, 300), vystaveny_doklad_id: null }).select("id").single();
  if (ed || !dp) { await sb.from("soubory").delete().eq("id", sf.id); await sb.storage.from("soubory").remove([klic]); return odp(409, { chyba: "uz-podepsano" }); }
  // podpis se rovnou vloží do PDF zakázkového listu (políčko „Převzal“) a PDF dokladu se nahradí podepsaným – dílna nic „nevystavuje“ (Vašek 30.10.2026)
  let nahrazeno = false;
  try { nahrazeno = await vlozitPodpisDoDokladu(sb, d, v, bin); } catch (_) { nahrazeno = false; }
  if (nahrazeno) await sb.from("dalkove_podpisy").update({ vystaveny_doklad_id: d.id }).eq("id", dp.id);
  // podepsaný zakázkový list + VOP hned zákazníkovi e-mailem (Vašek 31.10.2026) – na pozadí, podpis tím nečeká
  if (druh === "zakazkovy_list" && nahrazeno) {
    const odeslat = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/odeslat-email`, {
      method: "POST", headers: { "content-type": "application/json", "x-werk-interni": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
      body: JSON.stringify({ doklad_id: d.id })
    }).catch(() => {});
    // @ts-ignore EdgeRuntime existuje jen v Supabase
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(odeslat); else await odeslat;
  }
  upozornit({ zakazka_id: d.zakazka_id, druh, cislo: d.cislo });
  return odp(200, { ok: true, email: druh === "zakazkovy_list" });
}

// notifikace na telefon dílně (Vašek 31.10.2026) – na pozadí, podpis tím nečeká; chyba notifikace podpis nikdy nezastaví
function upozornit(o: { zakazka_id: string; druh: string; cislo: string | null }) {
  const p = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notifikace`, {
    method: "POST", headers: { "content-type": "application/json", "x-werk-interni": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
    body: JSON.stringify({ udalost: "podpis", ...o })
  }).catch(() => {});
  // @ts-ignore EdgeRuntime existuje jen v Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
}

// podpis zákazníka do PDF (stránka 1, políčko „Převzal“ nad tečkami – stejné místo v šabloně i ve starých listech z Excelu)
// faktura / zálohová faktura / cenová nabídka: políčko „Převzal“ je o kousek jinde (šablona faktura.js: obrázek left 200 top 707 w 115, tečky 730.2)
const POLE_PODPISU: Record<string, { x: number; top: number; w: number; stred: number; text: number }> = {
  zakazkovy_list: { x: 199, top: 706.9, w: 122, stred: 259.7, text: 734.6 },
  faktura: { x: 200, top: 707, w: 115, stred: 256.8, text: 735.6 }
};
async function razitkoPodpisu(pdfBytes: Uint8Array, png: Uint8Array, en: boolean, druh = "zakazkovy_list"): Promise<Uint8Array> {
  const P = POLE_PODPISU[druh === "zakazkovy_list" || druh === "predavaci_protokol" ? "zakazkovy_list" : "faktura"];   // protokol = stejná šablona jako zakázkový list
  const pdf = await PDFDocument.load(pdfBytes);
  const str = pdf.getPage(0), H = str.getHeight();
  const obr = await pdf.embedPng(png), box = { x: P.x, y: H - P.top - 30, w: P.w, h: 30 };
  const m = Math.min(box.w / obr.width, box.h / obr.height), w = obr.width * m, h = obr.height * m;
  str.drawImage(obr, { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, width: w, height: h });
  const kdy = new Date().toLocaleString(en ? "en-GB" : "cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const txt = (en ? "Signed online (e-service book) " : "Podepsáno online v E-servisce ") + kdy;
  const font = await pdf.embedFont(StandardFonts.Helvetica), vel = 5.2;
  str.drawText(txt, { x: P.stred - font.widthOfTextAtSize(txt, vel) / 2, y: H - P.text, size: vel, font, color: rgb(0.2, 0.2, 0.2) });
  return await pdf.save();
}

// nový zakázkový list / faktura: podepsané PDF nahradí původní (číslo dokladu zůstává, nepodepsané PDF se skryje)
async function vlozitPodpisDoDokladu(sb: any, d: any, v: any, png: Uint8Array): Promise<boolean> {
  const { data: ps } = await sb.from("doklady").select("pdf_soubor_id,jazyk,soubory!doklady_pdf_soubor_id_fkey(id,klic,nazev,verejne)").eq("id", d.id).maybeSingle();
  const stary = ps?.soubory; if (!stary?.klic) return false;
  const { data: orig, error: eo } = await sb.storage.from("soubory").download(stary.klic);
  if (eo || !orig) return false;
  const pdfBin = await razitkoPodpisu(new Uint8Array(await orig.arrayBuffer()), png, ps.jazyk === "en", d.druh);
  const klicPdf = `zakazky/${d.zakazky.cislo}/doklady/${d.cislo}-podepsany-${Date.now().toString(36)}.pdf`;
  const { error: eu } = await sb.storage.from("soubory").upload(klicPdf, pdfBin, { contentType: "application/pdf", upsert: false });
  if (eu) return false;
  const { data: novy, error: ei } = await sb.from("soubory").insert({ zakazka_id: d.zakazka_id, vozidlo_id: v.id, doklad_id: d.id, druh: "pdf", klic: klicPdf, nazev: stary.nazev, mime: "application/pdf", velikost: pdfBin.length, verejne: stary.verejne !== false }).select("id").single();
  if (ei || !novy) { await sb.storage.from("soubory").remove([klicPdf]); return false; }
  const { error: ed } = await sb.from("doklady").update({ pdf_soubor_id: novy.id }).eq("id", d.id);
  if (ed) { await sb.from("soubory").delete().eq("id", novy.id); await sb.storage.from("soubory").remove([klicPdf]); return false; }
  await sb.from("soubory").update({ smazano: new Date().toISOString() }).eq("id", stary.id);   // nepodepsaná verze zmizí z aplikace i E-servisky
  return true;
}

// Starý zakázkový list (PDF z Excelu v Ostatních dokumentech): podpis se vloží do políčka „Převzal“ nad tečky
// a uloží se jako nová kopie …_signed.pdf vedle originálu (originál zůstává beze změny).
async function podepsatArchiv(req: Request, sb: any, odp: (s: number, o: unknown) => Response, v: any, id: string, png: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return odp(400, { chyba: "spatny-pozadavek" });
  const { data: f } = await sb.from("soubory").select("id,klic,nazev,zakazka_id,druh,podpis_pozadan,smazano,zakazky!inner(id,cislo,vozidlo_id,zakaznik_id)").eq("id", id).maybeSingle();
  if (!f || f.druh !== "archiv" || !f.podpis_pozadan || f.smazano || f.zakazky?.vozidlo_id !== v.id || !/\.pdf$/i.test(f.klic)) return odp(404, { chyba: "nenalezeno" });
  const { data: maj } = await sb.from("vlastnictvi").select("zakaznik_id").eq("vozidlo_id", v.id).is("vlastni_do", null).maybeSingle();
  if (!maj || maj.zakaznik_id !== f.zakazky.zakaznik_id) return odp(404, { chyba: "nenalezeno" });
  const { data: uz } = await sb.from("soubory").select("id").eq("podepsany_z", f.id).is("smazano", null).limit(1);
  if (uz?.length) return odp(409, { chyba: "uz-podepsano" });

  const bin = Uint8Array.from(atob(png.split(",")[1]), c => c.charCodeAt(0));
  const { data: orig, error: eo } = await sb.storage.from("soubory").download(f.klic);
  if (eo || !orig) return odp(500, { chyba: "ulozeni" });
  let pdfBin: Uint8Array;
  try { pdfBin = await razitkoPodpisu(new Uint8Array(await orig.arrayBuffer()), bin, /^work[ _]order/i.test(f.nazev || "")); }
  catch (_) { return odp(500, { chyba: "pdf" }); }

  const zn = Date.now().toString(36), cislo = f.zakazky.cislo;
  const klicPodpis = `zakazky/${cislo}/eserviska-${zn}/podpis-zakaznika-archiv.png`, klicPdf = `archiv/${cislo}/${crypto.randomUUID()}.pdf`;
  const { error: e1 } = await sb.storage.from("soubory").upload(klicPodpis, bin, { contentType: "image/png", upsert: false });
  if (e1) return odp(500, { chyba: "ulozeni" });
  const { error: e2 } = await sb.storage.from("soubory").upload(klicPdf, pdfBin, { contentType: "application/pdf", upsert: false });
  if (e2) { await sb.storage.from("soubory").remove([klicPodpis]); return odp(500, { chyba: "ulozeni" }); }
  const nazev = String(f.nazev || "Zakázkový_list.pdf").replace(/\.pdf$/i, "") + "_signed.pdf";
  const { data: rad, error: e3 } = await sb.from("soubory").insert([
    { zakazka_id: f.zakazka_id, vozidlo_id: v.id, druh: "podpis", klic: klicPodpis, nazev: "podpis zákazníka (E-serviska)", mime: "image/png", velikost: bin.length, verejne: false },
    { zakazka_id: f.zakazka_id, vozidlo_id: v.id, druh: "archiv", klic: klicPdf, nazev, mime: "application/pdf", velikost: pdfBin.length, verejne: true, podepsany_z: f.id }
  ]).select("id,druh");
  if (e3 || !rad) { await sb.storage.from("soubory").remove([klicPodpis, klicPdf]); return odp(500, { chyba: "ulozeni" }); }
  const sid = rad.find((x: any) => x.druh === "podpis")?.id;
  await sb.from("dalkove_podpisy").insert({ archiv_soubor_id: f.id, soubor_id: sid, ip: null, zarizeni: (req.headers.get("user-agent") || "").slice(0, 300) });
  upozornit({ zakazka_id: f.zakazka_id, druh: "archiv", cislo: String(cislo) });
  return odp(200, { ok: true });
}
