# mass-guide-agent

Generates printable Order of Mass pamphlets for the Catholic Ordinary Form (Roman Rite). Each pamphlet includes the day's proper readings, psalm, and season-specific rubrics baked into a print-ready HTML file.

## How It Works

1. Iterates over a date range (default: today + 30 days)
2. For each date, fetches the USCCB daily readings page
3. Parses the HTML to extract readings, psalm refrain, season, and liturgical color
4. Renders the data into the pamphlet template (`src/template.ts`)
5. Writes `order-of-mass-yyyy-mm-dd.html` to `tektonology-spa/app/info/instructions/catholicism/`

## Usage

```bash
npm install
npm run generate              # next 30 days
npm run generate -- --days 7  # custom range
```

## Status

The template and output pipeline are complete. The USCCB fetch + parse step is stubbed — it logs the URL for each date but does not yet scrape the readings. Next steps:

- Add `cheerio` (or similar) to parse USCCB response HTML
- Extract: designation, season, color, readings, psalm, gospel
- Handle weekdays (may have no second reading)
- Determine Sunday lectionary cycle (A/B/C) from year
- Add scheduling (cron / GitHub Actions) for automatic regeneration

## Output

Files land in:

```
tektonology-spa/app/info/instructions/catholicism/order-of-mass-2026-03-01.html
tektonology-spa/app/info/instructions/catholicism/order-of-mass-2026-03-02.html
...
```

Each file is a self-contained, print-ready HTML document (landscape, 2-column grid, front-and-back on one sheet).
