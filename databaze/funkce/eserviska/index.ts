// E-serviska: veřejná data servisní knížky podle VIN pro web mercedesrestorations.cz (/e-serviska?vin=…).
// Zatím BEZ ochrany (rozhodnutí Vaška 29.10.2026) – kdo zná VIN, vidí vše včetně údajů zákazníka. Ochrana se doplní později.
// Jen čtení. Odkazy na soubory jsou podepsané a platí 1 hodinu.
// „Co je příště na řadě“: intervaly z tabulky servisni_intervaly (skupina A/B/C podle roku) + zaškrtnuté servisní úkony u zakázek.
import { createClient } from "jsr:@supabase/supabase-js@2";

const POVOLENE = [/^https:\/\/(www\.)?mercedesrestorations\.cz$/, /^https:\/\/[\w-]+\.webflow\.io$/, /^https:\/\/werk\.mercedesrestorations\.cz$/, /^https:\/\/werkplaats\.pages\.dev$/];
const DOKLADY = ["zakazkovy_list", "nabidka", "zalohova", "faktura", "opravny", "predavaci_protokol"];
const PLATNOST = 3600;
const HOTOVO = ["hotovo", "fakturovano", "zaplaceno", "predano"];
const skupina = (v: any) => v.servisni_skupina || (!v.rok ? "A" : v.rok >= 1986 ? "A" : v.rok >= 1981 ? "B" : "C");
const plusMesice = (d: string, m: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

function hlavicky(origin: string | null) {
  const h: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin" };
  if (origin && POVOLENE.some(r => r.test(origin))) { h["access-control-allow-origin"] = origin; h["access-control-allow-methods"] = "GET, OPTIONS"; }
  return h;
}

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: hlavicky(origin) });
  const odp = (s: number, o: unknown) => new Response(JSON.stringify(o), { status: s, headers: hlavicky(origin) });
  if (req.method !== "GET") return odp(405, { chyba: "jen GET" });

  const vin = (new URL(req.url).searchParams.get("vin") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (vin.length < 10 || vin.length > 20) return odp(400, { chyba: "neplatny-vin" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: v } = await sb.from("vozidla")
    .select("id,vin,spz,znacka,typ,model,rok,mesic,verze,cislo_motoru,prevodovka,barva,rafky,pneu_letni,pneu_zimni,kody_vybavy,km_posledni,jednotka_tachometru,servisni_skupina")
    .eq("vin", vin).maybeSingle();
  if (!v) return odp(404, { chyba: "nenalezeno" });

  const sk = skupina(v);
  const [{ data: vl }, { data: zak }, { data: tp }, { data: intervaly }] = await Promise.all([
    sb.from("vlastnictvi").select("zakaznik_id,vlastni_od,vlastni_do,zakaznici(jmeno,kontaktni_osoba,email,telefon)").eq("vozidlo_id", v.id).order("vlastni_od", { ascending: false }),
    sb.from("zakazky").select("id,cislo,stav,zakaznik_id,datum_prijmu,datum_predani,km_prijem,km_predani,zavady,servisni_ukony").eq("vozidlo_id", v.id).neq("stav", "zruseno").neq("stav", "poptavka").order("datum_prijmu", { ascending: false }),
    sb.from("soubory").select("klic,nazev,mime").eq("vozidlo_id", v.id).eq("druh", "tp").eq("verejne", true).is("smazano", null).order("vytvoreno"),
    sb.from("servisni_intervaly").select("ukon,poradi,interval_km,interval_mesice,zdroj").eq("skupina", sk).order("poradi")
  ]);
  const aktualni = (vl || []).find(x => !x.vlastni_do) || (vl || [])[0];
  const ids = (zak || []).map(z => z.id);

  const [{ data: pol }, { data: dily }, { data: dok }, { data: soub }] = ids.length ? await Promise.all([
    sb.from("polozky").select("zakazka_id,poradi,typ,popis").in("zakazka_id", ids).is("nabidka_id", null).in("typ", ["prace", "pausal", "nadpis"]).order("poradi"),
    sb.from("dily").select("zakazka_id,poradi,nazev,cislo_mb,vyrobce,mnozstvi,jednotka,stav").in("zakazka_id", ids).neq("stav", "nepouzito").order("poradi"),
    sb.from("doklady").select("id,zakazka_id,druh,cislo,verze,vystaveno,pdf_soubor_id,soubory!doklady_pdf_soubor_id_fkey(klic)").in("zakazka_id", ids).eq("zamceno", true).in("druh", DOKLADY).order("verze", { ascending: false }),
    sb.from("soubory").select("zakazka_id,doklad_id,druh,faze,klic,nazev,mime,vytvoreno").in("zakazka_id", ids).in("druh", ["foto", "video", "pdf"]).is("smazano", null).order("vytvoreno")
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  // podepsané odkazy najednou
  const klice = new Set<string>();
  (tp || []).forEach(f => klice.add(f.klic));
  (soub || []).forEach(f => klice.add(f.klic));
  (dok || []).forEach(d => (d as any).soubory?.klic && klice.add((d as any).soubory.klic));
  const url: Record<string, string> = {};
  if (klice.size) {
    const { data: podp } = await sb.storage.from("soubory").createSignedUrls([...klice], PLATNOST);
    (podp || []).forEach(p => { if (p.path && p.signedUrl) url[p.path] = p.signedUrl; });
  }

  const navstevy = (zak || []).map(z => {
    const vlastni = aktualni && z.zakaznik_id === aktualni.zakaznik_id;   // doklady předchozího majitele se neukazují
    const posledni: Record<string, any> = {};
    (dok || []).filter(d => d.zakazka_id === z.id).forEach(d => { if (!posledni[d.druh]) posledni[d.druh] = d; });
    const dokumenty = vlastni ? Object.values(posledni).map((d: any) => ({ druh: d.druh, cislo: d.cislo, vystaveno: d.vystaveno, url: url[d.soubory?.klic] || null })).filter(d => d.url) : [];
    if (vlastni) (soub || []).filter(f => f.zakazka_id === z.id && f.druh === "pdf" && /parts.list/i.test(f.nazev || "") && Object.values(posledni).some((d: any) => d.id === f.doklad_id))
      .forEach(f => dokumenty.push({ druh: "parts_list", cislo: f.nazev, vystaveno: null, url: url[f.klic] || null }));
    return {
      cislo: z.cislo, stav: z.stav, servisni_ukony: z.servisni_ukony || [], datum_prijmu: z.datum_prijmu, datum_predani: z.datum_predani, km_prijem: z.km_prijem, km_predani: z.km_predani,
      zavady: (z.zavady || []).filter(Boolean),
      prace: (pol || []).filter(p => p.zakazka_id === z.id && p.popis).map(p => ({ typ: p.typ, popis: p.popis })),
      dily: (dily || []).filter(d => d.zakazka_id === z.id).map(d => ({ nazev: d.nazev, cislo_mb: d.cislo_mb, vyrobce: d.vyrobce, mnozstvi: d.mnozstvi, jednotka: d.jednotka })),
      fotky: (soub || []).filter(f => f.zakazka_id === z.id && (f.druh === "foto" || f.druh === "video") && url[f.klic]).map(f => ({ url: url[f.klic], video: f.druh === "video", faze: f.faze })),
      dokumenty
    };
  });

  // co je příště na řadě
  const mil = v.jednotka_tachometru === "mi", naJed = (km: number | null) => km == null ? null : mil ? Math.round(km / 1.6 / 100) * 100 : km;
  const dnes = new Date().toISOString().slice(0, 10), za60 = plusMesice(dnes, 2);
  const hotove = (zak || []).filter(z => HOTOVO.includes(z.stav)).sort((a, b) => String(b.datum_predani || b.datum_prijmu).localeCompare(String(a.datum_predani || a.datum_prijmu)));
  const servis = (intervaly || []).map(it => {
    const z = hotove.find(x => (x.servisni_ukony || []).includes(it.ukon));
    const interval = naJed(it.interval_km);
    if (!z) return { ukon: it.ukon, interval_km: interval, interval_mesice: it.interval_mesice, zdroj: it.zdroj, posledni: null, pristi: null, stav: "nezname" };
    const datum = z.datum_predani || z.datum_prijmu, km = z.km_predani ?? z.km_prijem ?? null;
    const pDatum = it.interval_mesice ? plusMesice(datum, it.interval_mesice) : null, pKm = interval != null && km != null ? km + interval : null;
    const nyni = v.km_posledni;
    const po = (pDatum && pDatum <= dnes) || (pKm != null && nyni != null && nyni >= pKm);
    const brzy = (pDatum && pDatum <= za60) || (pKm != null && nyni != null && nyni >= pKm - Math.min(1500, Math.round(interval! / 10)));
    return { ukon: it.ukon, interval_km: interval, interval_mesice: it.interval_mesice, zdroj: it.zdroj,
      posledni: { datum, km, cislo: z.cislo }, pristi: { datum: pDatum, km: pKm }, stav: po ? "po" : brzy ? "brzy" : "ok" };
  });

  const { id: _id, servisni_skupina: _s, ...vuz } = v;
  return odp(200, {
    vuz,
    zakaznik: aktualni?.zakaznici || null,
    tp: (tp || []).filter(f => url[f.klic]).map(f => ({ nazev: f.nazev, url: url[f.klic], pdf: f.mime === "application/pdf" })),
    navstevy,
    servis, servis_skupina: sk,
    platnost_odkazu_s: PLATNOST
  });
});
