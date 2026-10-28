/* Šablona: zakazkovy-list – vykreslení dokladu (volá window.render(data, jazyk)) */
/* ---------- Texty dokumentu (CZ / EN) ---------- */
const TEXTY = {
  cs: {
    titul: "ZAKÁZKOVÝ LIST", dodavatel: "Dodavatel:", zakaznik: "Zákazník:",
    ico: "IČO:", dph: "Neplátce DPH", ucet: "Č. účtu:", swift: "SWIFT:", banka: "BANKA:", iban: "IBAN:",
    tel: "tel:", email: "e-mail:", zavady: "Popis závad a objednaných oprav:", vozidlo: "Vozidlo:",
    typ: "Typ:", model: "Model:", rok: "Rok:", vin: "VIN:", nadrz: "Stav nádrže:", tp: "TP přiložen:",
    foto1: "Fotodokumentace", foto2: "při převzetí:", stav: "Stav při převzetí:",
    zarukaH: "Upozornění na omezenou záruku:",
    zaruka: [
      "Opravy jsou prováděny s maximální odbornou péčí, avšak vzhledem ke stáří vozidel nelze poskytnout záruku na některé opravy a použité ",
      "díly. Zákazník bere na vědomí, že vliv oprav na celkový stav vozu nelze vždy předvídat. Podpisem zakázkového listu nebo faktury ",
      "zákazník potvrzuje, že byl na tato omezení upozorněn a souhlasí s nimi."
    ],
    datum: "Datum vyhotovení:", dokonceni: "Předpoklad dokončení:",
    vyhotovil: "Vyhotovil", prevzal: "Převzal", odhad: "Odhadovaná cena", mena: "Kč",
    ano: "ano", ne: "ne", informace: "Informace",
    backpage: [
      ["Odhad nákladů", ":", [
        "Uvedený odhad ceny opravy je orientační. Konečná cena se může lišit v závislosti na rozsahu nutných",
        "prací a dostupnosti dílů. Jakékoliv změny nad 15% ceny odhadované budou konzultovány",
        "se zákazníkem."]],
      ["Odpovědnost za díly:", "", [
        "Zákazník bere na vědomí, že použití nových, použitých i repasovaných dílů je nezbytné s ohledem",
        "na dostupnost originálních komponentů. Záruka na dodané díly se řídí podmínkami jejich dodavatelů."]],
      ["Testovací jízda a zkoušky:", "", [
        "Zákazník souhlasí, že před opravou a po dokončení oprav může být vozidlo použito pro testovací jízdy",
        "a funkční zkoušky."]],
      ["Vyloučení odpovědnosti:", "", [
        "Servis nenese odpovědnost za skryté vady nebo následné závady, které nebyly zjistitelné při běžném",
        "rozsahu prováděných oprav. Za cennosti ponechané ve vozidle neneseme odpovědnost."]],
      ["Termíny a prodlení:", "", [
        "Předpokládaný termín dokončení opravy je orientační. V případě zdržení způsobeného nedostupnosti",
        "dílů nebo jinými nepředvídatelnými okolnostmi bude zákazník neprodleně informován."]],
      ["Předání vozidla:", "", [
        "Vozidlo bude zákazníkovi předáno až po úplném uhrazení ceny za provedené opravy a služby."]],
      ["Archivace a dokumentace:", "", [
        "Zákazník souhlasí s archivací dokumentace a fotografií vozidla pro účely evidence a referencí servisu",
        "v souladu s nařízením GDPR (Nařízení EU 2016/679). Fotografie mohou být použity pro marketingové",
        "účely. Zákazník může souhlas odvolat nebo požádat o výmaz údajů e-mailem, pokud to",
        "neodporuje zákonným povinnostem."]],
      ["Děkujeme za důvěru! ", "", [
        "Děkujeme za Vaši důvěru a těšíme se, až Vám bude Vaše auto opět dělat radost."]]
    ]
  }
};


TEXTY.en = {
  titul: "WORK ORDER", dodavatel: "Provider:", zakaznik: "Customer:",
  ico: "CIN:", dph: "VAT unregistered", ucet: "Bank account:", swift: "SWIFT:", banka: "BANK:", iban: "IBAN:",
  tel: "tel:", email: "e-mail:", zavady: "Description of defects and required repairs:", vozidlo: "Vehicle:",
  typ: "Type:", model: "Model:", rok: "Year:", vin: "VIN:", nadrz: "Fuel tank:", tp: "Documents:",
  foto1: "Photo documentation", foto2: "at takeover:", stav: "Status upon takeover:",
  zarukaH: "Limited warranty notice:",
  zaruka: [
    "Repairs are carried out with the utmost professional care. However, due to the age of the vehicles, no warranty is provided for certain repairs or ",
    "installed parts. The customer acknowledges that the effect of repairs on the vehicle's overall condition cannot always be predicted. By signing the ",
    "work order or invoice, the customer confirms they have been informed of these limitations and agree to them."
  ],
  datum: "Date of issue:", dokonceni: "Expected completion date:",
  vyhotovil: "Issued by", prevzal: "Received by:", odhad: "Price estimate", mena: "CZK",
  ano: "yes", ne: "no", informace: "Information",
  backpage: [
    ["Cost estimate:", "", [
      "The repair cost estimate provided is approximate. The final price may vary depending on the scope of",
      "work required and the availability of parts. Any changes exceeding 15% of the estimated price will be",
      "discussed with the customer."]],
    ["Responsibility for parts:", "", [
      "The customer acknowledges that the use of new, used, and refurbished parts is necessary due to",
      "the availability of original components. The parts  warranty is governed by the suppliers T&C."]],
    ["Test Drive and Tests:", "", [
      "The customer agrees that the vehicle may be used for test drives and functional tests both before",
      "and after the repairs are completed."]],
    ["Disclaimer:", "", [
      "The service center is not liable for hidden defects or consequential defects that could not have been",
      "detected during the normal scope of repairs performed. We are not liable for valuables left in the vehicle."]],
    ["Deadlines and Delays:", "", [
      "The estimated completion date for the repair is approximate. In the event of a delay caused by the",
      "unavailability of parts or other unforeseeable circumstances, the customer will be notified immediately."]],
    ["Vehicle Handover:", "", [
      "The vehicle will be handed over to the customer only after full payment has been made for the repairs."]],
    ["Archiving and Documentation:", "", [
      "The customer agrees to the archiving of vehicle documentation and photographs for record-keeping and",
      "service reference purposes in accordance with the GDPR (EU Regulation 2016/679). Photographs may",
      "be used for marketing purposes. The customer may withdraw consent or request the deletion of data",
      "via email, provided that this does not conflict with legal obligations."]],
    ["Thank you for your trust! ", "", [
      "Thank you for your trust, and we look forward to seeing you enjoy your car again."]]
  ]
};

/* Předávací protokol – stejný list jako zakázkový, liší se tyto texty.
   Zadní strana závisí na volbách: zkušební jízda proběhla? kola byla demontována? */
const PROTOKOL = {
  cs: {
    titul: "PŘEDÁVACÍ PROTOKOL", foto2: "při předání:", stav: "Stav při předání zákazníkovi:",
    dokonceni: "Datum převzetí:", odhad: "",
    backpage: d => [
      ["Potvrzení o převzetí vozidla:", "", d.zkusebniJizda === false ? [
        "Podpisem protokolu zákazník potvrzuje převzetí vozidla po provedení prací v rozsahu uvedeném ",
        "na zakázkovém listu."] : [
        "Podpisem protokolu zákazník potvrzuje převzetí vozidla po provedení prací v rozsahu uvedeném ",
        "na zakázkovém listu. Zákazník před převzetím absolvoval zkušební jízdu bez výhrad."]],
      ["Odpovědnost za díly:", "", [
        "Zákazník bere na vědomí, že použití nových, použitých i repasovaných dílů je nezbytné s ohledem",
        "na dostupnost originálních komponentů. Záruka na dodané díly se řídí podmínkami jejich dodavatelů."]],
      ["Vyloučení odpovědnosti:", "", [
        "Servis nenese odpovědnost za skryté vady nebo následné závady, které nebyly zjistitelné při běžném",
        "rozsahu prováděných oprav. Za cennosti ponechané ve vozidle neneseme odpovědnost."]],
      ["Archivace a dokumentace:", "", [
        "Zákazník souhlasí s archivací dokumentace a fotografií vozidla pro účely evidence a referencí servisu",
        "v souladu s nařízením GDPR (Nařízení EU 2016/679). Fotografie mohou být použity pro marketingové",
        "účely. Zákazník může souhlas odvolat nebo požádat o výmaz údajů e-mailem, pokud to",
        "neodporuje zákonným povinnostem."]],
      ...(d.kolaDotazena ? [["Kontrola dotažení kol:", "", [
        "Kola byla dotažena momentovým klíčem dle předpisu výrobce. Zákazník je povinen po ujetí",
        "50–100 km nechat dotažení zkontrolovat, kontrolu provedeme zdarma. Za škody způsobené",   // v originále přetékalo přes rámeček
        "nedodržením této povinnosti servis neodpovídá. Kontrolu rádi provedeme zdarma na vyžádání."]]] : []),
      ["Děkujeme za důvěru! ", "", [
        "Děkujeme za Vaši důvěru a těšíme se, až Vám bude Vaše auto opět dělat radost."]]
    ]
  },
  en: {   /* anglický protokol zatím neexistoval – nový překlad ke schválení */
    titul: "HANDOVER PROTOCOL", foto2: "at handover:", stav: "Condition at handover:",
    dokonceni: "Date of handover:", odhad: "",
    backpage: d => [
      ["Vehicle Pickup Confirmation:", "", d.zkusebniJizda === false ? [
        "By signing this protocol, the customer confirms receipt of the vehicle after the work specified",
        "in the work order has been completed."] : [
        "By signing this protocol, the customer confirms receipt of the vehicle after the work specified",
        "in the work order has been completed. The customer took a test drive before pickup without objections."]],
      ["Responsibility for parts:", "", [
        "The customer acknowledges that the use of new, used, and refurbished parts is necessary due to",
        "the availability of original components. The parts warranty is governed by the suppliers T&C."]],
      ["Disclaimer:", "", [
        "The service center is not liable for hidden defects or consequential defects that could not have been",
        "detected during the normal scope of repairs performed. We are not liable for valuables left in the vehicle."]],
      ["Archiving and Documentation:", "", [
        "The customer agrees to the archiving of vehicle documentation and photographs for record-keeping and",
        "service reference purposes in accordance with the GDPR (EU Regulation 2016/679). Photographs may",
        "be used for marketing purposes. The customer may withdraw consent or request the deletion of data",
        "via email, provided that this does not conflict with legal obligations."]],
      ...(d.kolaDotazena ? [["Wheel Torque Check:", "", [
        "The wheels were tightened with a torque wrench to the manufacturer's specification. The customer is",
        "required to have them re-checked after 50–100 km; we will do this free of charge. The service center",
        "is not liable for damage caused by failure to comply with this obligation."]]] : []),
      ["Thank you for your trust! ", "", [
        "Thank you for your trust, and we look forward to seeing you enjoy your car again."]]
    ]
  }
};

function hlavicka(tx, cislo) {
  let h = T(73.5, 64.4, tx.titul, { b: true, size: 15.7 });
  if (cislo != null) h += T(470.4, 63.2, "# ", { serif: true, size: 15.7 }) + T(483.1, 63.2, String(cislo), { serif: true, size: 15.7 });
  return h;
}

function strana1(d, tx) {
  let h = "";
  // rámeček a linky
  h += SVG(L(50.0, 53.9, 51.0, 741.9) + L(543.9, 54.9, 544.9, 741.9) + L(51.0, 53.9, 544.9, 54.9)
    + L(51.0, 589.0, 544.9, 590.0) + L(51.0, 634.1, 544.9, 635.0) + L(51.0, 686.0, 544.9, 687.0)
    + L(51.0, 698.7, 544.9, 699.7) + L(51.0, 740.9, 544.9, 741.9)
    + L(193.1, 687.0, 194.0, 741.9) + L(325.4, 687.0, 326.3, 741.9));

  h += hlavicka(tx, d.cislo);
  h += T(186.2, 105.9, "Mercedes Restorations", { b: true, size: 21.6 });

  // dodavatel
  h += T(72.5, 160.8, tx.dodavatel, { b: true });
  [FIRMA.nazev, FIRMA.ulice, FIRMA.mesto, FIRMA.zeme.cs].forEach((s, i) => h += T(72.5, 179.5 + i * 12.73, s));
  h += T(72.5, 243.2, `${tx.ico} ${FIRMA.ico}`) + T(72.5, 255.9, tx.dph);
  h += T(72.5, 268.6, FIRMA.rejstrik[tx.lang].kratce);                      // zápis v OR (varianta A, schváleno 28. 10.)
  h += T(72.5, 281.4, `${tx.ucet} ${FIRMA.ucet}`) + T(72.5, 294.1, `${tx.swift}  ${FIRMA.swift}`);
  h += T(72.5, 306.9, `${tx.banka} ${FIRMA.banka}`) + T(72.5, 319.6, `${tx.iban}     ${FIRMA.iban}`);

  // zákazník
  const z = d.zakaznik;
  h += T(357.7, 160.8, tx.zakaznik, { b: true });
  [z.jmeno, z.ulice, z.mesto, z.zeme].filter(Boolean).forEach((s, i) => h += T(357.7, 179.5 + i * 12.73, s));
  h += T(357.7, 243.2, tx.tel) + T(390.0, 243.2, z.telefon || "");
  h += T(357.7, 255.9, tx.email) + T(390.0, 255.9, z.email || "");

  // závady
  h += T(72.5, 345.1, tx.zavady, { b: true });
  h += odrazky(72.5, 361.7, d.zavady, 8).html;

  // vozidlo
  const v = d.vozidlo;
  h += T(357.7, 345.1, tx.vozidlo, { b: true });
  h += T(357.7, 361.8, v.znacka || "Mercedes-Benz");
  [[tx.typ, v.typ], [tx.model, v.model], [tx.rok, v.rok], [tx.vin, v.vin]].forEach(([l, val], i) => {
    h += T(357.7, 374.5 + i * 12.75, l) + T(390.0, 374.5 + i * 12.75, val || "");
  });
  const ano = b => b ? tx.ano.replace(/^./, c => c.toUpperCase()) : tx.ne.replace(/^./, c => c.toUpperCase());
  h += T(357.7, 438.2, tx.nadrz) + T(420.4, 438.2, d.nadrz || "");
  h += T(357.7, 450.9, tx.tp) + T(420.4, 450.9, ano(d.tp));
  h += T(357.7, 463.7, tx.foto1) + T(357.7, 476.4, tx.foto2) + T(420.4, 476.4, ano(d.foto));

  // stav při převzetí
  h += T(72.5, 476.4, tx.stav, { b: true });
  h += odrazky(72.5, 489.1, d.stav, 7).html;

  // upozornění
  h += T(69.6, 591.6, tx.zarukaH, { b: true, size: 7.8 });
  tx.zaruka.forEach((s, i) => h += T(69.6, 602.4 + i * 10.8, s, { size: 7.8 }));

  // data
  h += T(72.5, 650.8, tx.datum) + T(196.0, 650.8, datum(d.datum));
  h += T(72.5, 663.6, tx.dokonceni) + T(196.0, 663.6, datum(d.druh === "protokol" ? d.prevzeti : d.dokonceni));

  // podpisová tabulka
  h += T(104.9, 689.1, tx.vyhotovil, { b: true }) + T(242.1, 689.1, tx.prevzal, { b: true });
  h += T(392.0, 689.1, tx.odhad, { b: true });
  // „Vyhotovil“: přihlášený člověk z dílny; jméno Václav Macháň sedí přesně jako v originále, jiné jméno se vystředí do stejného místa
  const vyh = d.vyhotovil || FIRMA.vyhotovil;
  h += T(90.2 + (sirka(FIRMA.vyhotovil, 9.8) - sirka(vyh, 9.8)) / 2, 701.8, vyh, { maxW: 138 }) + T(259.7, 701.8, z.jmeno || "", { c: true });
  h += T(81.3, 729.2, "…............................") + T(210.7, 729.2, "…..............................");
  if (d.druh !== "protokol" && d.odhad != null && d.odhad !== "") h += T(435.6, 712.8, `${cislo2(d.odhad)} ${tx.mena}`, { b: true, size: 15.7, c: true });
  if (d.podpisVyhotovil) h += IMG(podpisSrc(d.podpisVyhotovil), 63.0, 706.9, 220.4, 752.7);
  if (d.podpisZakaznik) h += `<img class="abs" src="${d.podpisZakaznik}" style="left:199pt;top:706.9pt;width:122pt;height:30pt;object-fit:contain">`;

  h += paticka(1, 2);
  return `<section class="page">${h}</section>`;
}

function strana2(d, tx) {
  let h = "";
  h += SVG(L(50.0, 53.9, 51.0, 776.2) + L(543.9, 54.9, 544.9, 776.2) + L(51.0, 53.9, 544.9, 54.9) + L(51.0, 775.2, 544.9, 776.2));
  h += hlavicka(tx, null);
  if (d.druh === "protokol") h += T(434.1, 63.2, `#${d.cislo}`, { serif: true, size: 15.7 });
  h += T(tx.lang === "en" ? 245.0 : 251.9, 105.9, tx.informace, { b: true, size: 21.6 });
  let y = 160.8;
  const bp = typeof tx.backpage === "function" ? tx.backpage(d) : tx.backpage;
  bp.forEach(([nadpis, dvojtecka, radky]) => {
    if (dvojtecka) h += `<div class="t" style="left:63.7pt;top:${(y - KAL.sans * 9.8).toFixed(2)}pt"><b>${spans(nadpis, 9.8, true)}</b>${spans(dvojtecka, 9.8, false)}</div>`;
    else h += T(63.7, y, nadpis, { b: true });
    y += 13.74;
    radky.forEach(r => { h += T(63.7, y, r); y += 13.74; });
    y += 13.74;
  });
  const top = (d.druh === "protokol" && d.kolaDotazena) ? 516.0 : 613.5;   // auto se posune, když je na stránce víc textu
  h += IMG("assets/auto-zl.png", 50.0, top, 542.2, top + 161.1);
  h += IMG("assets/logo-mr.png", 385.7, top + 84.2, 400.4, top + 98.9);
  h += paticka(2, 2);
  return `<section class="page">${h}</section>`;
}

window.render = async function (data, lang = "cs") {
  await nactiPisma();
  const tx = { ...TEXTY[lang], ...(data.druh === "protokol" ? PROTOKOL[lang] : {}), lang };
  document.getElementById("doc").innerHTML = strana1(data, tx) + strana2(data, tx);
};
