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
  if (!val || val.trim() === "" || val.includes("#REF!")) return null;
  const cleaned = val.replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function parseDate(val) {
  const parts = val.split("/");
  if (parts.length !== 3) return val;
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

console.log(`Seeding ${dbName} from CSVs in ${csvDir}...\n`);

// -- 1. Ledger → Accounts + Journal Entries --
const ledgerRows = readCsvFile("General Ledger - General Ledger(1).csv");
const accountMap = new Map();
const txMap = new Map();

for (const r of ledgerRows) {
  const acctRaw = r["Account"];
  const codeMatch = acctRaw.match(/^(\d+):\s*/);
  const typeMatch = acctRaw.match(/\[([^\]]+)\]\s*$/);
  const code = codeMatch ? parseInt(codeMatch[1], 10) : 0;
  const type = typeMatch ? typeMatch[1].toLowerCase() : "";
  let name = acctRaw;
  if (codeMatch) name = name.slice(codeMatch[0].length);
  if (typeMatch) name = name.slice(0, name.lastIndexOf("[")).trim();

  const debit = parseMoney(r["Debit (+)"]);
  const credit = parseMoney(r["Credit (-)"]);
  const txId = parseInt(r["Transaction ID"], 10);
  const date = parseDate(r["Date"]);

  if (!accountMap.has(code)) {
    accountMap.set(code, { number: code, name, type, balance: 0 });
  }
  accountMap.get(code).balance += (debit ?? 0) - (credit ?? 0);

  if (!txMap.has(txId)) {
    txMap.set(txId, { transactionId: txId, date, description: r["Description"], lines: [] });
  }
  txMap.get(txId).lines.push({
    accountNumber: code,
    accountName: name,
    debit,
    credit,
    description: r["Description"],
  });
}

const accountDocs = Array.from(accountMap.values());
await db.collection("accounts").deleteMany({});
await db.collection("accounts").insertMany(accountDocs);
console.log(`accounts: ${accountDocs.length} inserted`);

const journalDocs = Array.from(txMap.values());
await db.collection("journal_entries").deleteMany({});
await db.collection("journal_entries").insertMany(journalDocs);
console.log(`journal_entries: ${journalDocs.length} inserted`);

// -- 2. Spools --
const spoolRows = readCsvFile("General Ledger - Spools.csv");
const spoolDocs = spoolRows.map((r) => ({
  spoolId: parseInt(r["Spool ID"], 10),
  brand: r["Brand"],
  material: r["Material"],
  color: r["Color"],
  purchased: parseDate(r["Purchased"]),
  cost: parseMoney(r["Cost"]),
  weightG: parseFloat(r["Weight (g)"]),
  remainingG: parseFloat(r["Remaining (g)"]),
}));
await db.collection("spools").deleteMany({});
await db.collection("spools").insertMany(spoolDocs);
console.log(`spools: ${spoolDocs.length} inserted`);

// -- 3. Hardware --
const hardwareRows = readCsvFile("General Ledger - Hardware.csv");
const hardwareDocs = hardwareRows.map((r) => ({
  hardwareId: parseInt(r["Hardware ID"], 10),
  supplier: r["Supplier"],
  item: r["Item"].trim(),
  dimensions: r["Dimensions"],
  material: r["Material"],
  purchased: parseDate(r["Purchased"]),
  cost: parseMoney(r["Cost"]),
  quantity: parseInt(r["Quantity"], 10),
  remaining: parseInt(r["Remaining"], 10),
}));
await db.collection("hardware").deleteMany({});
await db.collection("hardware").insertMany(hardwareDocs);
console.log(`hardware: ${hardwareDocs.length} inserted`);

// -- 4. Print Jobs --
const jobRows = readCsvFile("General Ledger - Print Jobs.csv");
const jobDocs = jobRows.map((r) => {
  const spoolMatch = r["Spool"].match(/^(\d+):/);
  const loggedAt = parseDate(r["Date"]);
  const cost = parseMoney(r["Cost"]);
  return {
    project: r["Project"],
    spoolId: spoolMatch ? parseInt(spoolMatch[1], 10) : null,
    usageG: parseFloat(r["Usage (g)"]),
    loggedAt,
    processed: true,
    ...(cost != null ? { cost } : {}),
    processedAt: loggedAt,
  };
});
await db.collection("print_jobs").deleteMany({});
await db.collection("print_jobs").insertMany(jobDocs);
console.log(`print_jobs: ${jobDocs.length} inserted`);

console.log("\nSeed complete.");
await client.close();
