/* Překlad vlastních textů do anglických dokladů (Vašek 30.10.2026).
   Pořadí: 1) uložený překlad (tabulka preklady – co jednou opravíš, aplikace si pamatuje)
           2) tento slovník celých frází  3) návrh z odborných výrazů (díly, práce) – označený „zkontrolujte“.
   Klíč = text malými písmeny, bez nadbytečných mezer. */
(function () {
  const F = {
    // práce a paušály
    "inspekce": "Inspection",
    "prohlídka auta (inspekce)": "Vehicle inspection",
    "prohliídka auta (inspekce)": "Vehicle inspection",
    "inspekce vozidla": "Vehicle inspection",
    "inspekce vozidla a diagnostika": "Vehicle inspection and diagnostics",
    "vstupní prohlídka": "Initial inspection",
    "geometrie": "Wheel alignment",
    "geometrie kol": "Wheel alignment",
    "servisní materiál (utěrky, wd-40, čistič brzd, rukavice apod.)": "Workshop consumables (rags, WD-40, brake cleaner, gloves etc.)",
    "servisní materiál": "Workshop consumables",
    "kontrola rozvodového řetězu": "Timing chain inspection",
    "kontrola rozvodového řetězu + výměna těsnění ventilového víka": "Timing chain inspection + valve cover gasket replacement",
    "odstranění závady asd": "ASD fault repair",
    "svítí kontrolka asd": "ASD warning light on",
    "oprava přední nápravy": "Front axle repair",
    "kontrola přední nápravy": "Front axle inspection",
    "renovace komaxitem": "Powder coating refurbishment",
    "renovace přední nápravy (komaxit, čepy, tyče, tlumiče, pouzdra, silentbloky)": "Front axle refurbishment (powder coating, ball joints, rods, shock absorbers, bushings, rubber mounts)",
    "výměna náplní a filtrů (motor, převdovka, diff, paliv, hydr, aj.)": "Fluids and filters replacement (engine, transmission, differential, fuel, hydraulics etc.)",
    "výměna náplní a filtrů (motor, převodovka, diff, paliv, hydr, aj.)": "Fluids and filters replacement (engine, transmission, differential, fuel, hydraulics etc.)",
    "výměna pouzder táhel řazení": "Gear shift linkage bushings replacement",
    "výměna pouzdra řadící tyče": "Gear shift rod bushing replacement",
    "hadice automatické převodovky": "Automatic transmission hoses",
    "klepání auta při přidání plynu": "Knocking when accelerating",
    "klimatizace (na někdy příště)": "Air conditioning (next time)",
    "kompletní údržba - oleje, filtry": "Complete maintenance – oils, filters",
    "řízení kvílí": "Steering squeals",
    "silentbloky motoru + tlumiče motoru": "Engine mounts + engine dampers",
    "výměna motorového oleje + filtr": "Engine oil + filter change",
    "výměna oleje diferenciálu": "Differential oil change",
    "výměna oleje servořízení + filtr": "Power steering fluid + filter change",
    "výměna palivového filtru": "Fuel filter replacement",
    "výměna předních brzdových destiček": "Front brake pads replacement",
    "výměna převodového oleje + filtr": "Transmission oil + filter change",
    "výměna těsnění víčka oleje": "Oil filler cap seal replacement",
    "výměna tlumičů": "Shock absorbers replacement",
    "výměna vzduchového filtru": "Air filter replacement",
    "zatéká čelním oknem do prostoru pro nohy řidiče": "Water leaking through the windscreen into the driver's footwell",
    "diagnostika klimatizace": "Air conditioning diagnostics",
    "diagnostika nesprávného volnoběhu": "Incorrect idle diagnostics",
    "diagnostika řízení": "Steering diagnostics",
    "motor má nepravidelný chod": "Engine runs unevenly",
    "nefunkční rádio": "Radio not working",
    "nefunkční topení": "Heating not working",
    "nelze jet více než 100 km/h": "Cannot drive faster than 100 km/h",
    "oprava hadic chlazení oleje automatické převodovky": "Automatic transmission oil cooler hoses repair",
    "ostatní servis": "Other service",
    "případná výměna silentbloků motoru + tlumiče chvění": "Possible replacement of engine mounts + vibration damper",
    "případné seřízení volnoběhu, výměna dílů dle dohody": "Idle adjustment if needed, parts replacement as agreed",
    "řešení ostatních závad dle další domluvy": "Other repairs as agreed",
    "rozsah oprav bude konzultován po převzetí a prohlídce vozu": "Scope of repairs will be discussed after receiving and inspecting the car",
    "různé elektrikářské práce": "Various electrical work",
    "servis brzdového systému": "Brake system service",
    "servis vozidla (výměna kapalin a filtrů)": "Vehicle service (fluids and filters)",
    "výměna filtru automatické převodovky": "Automatic transmission filter replacement",
    "výměna filtru motorového oleje": "Engine oil filter replacement",
    "výměna motorového oleje": "Engine oil change",
    "výměna oleje automatické převodovky": "Automatic transmission fluid change",
    "výměna oleje v motoru": "Engine oil change",
    "výměna olejů a filtrů": "Oils and filters change",
    "za jízdy fouká do kabiny": "Air blowing into the cabin while driving",
    "zákazník si objednává dopravu a další": "Customer orders transport and more",
    "zákazník si přeje zpojízdnit auto": "Customer wants the car made roadworthy",
    "likvidace kapalin": "Disposal of used fluids",
    "likvidace odpadu": "Waste disposal",
    "ekologická likvidace": "Environmental disposal",
    "práce": "Labour",
    "diagnostika": "Diagnostics",
    "doprava": "Transport",
    "transport auta": "Car transport",
    "benzín": "Fuel",
    "zkušební jízda": "Test drive",
    "mytí auta": "Car wash",
    "auto pojízdné, startuje, jede": "Car drivable, starts and drives",
    "opravy provedeny dle zakázkového listu": "Repairs carried out according to the work order",
    "auto umyté": "Car cleaned",
    "vnější poškození karoserie viz foto": "Exterior body damage – see photos",
    "interiér bez poškození": "Interior without damage",
    // díly (názvy z Granexu / Auto Kelly) – značka zůstává
    "ate čistič brzd 500ml": "ATE brake cleaner 500 ml",
    "brzdová hadice trw": "Brake hose TRW",
    "brzdová kapalina febi bilstein": "Brake fluid FEBI BILSTEIN",
    "brzdový kotouč ate": "Brake disc ATE",
    "hydraulický filtr, řízení mann-filter": "Hydraulic filter, steering MANN-FILTER",
    "hydraulický olej febi bilstein": "Hydraulic oil FEBI BILSTEIN",
    "k2 nano sprysk zimní kapalina do ostřikovačů -40°c 5l": "K2 NANO SPRYSK winter screen wash -40 °C 5 l",
    "mazivo do valivých ložisek febi bilstein": "Wheel bearing grease FEBI BILSTEIN",
    "montážní sada, řídicí mechanismus meyle": "Mounting kit, control arm MEYLE",
    "olej do převodovky meyle": "Transmission oil MEYLE",
    "olejový filtr mann-filter": "Oil filter MANN-FILTER",
    "opravná sada, vodicí vzpěra meyle": "Repair kit, radius arm MEYLE",
    "podpora-/ kloub lemförder": "Ball joint LEMFÖRDER",
    "pouzdro, řadicí tyč febi bilstein": "Bushing, gear shift rod FEBI BILSTEIN",
    "předlohová páka řízení lemförder": "Idler arm LEMFÖRDER",
    "příčné táhlo řízení meyle": "Tie rod MEYLE",
    "řídicí páka, zavěšení kol lemförder": "Control arm, wheel suspension LEMFÖRDER",
    "sada brzdových destiček, kotoučová brzda ate": "Brake pad set, disc brake ATE",
    "sada ložiska kola febi bilstein": "Wheel bearing kit FEBI BILSTEIN",
    "sada na opravy - řídicí páka lemförder": "Repair kit – control arm LEMFÖRDER",
    "sada příslušenství obložení kotoučové brzdy ate": "Accessory kit, disc brake pads ATE",
    "táhlo řízení meyle": "Steering rod MEYLE",
    "těsnění, kryt hlavy válce elring": "Gasket, cylinder head cover ELRING",
    "těsnění, víčko plnicího hrdla oleje elring": "Seal, oil filler cap ELRING",
    "tlumič pérování bilstein": "Shock absorber BILSTEIN",
    "tlumic řízení stabilus": "Steering damper STABILUS",
    "tlumič řízení stabilus": "Steering damper STABILUS",
    "uložení, řídicí mechanismus febi bilstein": "Mounting, control arm FEBI BILSTEIN",
    "uložení, řídicí mechanismus meyle": "Mounting, control arm MEYLE",
    "výstražný kontakt, opotřebení obložení ate": "Brake pad wear sensor ATE",
    "vzduchový filtr mann-filter": "Air filter MANN-FILTER"
  };
  // odborné výrazy pro návrh překladu nových textů (nejdelší se nahrazují první)
  const T = [
    ["sada brzdových destiček", "brake pad set"], ["brzdové destičky", "brake pads"], ["brzdová destička", "brake pad"], ["brzdový kotouč", "brake disc"], ["brzdové kotouče", "brake discs"],
    ["brzdová kapalina", "brake fluid"], ["brzdová hadice", "brake hose"], ["brzdový třmen", "brake caliper"], ["kotoučová brzda", "disc brake"], ["čistič brzd", "brake cleaner"],
    ["olejový filtr", "oil filter"], ["vzduchový filtr", "air filter"], ["palivový filtr", "fuel filter"], ["kabinový filtr", "cabin filter"], ["hydraulický filtr", "hydraulic filter"],
    ["motorový olej", "engine oil"], ["převodový olej", "transmission oil"], ["olej do převodovky", "transmission oil"], ["hydraulický olej", "hydraulic oil"], ["chladicí kapalina", "coolant"], ["chladící kapalina", "coolant"],
    ["zapalovací svíčka", "spark plug"], ["zapalovací svíčky", "spark plugs"], ["klínový řemen", "V-belt"], ["žebrovaný klínový řemen", "ribbed V-belt"], ["rozvodový řetěz", "timing chain"],
    ["těsnění", "gasket"], ["kryt hlavy válce", "cylinder head cover"], ["ventilové víko", "valve cover"], ["víčko", "cap"], ["plnicího hrdla oleje", "oil filler neck"],
    ["tlumič pérování", "shock absorber"], ["tlumič řízení", "steering damper"], ["tlumiče", "shock absorbers"], ["tlumič", "damper"], ["silentblok", "rubber mount"], ["silentbloky", "rubber mounts"],
    ["řídicí páka", "control arm"], ["příčné táhlo", "tie rod"], ["táhlo řízení", "steering rod"], ["předlohová páka řízení", "idler arm"], ["kulový čep", "ball joint"], ["kloub", "joint"],
    ["ložisko kola", "wheel bearing"], ["sada ložiska kola", "wheel bearing kit"], ["uložení", "mounting"], ["pouzdro", "bushing"], ["řadicí tyč", "gear shift rod"], ["zavěšení kol", "wheel suspension"],
    ["palivové čerpadlo", "fuel pump"], ["palivová hadice", "fuel hose"], ["vodní čerpadlo", "water pump"], ["chladič", "radiator"], ["termostat", "thermostat"], ["baterie", "battery"], ["autobaterie", "car battery"],
    ["stěrač", "wiper"], ["stěrače", "wipers"], ["žárovka", "bulb"], ["pojistka", "fuse"], ["spínač", "switch"], ["relé", "relay"], ["snímač", "sensor"], ["výstražný kontakt", "wear sensor"],
    ["montážní sada", "mounting kit"], ["opravná sada", "repair kit"], ["sada", "kit"], ["mazivo", "grease"], ["kapalina do ostřikovačů", "screen wash"],
    ["výměna", "replacement of"], ["oprava", "repair of"], ["kontrola", "inspection of"], ["seřízení", "adjustment of"], ["diagnostika", "diagnostics of"], ["renovace", "refurbishment of"], ["čištění", "cleaning of"],
    ["přední", "front"], ["zadní", "rear"], ["levý", "left"], ["levá", "left"], ["pravý", "right"], ["pravá", "right"], ["horní", "upper"], ["dolní", "lower"],
    ["motoru", "engine"], ["motor", "engine"], ["převodovky", "transmission"], ["převodovka", "transmission"], ["automatické převodovky", "automatic transmission"], ["diferenciálu", "differential"],
    ["nápravy", "axle"], ["náprava", "axle"], ["řízení", "steering"], ["brzd", "brakes"], ["kol", "wheels"], ["klimatizace", "air conditioning"], ["topení", "heating"], ["výfuku", "exhaust"], ["výfuk", "exhaust"],
    ["a", "and"], ["ks", "pcs"]
  ];
  const T2 = T.slice().sort((a, b) => b[0].length - a[0].length);
  const klic = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  const velke = (s, vzor) => (vzor && vzor[0] === vzor[0].toUpperCase() && s ? s[0].toUpperCase() + s.slice(1) : s);
  // návrh: odborné výrazy přeložit, zbytek (značky, čísla) nechat
  function navrh(text) {
    let s = " " + String(text).trim() + " ", zmena = false;
    for (const [cs, en] of T2) {
      const re = new RegExp(`(^|[\\s,.;:()/+–-])${cs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s,.;:()/+–-])`, "gi");
      if (re.test(s)) { s = s.replace(re, (m, p) => p + en); zmena = true; }
    }
    s = s.trim().replace(/\s+/g, " ");
    return zmena ? velke(s, String(text).trim()) : null;
  }
  // { en, zdroj: "ulozeno" | "slovnik" | "navrh" | null }
  window.prelozitEn = function (text, ulozene) {
    const k = klic(text);
    if (!k) return { en: "", zdroj: "slovnik" };
    if (ulozene && ulozene[k]) return { en: ulozene[k], zdroj: "ulozeno" };
    if (F[k]) return { en: F[k], zdroj: "slovnik" };
    if (!/[áčďéěíňóřšťúůýž]/i.test(k)) { const n = navrh(text); return n ? { en: n, zdroj: "navrh" } : { en: String(text).trim(), zdroj: "stejne" }; }   // bez diakritiky: možná anglicky / jen značka – nechat, ale ukázat ke kontrole
    const n = navrh(text);
    return n ? { en: n, zdroj: "navrh" } : { en: "", zdroj: null };
  };
  window.klicPrekladu = klic;
})();
