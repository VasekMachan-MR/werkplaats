# Werkplaats – Mercedes Restorations

Firemní systém autoservisu Mercedes Restorations s.r.o.:
- **Werkplaats** – aplikace pro dílnu (werk.mercedesrestorations.cz)
- **E-serviska** – servisní knížka pro zákazníky (mercedesrestorations.cz/vin/VIN)

## Obsah
- `dokumenty/sablony/` – šablony dokumentů 1:1 podle originálů z Excelu (CZ + EN)
  - `zakazkovy-list.html` – zakázkový list / work order, a předávací protokol (`druh: "protokol"`)
  - `faktura.html` – faktura / invoice, a cenová nabídka (`druh: "nabidka"`)
  - `common.js`, `common.css` – společné funkce (písma, mřížka znaků 0,98 pt jako v Excelu, čísla, data, zalamování)
- `dokumenty/render.js` – vytvoří PDF ze šablony a dat:
  `node dokumenty/render.js dokumenty/sablony/faktura.html dokumenty/testovaci-data/faktura-cz.json vystup.pdf cs`
- `dokumenty/testovaci-data/` – smyšlená ukázková data (žádné údaje skutečných zákazníků)

## Pravidla
- Osobní údaje zákazníků a podpisy nikdy do gitu – patří do databáze / zabezpečeného úložiště.
- Písma: Liberation Sans/Serif (licence SIL OFL), metricky shodná s Arial/Helvetica/Times New Roman.
