/**
 * One-time seed: reads finops/General Ledger - Inventory_ Filament.csv
 * and inserts documents into the Atlas `spools` collection.
 *
 * Usage:
 *   ATLAS_APP_ID=<id> ATLAS_API_KEY=<key> node services/seed-spools.js
 *
 * Or create services/.env with those two vars and run:
 *   node --env-file=services/.env services/seed-spools.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ATLAS_APP_ID = process.env.ATLAS_APP_ID;
const ATLAS_API_KEY = process.env.ATLAS_API_KEY;

if (!ATLAS_APP_ID || !ATLAS_API_KEY) {
  console.error("Set ATLAS_APP_ID and ATLAS_API_KEY before running.");
  process.exit(1);
}

const DB = "tektonology";
const COLLECTION = "spools";
const CSV_PATH = join(__dirname, "..", "finops", "General Ledger - Inventory_ Filament.csv");

// Parse a dollar string like "$48.13" → 48.13
function parseDollar(val) {
  return parseFloat(val.replace(/[$,]/g, "")) || 0;
}

// Convert M/D/YYYY → YYYY-MM-DD
function parseDate(val) {
  const [m, d, y] = val.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseCsv(raw) {
  const [headerLine, ...rows] = raw.trim().split("\n");
  const headers = headerLine.split(",").map((h) => h.trim());
  return rows.map((row) => {
    const cols = row.split(",").map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
  });
}

const raw = readFileSync(CSV_PATH, "utf-8");
const rows = parseCsv(raw);

const documents = rows
  .filter((r) => r["Spool ID"] && !isNaN(parseInt(r["Spool ID"], 10)) && r["Brand"])
  .map((r) => ({
    spoolId: parseInt(r["Spool ID"], 10),
    brand: r["Brand"],
    material: r["Material"],
    color: r["Color"],
    purchased: parseDate(r["Purchased"]),
    cost: parseDollar(r["Cost"]),
    weightG: parseInt(r["Weight (g)"], 10),
    remainingG: parseInt(r["Remaining (g)"], 10),
  }));

console.log(`Seeding ${documents.length} spools into Atlas...`);

const res = await fetch(
  `https://data.mongodb-api.com/app/${ATLAS_APP_ID}/endpoint/data/v1/action/insertMany`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": ATLAS_API_KEY,
    },
    body: JSON.stringify({
      dataSource: "Cluster0",
      database: DB,
      collection: COLLECTION,
      documents,
    }),
  }
);

if (res.ok) {
  const result = await res.json();
  console.log(`Inserted ${result.insertedIds?.length ?? "?"} documents.`);
  console.log("IDs:", result.insertedIds);
} else {
  const err = await res.text();
  console.error("Atlas error:", err);
  process.exit(1);
}
