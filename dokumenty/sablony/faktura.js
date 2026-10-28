/* Šablona: faktura – vykreslení dokladu (volá window.render(data, jazyk)) */
/* ---------- Texty faktury (CZ / EN) – převzato z tvých dokumentů ---------- */
const TEXTY = {
  cs: {
    titul: "FAKTURA", proforma: "PRO FORMA FAKTURA", dodavatel: "Dodavatel:", odberatel: "Odběratel:",
    ico: "IČO:", dic: "DIČ:", dph: "Neplátce DPH", ucet: "Č. účtu:", swift: "SWIFT:", banka: "BANKA:", iban: "IBAN:",
    tel: "tel:", email: "e-mail:", vozidlo: "Vozidlo:", typ: "Typ:", model: "Model:", rok: "Rok:", vin: "VIN:",
    forma: "Forma úhrady:", prevod: "převodem", vs: "Variabilní symbol:",
    popis: "Popis položky", mn: "Mn.", mj: "Mj", cenaMj: "Kč/Mj", celkem: "Celková částka",
    material: "Materiál (viz. parts list)", celkemRadek: "Celkem", mena: "Kč",
    zarukaH: "Upozornění na omezenou záruku:",
    zaruka: [
      "Opravy jsou prováděny s maximální odbornou péčí, avšak vzhledem ke stáří vozidel nelze poskytnout záruku na některé opravy a použité díly. ",
      "Zákazník bere na vědomí, že vliv oprav na celkový stav vozu nelze vždy předvídat. Podpisem zakázkového listu nebo faktury zákazník potvrzuje, ",
      "že byl na tato omezení upozorněn a souhlasí s nimi."
    ],
    vystaveni: "Datum vystavení:", splatnost: "Datum splatnosti:",
    vyhotovil: "Vyhotovil:", prevzal: "Převzal:", celkovaCastka: "Celková částka", informace: "Informace",
    backpage: [
      ["Platební podmínky:", [
        "Faktura je splatná k datu uvedenému na přední straně. Platbu lze provést na účet uvedený na faktuře.",
        "Při bankovním převodu prosím uveďte variabilní symbol odpovídající číslu faktury."]],
      ["Potvrzení o převzetí vozidla:", [
        "Podpisem, či úhradou faktury zákazník potvrzuje převzetí vozidla po provedení prací v rozsahu uvedeném",
        "na zakázkovém listu."]],
      ["Zodpovědnost zákazníka:", [
        "Zákazník odpovídá za okamžitou kontrolu fakturovaných položek a případné nesrovnalosti je povinen",
        "oznámit do 5 pracovních dnů od obdržení faktury."]],
      ["Archivace a zpracování osobních údajů:", [
        "Faktury, dokumentace a fotografie vozidla jsou archivovány v souladu s platnými zákony a GDPR.",
        "Fotografie mohou být použity pro dokumentační a marketingové účely. Zákazník může souhlas",
        "odvolat nebo požádat o výmaz údajů e-mailem, pokud to neodporuje zákonným povinnostem."]],
      ["Reklamace:", [
        "Servis nenese odpovědnost za skryté vady nebo závady, které nebyly zjistitelné při běžném rozsahu."]],
      ["Poděkování:", [
        "Děkujeme, že jste si vybrali Mercedes Restorations. Vážíme si vaší důvěry a těšíme se na shledanou."]]
    ]
  },
  en: {
    titul: "INVOICE", proforma: "PRO FORMA INVOICE", dodavatel: "Provider:", odberatel: "Customer:",
    ico: "CIN:", dic: "VAT ID:", dph: "VAT unregistered", ucet: "Bank account:", swift: "SWIFT:", banka: "BANK:", iban: "IBAN:",
    tel: "tel:", email: "e-mail:", vozidlo: "Vehicle:", typ: "Type:", model: "Model:", rok: "Year:", vin: "VIN:",
    forma: "Payment method:", prevod: "bank transfer", vs: "Variable symbol:",
    popis: "Item description", mn: "QTY", mj: "UOM", cenaMj: "CZK/UOM", celkem: "Total amount",
    material: "Parts used according to parts list", celkemRadek: "Total", mena: "CZK",
    zarukaH: "Limited warranty notice:",
    zaruka: [
      "Repairs are carried out with the utmost professional care. However, due to the age of the vehicles, no warranty is provided for certain repairs or ",
      "installed parts. The customer acknowledges that the effect of repairs on the vehicle's overall condition cannot always be predicted. By signing the ",
      "work order or invoice, the customer confirms they have been informed of these limitations and agree to them."
    ],
    vystaveni: "Date of issue:", splatnost: "Due date:",
    vyhotovil: "Issued by:", prevzal: "Received by:", celkovaCastka: "Total amount", informace: "Information",
    backpage: [
      ["Payment terms:", [
        "The invoice is due on the date indicated on the front. Payment can be made to the account listed on the",
        "invoice. When making a bank transfer, include the variable symbol corresponding to the invoice number."]],
      ["Vehicle Pickup Confirmation:", [
        "By signing the invoice, the customer confirms receipt of the vehicle after the work specified in the order",
        "has been completed."]],
      ["Customer Responsibility:", [
        "The customer is responsible for immediately reviewing the items listed on the invoice and is required",
        "to report any discrepancies within 5 business days of receiving the invoice."]],
      ["Archiving and Processing of Personal Data:", [
        "Invoices, documentation, and photographs of the vehicle are archived in accordance with applicable laws",
        "and the GDPR. Photographs may be used for documentation and marketing purposes.",
        "The customer may revoke their consent or request the deletion of their data via email, provided",
        "that this does not conflict with legal obligations."]],
      ["Complaints:", [
        "The service center is not liable for hidden defects or faults that could not be detected during a routine",
        "inspection."]],
      ["Thank you!", [
        "Thank you for choosing Mercedes Restorations. We appreciate your trust and look forward",
        "to seeing you again!"]]
    ]
  }
};


/* Cenová nabídka používá stejný list jako faktura – liší se jen tyto texty */
const NABIDKA = {
  cs: {
    titul: "CENOVÁ NABÍDKA", material: "Materiál (viz. parts list)", splatnost: "Datum platnosti:", obrazek: "assets/auto-nabidka.png",
    backpage: [
      ["Platnost nabídky:", [
        "Tato nabídka je platná po dobu platnosti uvedené na přední straně. Po uplynutí této lhůty si",
        "vyhrazujeme právo na změnu cen nebo podmínek."]],
      ["Podmínky platby:", [
        "Po schválení cenové nabídky a před započetím prací si vyhrazujeme právo vystavit zálohovou ",
        "fakturu na materiál. Výše zálohy bude specifikována v nabídce."]],
      ["Popis prací a rozsah:", [
        "Nabídka zahrnuje následující práce a materiály (viz parts list). Jakékoliv změny nebo dodatečné",
        "požadavky mohou být předmětem nové nabídky."]],
      ["Kontaktní údaje pro schválení nabídky:", [
        "Pro schválení nabídky nás kontaktujte na uvedeném tel. Čísle, popř. e-mailem.",
        "V případě jakýchkoliv dotazů se na nás neváhejte obrátit."]],
      ["Poděkování:", [
        "Děkujeme, že jste si vybrali Mercedes Restorations. Vážíme si vaší důvěry, těšíme se na",
        "spolupráci a až Vám auto bude zase dělat radost."]]
    ]
  },
  en: {
    titul: "QUOTATION / PRICE ESTIMATE", odberatel: "Client:", popis: "Product", mn: "Pc.", mj: "Unit",
    cenaMj: "CZK / Pc.", celkem: "Total / product", material: "Parts to be ordered",
    vystaveni: "Date of issue:", splatnost: "Date of validity:", obrazek: "assets/auto-nabidka.png",
    backpage: [
      ["Validity of quotation:", [
        "This offer is valid for the period indicated on the front page. After this period expires,",
        "we reserve the right to change prices or adjust terms and conditions."]],
      ["Payment terms:", [
        "After the quote has been approved and before work begins, we reserve the right to issue an advance",
        "invoice for parts. The amount of the advance payment will be specified in the quote."]],
      ["Description and Scope of Work:", [
        "This quote includes the following work and materials (see parts list). Any changes or additional",
        "requirements may be subject to a new quote."]],
      ["Contact information for bid approval:", [
        "To approve the offer, please contact us at the phone number listed or by email.",
        "If you have any questions, please don't hesitate to contact us."]],
      ["Thank you!", [
        "Thank you for choosing Mercedes Restorations. We appreciate your trust and look forward to working ",
        "with you."]]
    ]
  }
};

/* Sloupce tabulky položek (středy podle originálu) */
const COL = { popisX: 61.7, popisStred: 196.0, mn: 357.7, mj: 389.1, cena: 433.9, celkem: 503.4 };
const MAX_RADKU = 13;

function strana1(d, tx) {
  let h = "";
  // rámeček, tabulka a linky – přesně podle originálu
  h += SVG(
      L(50.0, 53.9, 51.0, 373.4) + L(51.0, 53.9, 543.9, 54.9) + L(542.9, 54.9, 543.9, 742.8)
    + L(50.0, 373.4, 543.9, 374.4) + L(50.0, 386.1, 543.9, 387.1) + L(50.0, 374.4, 51.0, 742.8)
    + L(50.0, 551.7, 543.9, 565.5, "#b9d1f9")                                   // zvýrazněný řádek materiálu
    + L(341.0, 374.4, 342.0, 578.2) + L(373.4, 374.4, 374.4, 578.2) + L(403.8, 374.4, 404.7, 578.2) + L(462.6, 374.4, 463.5, 578.2)
    + L(51.0, 564.5, 543.9, 565.5) + L(51.0, 577.2, 543.9, 578.2) + L(51.0, 590.0, 543.9, 590.9)
    + L(51.0, 635.0, 543.9, 636.0) + L(51.0, 687.0, 543.9, 688.0) + L(51.0, 699.7, 543.9, 700.7) + L(51.0, 741.9, 543.9, 742.8)
    + L(193.1, 688.0, 194.0, 742.8) + L(318.5, 688.0, 319.5, 742.8));

  // hlavička
  h += T(73.5, 64.4, d.proforma ? tx.proforma : tx.titul, { b: true, size: 15.7 });
  h += T(450.8, 64.4, "#", { b: true, size: 15.7 }) + T(466.5, 64.4, String(d.cislo), { b: true, size: 15.7 });
  h += T(186.2, 105.9, "Mercedes Restorations", { b: true, size: 21.6 });

  // dodavatel
  h += T(63.7, 151.2, tx.dodavatel, { b: true, size: 10.8 });
  [FIRMA.nazev, FIRMA.ulice, FIRMA.mesto, FIRMA.zeme.cs].forEach((s, i) => h += T(63.7, 171.6 + i * 12.73, s));
  h += T(63.7, 235.3, `${tx.ico} ${FIRMA.ico}`) + T(63.7, 248.1, tx.dph);
  h += T(63.7, 260.8, FIRMA.rejstrik[tx.lang].kratce);                      // zápis v OR (varianta A, schváleno 28. 10.)
  h += T(63.7, 273.5, `${tx.ucet} ${FIRMA.ucet}`) + T(63.7, 286.3, `${tx.swift}  ${FIRMA.swift}`);
  h += T(63.7, 299.0, `${tx.banka} ${FIRMA.banka}`) + T(63.7, 311.8, `${tx.iban}    ${FIRMA.iban}`);
  h += T(182.1, 337.2, tx.forma, { r: true }) + T(196.0, 337.2, tx.prevod);
  h += T(182.1, 350.0, tx.vs, { r: true }) + T(196.0, 350.0, String(d.vs ?? d.cislo));       // VS jen z číslic (7377-3 → 73773)

  // odběratel
  const z = d.zakaznik;
  h += T(344.0, 151.2, tx.odberatel, { b: true, size: 10.8 });
  [z.jmeno, z.ulice, z.mesto, z.zeme].filter(Boolean).forEach((s, i) => h += T(344.0, 171.6 + i * 12.73, s));
  const firmaId = [z.ico ? `${tx.ico} ${z.ico}` : "", z.dic ? `${tx.dic} ${z.dic}` : ""].filter(Boolean).join("   ");
  h += T(344.0, 222.5, firmaId);
  h += T(344.0, 235.3, tx.tel) + T(376.3, 235.3, z.telefon);
  h += T(344.0, 248.1, tx.email) + T(376.3, 248.1, z.email);

  // vozidlo
  const v = d.vozidlo;
  h += T(344.0, 273.5, tx.vozidlo, { b: true });
  h += T(344.0, 299.1, v.znacka || "Mercedes-Benz");
  h += T(344.0, 311.8, tx.typ) + T(376.3, 311.8, v.typ);
  h += T(344.0, 324.5, tx.model) + T(376.3, 324.5, v.model);
  h += T(344.0, 337.2, tx.rok) + T(376.3, 337.2, v.rok);
  h += T(344.0, 350.0, tx.vin) + T(376.3, 350.0, v.vin);

  // tabulka – záhlaví
  h += T(COL.popisStred, 376.4, tx.popis, { b: true, c: true });
  h += T(COL.mn, 376.4, tx.mn, { b: true, c: true }) + T(COL.mj, 376.4, tx.mj, { b: true, c: true });
  h += T(COL.cena, 376.4, tx.cenaMj, { b: true, c: true }) + T(COL.celkem, 376.4, tx.celkem, { b: true, c: true });

  // položky práce
  let soucetPrace = 0, soucetHodin = 0;
  (d.polozky || []).slice(0, MAX_RADKU).forEach((p, i) => {
    const y = 389.2 + i * 12.73, typ = p.typ || "prace";
    if (typ !== "prazdny") h += T(COL.popisX, y, p.popis, { maxW: 341.0 - COL.popisX - 3 });
    if (typ === "pausal") {                       // jen částka (např. likvidace kapalin)
      soucetPrace += Number(p.castka); h += T(COL.celkem, y - 1.0, cislo0(p.castka), { c: true });
    } else if (typ === "prace") {
      const castka = p.mnozstvi * p.cena;
      soucetPrace += castka; if (p.jednotka === "h") soucetHodin += p.mnozstvi;
      h += T(COL.mn, y, mnozstvi(p.mnozstvi), { c: true }) + T(COL.mj, y, p.jednotka || "", { c: true });
      h += T(COL.cena, y - 1.0, String(p.cena), { c: true }) + T(COL.celkem, y - 1.0, cislo0(castka), { c: true });
    }                                             // typ "nadpis" = jen text (např. „Dodatečné práce dle další domluvy“)
  });

  // materiál a celkem
  const material = Number(d.material || 0), celkem = soucetPrace + material;
  h += T(COL.popisX, 554.8, tx.material) + T(COL.celkem, 553.8, cislo0(material), { c: true });
  h += T(COL.popisStred, 567.5, tx.celkemRadek, { b: true, c: true });
  h += T(COL.mn, 567.5, mnozstvi(soucetHodin), { b: true, c: true });
  h += T(COL.celkem, 567.7, `${cislo0(celkem)} ${tx.mena}`, { b: true, c: true });

  // upozornění
  h += T(60.8, 592.6, tx.zarukaH, { b: true, size: 7.8 });
  tx.zaruka.forEach((s, i) => h += T(60.8, 603.4 + i * 10.77, s, { size: 7.8 }));

  // data
  h += T(190.9, 651.8, tx.vystaveni, { r: true }) + T(196.0, 651.8, datum(d.vystaveno));
  h += T(190.9, 664.6, tx.splatnost, { r: true }) + T(196.0, 664.6, datum(d.druh === "nabidka" ? d.platnost : d.splatnost));

  // podpisy a celková částka
  h += T(128.0, 690.0, tx.vyhotovil, { b: true, c: true }) + T(256.9, 690.0, tx.prevzal, { b: true, c: true });
  h += T(431.9, 690.0, tx.celkovaCastka, { b: true, c: true });
  h += T(124.7, 702.8, d.vyhotovil || FIRMA.vyhotovil, { c: true }) + T(256.4, 702.8, z.jmeno, { c: true });
  h += T(81.3, 730.2, "…............................") + T(207.8, 730.2, "…..............................");
  h += T(431.5, 713.8, `${cislo2(celkem)} ${tx.mena}`, { b: true, size: 15.7, c: true });
  if (d.podpisVyhotovil) h += IMG(podpisSrc(d.podpisVyhotovil), 63.0, 707.9, 220.4, 753.7);
  if (d.podpisZakaznik) h += `<img class="abs" src="${d.podpisZakaznik}" style="left:200pt;top:707pt;width:115pt;height:30pt;object-fit:contain">`;

  h += paticka(1, 2);
  return { html: `<section class="page">${h}</section>`, celkem };
}

function strana2(tx) {
  let h = SVG(L(50.0, 53.9, 51.0, 772.2) + L(543.9, 54.9, 544.9, 772.2) + L(51.0, 53.9, 544.9, 54.9) + L(51.0, 771.3, 544.9, 772.2));
  h += T(73.5, 64.4, tx.titul, { b: true, size: 15.7 });
  h += T(tx.lang === "en" ? 245.0 : 251.9, 105.9, tx.informace, { b: true, size: 21.6 });
  let y = 156.9;
  tx.backpage.forEach(([nadpis, radky]) => {
    h += T(63.7, y, nadpis, { b: true }); y += 13.72;
    radky.forEach(r => { h += T(63.7, y, r); y += 13.72; });
    y += 13.72;
  });
  if (tx.obrazek) h += IMG(tx.obrazek, 69.9, 466.0, 518.9, 704.6);
  else { h += IMG("assets/auto-faktura.png", 50.6, 563.5, 542.8, 725.6); h += IMG("assets/logo-mr.png", 360.3, 640.5, 375.0, 656.2); }
  h += paticka(2, 2);
  return `<section class="page">${h}</section>`;
}

window.render = async function (data, lang = "cs") {
  await nactiPisma();
  const tx = { ...TEXTY[lang], ...(data.druh === "nabidka" ? NABIDKA[lang] : {}), lang };
  const s1 = strana1(data, tx);
  document.getElementById("doc").innerHTML = s1.html + strana2(tx);
  return { celkem: s1.celkem };
};
