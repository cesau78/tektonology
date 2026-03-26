import "../services/shared/env.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { parseCsv } from "./csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvDir = join(__dirname, "..", "ai-collab");

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/tektonology";
const dbName = process.env.DB_NAME ?? "tektonology";

function readCsvFile(filename) {
  return parseCsv(readFileSync(join(csvDir, filename), "utf-8"));
}

function parseMoney(val) {
  if (!val || val.trim() === "" || val.includes("#REF!") || val.includes("#N/A")) return 0;
  const cleaned = val.replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function parseDate(val) {
  if (!val || !val.trim()) return "";
  const parts = val.split("/");
  if (parts.length !== 3) return val;
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseFloat0(val) {
  if (!val || val.includes("#N/A") || val.includes("#DIV/0!") || val.includes("#REF!")) return 0;
  const num = parseFloat(val);
  return Number.isNaN(num) ? 0 : num;
}

function parseInt0(val) {
  if (!val || val.includes("#N/A")) return 0;
  const num = parseInt(val, 10);
  return Number.isNaN(num) ? 0 : num;
}

/** Parse "HH:MM:SS" or decimal hours into a float */
function parseHours(val) {
  if (!val || val.includes("#N/A") || val.includes("#DIV/0!")) return 0;
  // Handle HH:MM:SS format
  const hms = val.match(/^(\d+):(\d+):(\d+)$/);
  if (hms) {
    return parseInt(hms[1], 10) + parseInt(hms[2], 10) / 60 + parseInt(hms[3], 10) / 3600;
  }
  const num = parseFloat(val);
  return Number.isNaN(num) ? 0 : num;
}

/** Extract the numeric ID prefix from a lookup string like "1:0.4mm Stainless" */
function parseIdPrefix(val) {
  if (!val) return null;
  const m = val.match(/^(\d+):/);
  return m ? parseInt(m[1], 10) : null;
}

const now = new Date().toISOString();
const audit = { createdAt: now, updatedAt: now };

/** Map CSV "Usage" column to PrintJobOutcome */
function parseOutcome(usage, success) {
  if (success === "FALSE" || success === "N/A") return "prototype";
  const u = (usage ?? "").toLowerCase();
  if (u === "prototype") return "prototype";
  if (u === "tooling" || u === "tool") return "tooling";
  if (u === "failed" || success === "FALSE") return "failed";
  return "production";
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

console.log(`Seeding ${dbName} from CSVs in ${csvDir}...\n`);

// -- 1. Chart of Accounts (use dedicated CSV for accurate balances) --
const coaRows = readCsvFile("General Ledger - Chart of Accounts.csv");
const accountDocs = coaRows.map((r) => ({
  number: parseInt(r["Number"], 10),
  name: r["Name"],
  type: r["Type"].toLowerCase(),
  balance: parseFloat0(r["Balance"]),
  ...audit,
}));
await db.collection("accounts").deleteMany({});
await db.collection("accounts").insertMany(accountDocs);
console.log(`accounts: ${accountDocs.length} inserted`);

// -- 2. General Ledger → Journal Entries --
const ledgerRows = readCsvFile("General Ledger - General Ledger.csv");
const txMap = new Map();

for (const r of ledgerRows) {
  const acctRaw = r["Account"];
  const codeMatch = acctRaw.match(/^(\d+):\s*/);
  const typeMatch = acctRaw.match(/\[([^\]]+)\]\s*$/);
  const code = codeMatch ? parseInt(codeMatch[1], 10) : 0;
  let name = acctRaw;
  if (codeMatch) name = name.slice(codeMatch[0].length);
  if (typeMatch) name = name.slice(0, name.lastIndexOf("[")).trim();

  const debit = parseMoney(r["Debit (+)"]) || null;
  const credit = parseMoney(r["Credit (-)"]) || null;
  const txId = parseInt(r["Transaction ID"], 10);
  const date = parseDate(r["Date"]);

  if (!txMap.has(txId)) {
    txMap.set(txId, { transactionId: txId, effective: date, description: r["Description"], lines: [], ...audit });
  }
  txMap.get(txId).lines.push({
    accountNumber: code,
    accountName: name,
    debit,
    credit,
  });
}

const journalDocs = Array.from(txMap.values());
await db.collection("journal_entries").deleteMany({});
await db.collection("journal_entries").insertMany(journalDocs);
console.log(`journal_entries: ${journalDocs.length} inserted`);

// -- 3. Spools --
const spoolRows = readCsvFile("General Ledger - Spools.csv");
const spoolDocs = spoolRows
  .filter((r) => r["Spool ID"] && !r["Spool ID"].includes("#"))
  .map((r) => ({
    spoolId: parseInt(r["Spool ID"], 10),
    brand: r["Brand"],
    material: r["Material"],
    color: r["Color"],
    effective: parseDate(r["Purchased"]),
    cost: parseMoney(r["Cost"]),
    weightG: parseFloat0(r["Weight (g)"]),
    remainingG: parseFloat0(r["Remaining (g)"]),
    ...audit,
  }));
await db.collection("spools").deleteMany({});
await db.collection("spools").insertMany(spoolDocs);
console.log(`spools: ${spoolDocs.length} inserted`);

// -- 4. Hardware --
const hardwareRows = readCsvFile("General Ledger - Hardware.csv");
const hardwareDocs = hardwareRows.map((r) => ({
  hardwareId: parseInt(r["Hardware ID"], 10),
  supplier: r["Supplier"],
  supplierId: r["Supplier ID"]?.trim() || null,
  item: r["Item"].trim(),
  dimensions: r["Dimensions"],
  material: r["Material"],
  effective: parseDate(r["Purchased"]),
  baseCost: parseMoney(r["Base Cost"]),
  taxes: parseMoney(r["Taxes"]),
  shipping: parseMoney(r["Shipping"]),
  cost: parseMoney(r["Cost"]),
  quantity: parseInt0(r["Quantity"]),
  remaining: parseInt0(r["Remaining"]),
  ...audit,
}));
await db.collection("hardware").deleteMany({});
await db.collection("hardware").insertMany(hardwareDocs);
console.log(`hardware: ${hardwareDocs.length} inserted`);

// -- 5. Nozzles --
const nozzleRows = readCsvFile("General Ledger - Nozzles.csv");
const nozzleDocs = nozzleRows.map((r) => ({
  nozzleId: parseInt(r["Plate ID"], 10), // CSV header says "Plate ID" but it's the nozzle ID
  brand: r["Brand"],
  nozzle: r["Nozzle"],
  effective: parseDate(r["Purchased"]),
  baseCost: parseMoney(r["Base Cost"]),
  taxes: parseMoney(r["Taxes"]),
  shipping: parseMoney(r["Shipping"]),
  cost: parseMoney(r["Cost"]),
  hoursUsed: parseFloat0(r["Hours"]),
  ...audit,
}));
await db.collection("nozzles").deleteMany({});
await db.collection("nozzles").insertMany(nozzleDocs);
console.log(`nozzles: ${nozzleDocs.length} inserted`);

// -- 6. Plates --
const plateRows = readCsvFile("General Ledger - Plates.csv");
const plateDocs = plateRows.map((r) => ({
  plateId: parseInt(r["Plate ID"], 10),
  brand: r["Brand"],
  plate: r["Plate"],
  effective: parseDate(r["Purchased"]),
  baseCost: parseMoney(r["Base Cost"]),
  taxes: parseMoney(r["Taxes"]),
  shipping: parseMoney(r["Shipping"]),
  cost: parseMoney(r["Cost"]),
  hoursUsed: parseFloat0(r["Hours"]),
  ...audit,
}));
await db.collection("plates").deleteMany({});
await db.collection("plates").insertMany(plateDocs);
console.log(`plates: ${plateDocs.length} inserted`);

// -- 7. Print Jobs --
const jobRows = readCsvFile("General Ledger - Print Jobs.csv");
const jobDocs = jobRows
  .filter((r) => {
    // Skip rows that are mostly error values
    const id = r["Batch ID"];
    return id && !id.includes("#") && parseInt(id, 10) > 0;
  })
  .map((r) => {
    const spoolId = parseIdPrefix(r["Spool"]);
    const nozzleId = parseIdPrefix(r["Nozzle"]);
    const plateId = parseIdPrefix(r["Plate"]);
    const effective = parseDate(r["Date"]);
    const cost = parseMoney(r["Cost"]);
    const outcome = parseOutcome(r["Usage"], r["Success"]);
    const hours = parseHours(r["Hours"]);
    const quantity = parseInt0(r["Quantity"]);
    const part = r["Part"]?.trim() || "";

    const components =
      outcome !== "failed" && part
        ? [{ part, quantity: quantity || 1, stlUrl: "" }]
        : [];

    return {
      project: r["Project"],
      outcome,
      printerId: 1, // Only one printer in the CSV ("A1 Lab - Zigbu")
      nozzleId: nozzleId ?? 1,
      plateId: plateId ?? 1,
      spoolId: spoolId ?? 1,
      usageG: parseFloat0(r["Usage (g)"]),
      hours,
      components,
      effective,
      processed: true,
      ...(cost ? { cost } : {}),
      processedAt: effective,
      ...audit,
    };
  });
await db.collection("print_jobs").deleteMany({});
await db.collection("print_jobs").insertMany(jobDocs);
console.log(`print_jobs: ${jobDocs.length} inserted`);

// -- 8. Component Stock (printed parts ready for assembly) --
const compRows = readCsvFile("General Ledger - Components.csv");
const compDocs = compRows.map((r, i) => {
  // Batch format: "30:20260305:101g" → extract batchId and date
  const batchParts = r["Batch"]?.split(":") ?? [];
  const batchId = parseInt(batchParts[0], 10) || (i + 1);
  let effective = "";
  if (batchParts.length >= 2) {
    const d = batchParts[1];
    effective = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }

  return {
    batchId,
    part: r["Part"]?.trim() || "",
    effective,
    quantity: parseInt0(r["Quantity"]),
    remaining: parseInt0(r["Remaining"]),
    ...audit,
  };
});
await db.collection("component_stock").deleteMany({});
await db.collection("component_stock").insertMany(compDocs);
console.log(`component_stock: ${compDocs.length} inserted`);

// -- 9. Inventory (assembled products) --
// Reference component_stock batches by batchId
const insertedBatches = await db.collection("component_stock").find({}).toArray();
function findBatchId(part) {
  const batch = insertedBatches.find((b) => b.part === part);
  return batch?.batchId ?? 0;
}

const invDocs = [
  {
    inventoryId: 1,
    product: "Compound Fastened Boot",
    effective: "2026-03-15",
    components: [
      { batchId: findBatchId("Cap, Slipper"), part: "Cap, Slipper", quantity: 45 },
      { batchId: findBatchId("Insert"), part: "Insert", quantity: 45 },
    ],
    hardware: [
      { hardwareId: 1, item: "M3x20 Socket Cap Bolt", quantity: 90 },
      { hardwareId: 2, item: "M3 Hex Nut", quantity: 90 },
    ],
    quantity: 45,
    remaining: 27,
    ...audit,
  },
];
await db.collection("inventory").deleteMany({});
await db.collection("inventory").insertMany(invDocs);
console.log(`inventory: ${invDocs.length} inserted`);

console.log("\nSeed complete.");
await client.close();
