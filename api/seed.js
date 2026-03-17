import "../services/shared/env.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../tektonology-spa/data/accounting");

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/tektonology";
const dbName = process.env.DB_NAME ?? "tektonology";

function loadJson(file) {
  return JSON.parse(readFileSync(join(dataDir, file), "utf-8"));
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

console.log(`Seeding ${dbName}...\n`);

// -- 1. Accounts (chart of accounts from ledger entries) --
const ledger = loadJson("ledger.json");
const accountMap = new Map();
for (const e of ledger) {
  const num = parseInt(e.accountCode, 10);
  if (!accountMap.has(num)) {
    accountMap.set(num, {
      number: num,
      name: e.account,
      type: e.accountType.toLowerCase(),
      balance: 0,
    });
  }
  // Accumulate balance: debits increase, credits decrease (for normal debit accounts)
  const acct = accountMap.get(num);
  acct.balance += (e.debit ?? 0) - (e.credit ?? 0);
}

const accountDocs = Array.from(accountMap.values());
await db.collection("accounts").deleteMany({});
await db.collection("accounts").insertMany(accountDocs);
console.log(`accounts: ${accountDocs.length} inserted`);

// -- 2. Journal entries (group flat ledger by transactionId) --
const txMap = new Map();
for (const e of ledger) {
  if (!txMap.has(e.transactionId)) {
    txMap.set(e.transactionId, {
      transactionId: e.transactionId,
      date: e.date,
      description: e.description,
      lines: [],
    });
  }
  const tx = txMap.get(e.transactionId);
  tx.lines.push({
    accountNumber: parseInt(e.accountCode, 10),
    accountName: e.account,
    debit: e.debit,
    credit: e.credit,
    description: e.description,
  });
}

const journalDocs = Array.from(txMap.values());
await db.collection("journal_entries").deleteMany({});
await db.collection("journal_entries").insertMany(journalDocs);
console.log(`journal_entries: ${journalDocs.length} inserted`);

// -- 3. Spools --
const spoolDocs = loadJson("spools.json");
await db.collection("spools").deleteMany({});
await db.collection("spools").insertMany(spoolDocs);
console.log(`spools: ${spoolDocs.length} inserted`);

// -- 4. Hardware --
const hardwareDocs = loadJson("hardware.json");
await db.collection("hardware").deleteMany({});
await db.collection("hardware").insertMany(hardwareDocs);
console.log(`hardware: ${hardwareDocs.length} inserted`);

// -- 5. Print Jobs --
const printJobDocs = loadJson("print-jobs.json");
// Add fields expected by the agent model
for (const j of printJobDocs) {
  j.processed = true;
  j.processedAt = j.date;
  j.loggedAt = j.date;
}
await db.collection("print_jobs").deleteMany({});
await db.collection("print_jobs").insertMany(printJobDocs);
console.log(`print_jobs: ${printJobDocs.length} inserted`);

console.log("\nSeed complete.");
await client.close();
