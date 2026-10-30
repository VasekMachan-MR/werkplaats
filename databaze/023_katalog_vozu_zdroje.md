# Katalog klasických Mercedes-Benz – zdroje a nejistoty

Soubor: `katalog.json` (242 řádků). Sestaveno 30. 10. 2026.

## Použité zdroje

**Wikipedia EN (hlavní zdroj: typová čísla, motory, roky)**
- https://en.wikipedia.org/wiki/Mercedes-Benz_W123
- https://en.wikipedia.org/wiki/Mercedes-Benz_W124
- https://en.wikipedia.org/wiki/Mercedes-Benz_W126
- https://en.wikipedia.org/wiki/Mercedes-Benz_W201
- https://en.wikipedia.org/wiki/Mercedes-Benz_W116
- https://en.wikipedia.org/wiki/Mercedes-Benz_W108
- https://en.wikipedia.org/wiki/Mercedes-Benz_W111
- https://en.wikipedia.org/wiki/Mercedes-Benz_W113
- https://en.wikipedia.org/wiki/Mercedes-Benz_W114
- https://en.wikipedia.org/wiki/Mercedes-Benz_R107_and_C107
- https://en.wikipedia.org/wiki/Mercedes-Benz_R129
- https://en.wikipedia.org/wiki/Mercedes-Benz_S-Class_(W140)
- https://en.wikipedia.org/wiki/Mercedes-Benz_600

**Wikipedia DE (kontrola: W126, W124, W123, R107, W111, W113)**
- https://de.wikipedia.org/wiki/Mercedes-Benz_Baureihe_126
- https://de.wikipedia.org/wiki/Mercedes-Benz_Baureihe_124
- https://de.wikipedia.org/wiki/Mercedes-Benz_Baureihe_123
- https://de.wikipedia.org/wiki/Mercedes-Benz_R_107
- https://de.wikipedia.org/wiki/Mercedes-Benz_Baureihe_111
- https://de.wikipedia.org/wiki/Mercedes-Benz_W_113

**Greg Franks – seznam modelů pro trh USA (typová čísla + čísla motorů; hlavní zdroj pro W100, W109, W112, W114/W115 a kódy motorů R107)**
- https://mercedes.invivo.bg/models/models-us.html

**TecDoc katalog (rolling.hu / Schaeffler) – křížová kontrola typových čísel**
- https://shop.rolling.hu/catalog/SCHAEFFLER/mercedes-benz/sub (rozcestník)
- …/mercedes-benz-8-w114-011968-111976/sub, …/mercedes-benz-8-w115-011968-011977/sub, …/mercedes-benz-8-coupe-w114-041969-021977/sub
- …/mercedes-benz-8-w114-280-e-114062 (detail 280 E: M110.981, 136 kW)
- …/mercedes-benz-123-saloon-w123-011976-121985/sub, …/mercedes-benz-123-coupe-c123-031977-121985/sub, …/mercedes-benz-123-t-model-s123-091977-121986/sub
- …/mercedes-benz-190-w201-101982-081993/sub
- …/mercedes-benz-s-class-saloon-w108-w109-011966-081972/sub, …/mercedes-benz-s-class-w116-081972-071980/sub, …/mercedes-benz-s-class-w126-101979-061991/sub, …/mercedes-benz-s-class-w140-021991-101998/sub
- …/mercedes-benz-sl-r107-051971-121989/sub, …/mercedes-benz-sl-coupe-c107-011972-081985/sub, …/mercedes-benz-sl-r129-031989-092004/sub
- …/mercedes-benz-heckflosse-w111-w112-081959-011968/sub, …/mercedes-benz-coupe-w111-w112-011961-121971/sub, …/mercedes-benz-cabriolet-w111-w112-091961-121971/sub
- https://shop.rolling.hu/catalog/SCHAEFFLER/mercedes-benz-s-class-coupe-c140-seccl-420-140063 (C140 420, jen titulek z vyhledávání)

**Jednotlivé ověření**
- https://rmsothebys.com/auctions/sm23/lots/p0048-1978-mercedesbenz-250-lang – podvozkové číslo 123.028.12.052873 potvrzuje typ 123.028 pro 250 lang (V123)

## ⚠️ NEOVĚŘENÉ řádky (`"poznamka"` začíná „neověřeno")

| Řada | Typ | Model | Proč |
|---|---|---|---|
| W123 (V123) | 123.125 | 240 D lang | typové číslo z paměti, nenalezeno v žádném zdroji |
| W123 (V123) | 123.132 | 300 D lang | typové číslo z paměti, nenalezeno v žádném zdroji |
| W124 (S124) | 124.186 | E 250 T Diesel | Wikipedia tiskne „123.186" (překlep), opraveno podle logiky číslování |
| C107 | 107.026 | 500 SLC | typ převzat od 450 SLC 5.0 (107.026), ve zdroji pro 500 SLC výslovně není |
| W201 | 201.028 | 190 E 2.3 (USA, M102.961, 1983–85) | Wikipedia typ neuvádí; 201.028 jen podle TecDoc |
| W201 | 201.035 | 190 E 2.5-16 Evolution | Wikipedia 201.035 × TecDoc 201.036 – rozpor |
| W201 | 201.036 | 190 E 2.5-16 Evolution II | typ jen z Wikipedie |
| W201 | 201.126 | 190 D 2.5 | TecDoc 201.126 × EN Wikipedia 201.125 – rozpor |
| W140 (C140) | 140.063 | S 420 Coupé / CL 420 | typ jen z TecDoc, roky výroby (1996–98) z paměti |

## Další upozornění (řádky ponechány bez „neověřeno", ale stojí za kontrolu)

- **Zadání vs. realita:** v zadání uvedené příklady „107.048 380 SL" a „126.039 300 SD" nesedí. Podle všech zdrojů je **107.045 = 380 SL**, **107.048 = 560 SL**, **126.039 = 560 SEL** a **126.120 = 300 SD**.
- **W123 230 C / 230 T:** EN Wikipedia je má prohozené (230 C 123.083, 230 T 123.043). Použito podle TecDoc a logiky číslování: **230 C = 123.043, 230 T = 123.083**.
- **W111 280 SE 3.5 Cabriolet:** Wikipedia 111.027, TecDoc 111.025 (to je 280 SE Cabriolet). Použito 111.027.
- **W109 300 SEL 2.8 (109.016):** Greg Franks uvádí motor M189.981 pro 1967–70 a M130.981 pro 1971; Wikipedia (označení „W 109 E 28") ukazuje na M130 2.8. Použito M130, 2778 ccm.
- **W116 300 SD:** výkon 82 kW = 110 hp SAE (USA); u MY1980 89 kW.
- **R107 / C107:** podrobné kódy motorů (např. M117.982/985, M116.960/962, M117.967) jsou z US seznamu Greg Franks; u evropských verzí se mohou lišit. Kódy u 280 SL/SLC, 350 SL/SLC, 500 SL, 420 SL, 300 SL nejsou uvedeny (zdroj je neuvádí).
- **R107 450 SL / C107 450 SLC:** rozdělení D-Jetronic → K-Jetronic na roky 1975/1976 je přibližné.
- **W116 450 SE/SEL:** totéž (M117.983 → M117.986, přechod 1975/76). U 280 SE/SEL a 350 SE/SEL proběhla podobná změna, ale kvůli nejistým kódům zůstaly v jednom řádku (viz poznámka).
- **W114 230 (114.015):** objem 2292 ccm (M180 2.3); u W111 230 S Wikipedia uvádí 2306/2307 ccm.
- **W114 280 CE (114.072):** kód motoru M110.981 odvozen od sedanu 280 E (114.062).
- **W115 200 (115.015):** kód motoru M115 bez podverze (zdroj neuvádí).
- **R129 300 SL / 300 SL-24 / 500 SL:** EN Wikipedia uvádí začátek 1988, výroba ale začala 03/1989 (TecDoc) → použito 1989.
- **W124 – 4MATIC** řádky mají karoserii „sedan"/„kombi" a poznámku „pohon 4MATIC". **E 60 AMG** a **E 36 AMG** nemají samostatné řádky (stejné/neuvedené typové číslo).
- **W124 200 D / 250 D / 300 D:** od r. 1989 mírné zvýšení výkonu (uvedeno v poznámce, stejný typ i kód motoru).
- **Výkony:** uvedeny pro evropskou verzi bez katalyzátoru (RÜF), pokud není řečeno jinak; varianty s katalyzátorem a US výkony jsou v poznámce.

## Vynechané (záměrně, kvůli nejistotě)

- **W460/W461 (G)** – volitelné; TecDoc uvádí jen „460,2"/„460,3", spolehlivá typová čísla jsem nenašel.
- **W100 600 Landaulet** – Greg Franks uvádí „100.615", ověřit se nepodařilo.
- **W115 lang (220 D / 240 D lang)** a **V124 (250 D lang, 260 E lang, E 280 lang)** – typová čísla nenalezena.
- **W201 190 E 1.7** a **190 D 2.2 (USA)** – Wikipedia u nich typ neuvádí nebo je v rozporu.
- **W110** (190 c, 200, 230) – mimo zadaný rozsah.
