import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { renderPamphlet, type MassPropers } from "./template.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Output directory for generated pamphlets */
const OUTPUT_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "web",
  "app",
  "info",
  "instructions",
  "catholicism"
);

/**
 * USCCB daily readings URL pattern:
 *   https://bible.usccb.org/bible/readings/MMDDYY.cfm
 *
 * The generation flow:
 *  1. For each date in range, fetch the USCCB readings page
 *  2. Parse the HTML to extract: readings, psalm refrain, gospel, season, color
 *  3. Feed the parsed data into renderPamphlet() from template.ts
 *  4. Write the result to order-of-mass-yyyy-mm-dd.html
 */

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toUSCCBSlug(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${mm}${dd}${yy}`;
}

function usccbUrl(d: Date): string {
  return `https://bible.usccb.org/bible/readings/${toUSCCBSlug(d)}.cfm`;
}

function dateRange(startDate: Date, days: number): Date[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * TODO: Implement the actual fetch + parse logic.
 *
 * This stub demonstrates the intended flow. A real implementation would:
 *  - fetch(usccbUrl(date)) for each date
 *  - parse the response HTML (e.g., with cheerio) to extract:
 *    • liturgical designation, season, color
 *    • first reading citation + text
 *    • responsorial psalm citation + refrain
 *    • second reading citation + text
 *    • gospel acclamation verse
 *    • gospel citation + text
 *  - handle weekdays (which may lack a second reading)
 *  - determine liturgical cycle (A/B/C for Sundays)
 */
async function fetchPropers(date: Date): Promise<MassPropers | null> {
  const iso = toISODate(date);
  const url = usccbUrl(date);
  console.log(`  [fetch] ${iso} → ${url}`);

  // TODO: replace with actual fetch + parse
  console.log(`  [skip]  parsing not yet implemented for ${iso}`);
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const daysFlag = args.indexOf("--days");
  const days = daysFlag !== -1 ? parseInt(args[daysFlag + 1], 10) : 30;

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  console.log(
    `Generating Order of Mass pamphlets for ${days} days starting ${toISODate(startDate)}`
  );
  console.log(`Output: ${OUTPUT_DIR}\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const dates = dateRange(startDate, days);
  let generated = 0;

  for (const date of dates) {
    const propers = await fetchPropers(date);
    if (!propers) continue;

    const html = renderPamphlet(propers);
    const filename = `order-of-mass-${toISODate(date)}.html`;
    writeFileSync(join(OUTPUT_DIR, filename), html, "utf-8");
    console.log(`  [write] ${filename}`);
    generated++;
  }

  console.log(`\nDone. Generated ${generated}/${days} pamphlets.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
