# Schaats Klassement Tool (simpel & snel)

Een superlicht tooltje (static HTML/CSS/JS) om bij een schaatswedstrijd twee omlopen per rijder in te voeren en automatisch een klassement te krijgen.

## Functionaliteit

- 10 rijders onder elkaar
- Per rijder:
  - **Naam**
  - **1e omloop** (tijd)
  - **2e omloop** (tijd)
  - **Beste tijd** (snelste van de geldige tijden)
- **Regel:** de tijd van de **2e omloop telt pas mee zodra je die invult**. (Dus leeg = niet meenemen.)
- Klassement van snelste → langzaamste
- Top 10 snelste tijden (zelfde lijst, beperkt tot 10)
- Reset knop en CSV export

## Tijdsnotatie

Vul tijden in als:
- `SS,mmm` (bijv. `40,123`)

> De tool accepteert ook een punt als scheiding: `40.123`.

## Lokaal draaien

Open `index.html` in je browser.

## Publiceren via GitHub Pages

1. Maak een repository aan (bijv. `schaats-klassement-tool`)
2. Upload alle bestanden (`index.html`, `styles.css`, `app.js`, `README.md`)
3. Ga naar **Settings → Pages**
4. Kies:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` (of `master`) en map `/root`
5. Open daarna de Pages-URL

## Aanpassen naar jouw 10 namen

Open `app.js` en vervang de `DEFAULT_NAMES` lijst bovenin.

Veel plezier!
