# Weather to Move

Weather to Move helps homebuyers understand past weather near a property. This demo adds a weather drawer to a saved Rightmove listing for Magdalen Road, London, SW18, and links to an interactive report. It runs in the browser with React, TypeScript, Vite, and Astryx.

## Run it locally

### Install the prerequisites

1. Install **Node.js 24.x LTS** for your operating system. The installer includes npm. [Download Node.js](https://nodejs.org/en/download)
2. Install **Git** if you need to clone the project. [Install Git](https://git-scm.com/install/)

Open a new terminal and run `node --version`, `npm --version`, and `git --version` to check the installations. The Node.js version should start with `v24.`.

### Clone and start the demo

If you already have a checkout, open its folder in your terminal and start at `npm ci`.

```sh
git clone https://github.com/uyargorkem/weather-to-move.git
cd weather-to-move
npm ci
npm run dev
```

1. Open [the demo property page](http://localhost:5173/demo_page.html). If Vite chooses a different port, use the URL printed in the terminal and add `/demo_page.html`.
2. Click the cloud-and-sun **Weather insights** button next to **Save**. On narrow screens, look for **Weather insights** below the property address. The drawer shows the property's 2025 figures and compares them with Central London.
3. Click **See detailed report**. The report opens in a new tab. You can also [open it directly](http://localhost:5173/dashboard.html?property=95181078). Use the summary cards to jump to a section, then change its year or weather preferences.

The default demo uses the bundled weather data. After installing dependencies, you can run it without an Open-Meteo API key or a data download. If PowerShell blocks `npm.ps1`, use `npm.cmd` in the commands above.

## Checks and production preview

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

The build writes to `dist/`. Open `/demo_page.html` on the URL printed by the preview server, usually [localhost:4173](http://localhost:4173/demo_page.html).

## Where to look

| Path | Purpose |
| --- | --- |
| `demo_page.html` and `src/inject.tsx` | Saved Rightmove listing and the code that adds the weather button and mounts the drawer |
| `dashboard.html`, `src/dashboard.tsx`, and `src/pages/Dashboard.tsx` | Report entry point, section filters, and chart layout |
| `src/components/`, `src/styles/`, and `src/themes/rightmove/` | Shared UI, charts, styles, and the Astryx theme |
| `src/data/metrics.ts` and `src/data/insights.ts` | Weather calculations and summaries for the drawer and report |
| `data/locations.json` | Demo property IDs, coordinates, and the Central London reference point |
| `data/raw/` and `src/data/fixtures/` | Hourly records used to recalculate preferences and precomputed summaries used on initial load |
| `scripts/` and `public/` | Data maintenance commands, fonts, and branding |

The [original design notes](docs/archive/2026-11-11-weather-to-move-design.md) are in `docs/archive/`.

## Weather data

The bundled Open-Meteo IFS records cover **1 January 2017 to 10 November 2026** for Magdalen Road and Central London. The report can use the full range or a single year. Its personalisation controls recalculate from the bundled hourly records when first used.

To try a different source, add `?source=live` to the property URL or `&source=live` to the report URL above. Live mode requests data from Open-Meteo, caches the summary in the browser, and uses bundled data if the request fails. Use `source=dummy` to preview the report with sample figures. The 2025 drawer requires a full year's data, which the sample source lacks.

### Refresh the bundled records

```sh
npm run fetch -- --start=2017-01-01 --end=2026-11-10
npm run compute
```

The dates are inclusive. `fetch` downloads matching hourly records for the properties and Central London. With no flags it skips existing files and reuses the stored date range. Use `--force` to refresh the rolling range, or pass explicit dates as above. `compute` rebuilds the summaries locally. Keep a full calendar year of 2025 in the range for the property drawer.

### Add a demo property

1. Add the property ID, label, latitude, and longitude to `data/locations.json`.
2. Save the listing with SingleFile. For the local demo copy, remove the saved page's CSP meta tag and add `<script type="module" src="/src/inject.tsx"></script>` so Vite can load the weather UI. Keep an untouched copy separately if you need it.
3. Run `npm run fetch` and then `npm run compute`. Open the saved page with `?property=<id>` to select the new property's data. To ship another listing in the production build, add its HTML file to the inputs in `vite.config.ts`.
