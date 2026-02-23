/**
 * accounting-agent
 *
 * Polls for unprocessed print_jobs written by printing-agent.
 * For each job:
 *   1. Look up the spool to get cost-per-gram
 *   2. Deduct usageG from spool.remainingG
 *   3. Write a double-entry journal entry (debit COGS, credit Inventory)
 *   4. Mark the print_job processed: true
 *
 * Chart of accounts (must exist in the `accounts` collection):
 *   1200  Inventory - Filament   (asset)
 *   5000  Cost of Goods Sold     (cogs)
 */

import "dotenv/config";
import { MongoClient } from "mongodb";

const {
  MONGODB_URI,
  DB_NAME = "tektonology",
  POLL_INTERVAL_MS = "15000",
} = process.env;

if (!MONGODB_URI) throw new Error("Missing env var: MONGODB_URI");

const ACCOUNT_INVENTORY  = { number: 1200, name: "Inventory - Filament" };
const ACCOUNT_COGS       = { number: 5000, name: "Cost of Goods Sold" };

const mongo = new MongoClient(MONGODB_URI);
await mongo.connect();
const db = mongo.db(DB_NAME);

const printJobs      = db.collection("print_jobs");
const spools         = db.collection("spools");
const journalEntries = db.collection("journal_entries");

console.log(`bookkeeping-agent running — polling every ${POLL_INTERVAL_MS}ms`);

async function processJobs() {
  const unprocessed = await printJobs.find({ processed: false }).toArray();

  if (unprocessed.length === 0) return;

  console.log(`Found ${unprocessed.length} unprocessed job(s)`);

  for (const job of unprocessed) {
    try {
      await processJob(job);
    } catch (err) {
      console.error(`Failed to process job ${job._id}:`, err.message);
    }
  }
}

async function processJob(job) {
  const spool = await spools.findOne({ spoolId: job.spoolId });
  if (!spool) {
    console.error(`Spool ${job.spoolId} not found — skipping job ${job._id}`);
    return;
  }

  const costPerGram = spool.cost / spool.weightG;
  const cost = parseFloat((job.usageG * costPerGram).toFixed(4));
  const processedAt = new Date().toISOString();
  const date = job.loggedAt.slice(0, 10); // YYYY-MM-DD

  // Deduct from spool inventory
  await spools.updateOne(
    { spoolId: job.spoolId },
    { $inc: { remainingG: -job.usageG } }
  );

  // Double-entry journal: debit COGS, credit Inventory
  await journalEntries.insertOne({
    date,
    description: `${job.project} — ${job.usageG}g ${spool.material}`,
    printJobId: job._id,
    lines: [
      { accountNumber: ACCOUNT_COGS.number,       accountName: ACCOUNT_COGS.name,       debit: cost, credit: null },
      { accountNumber: ACCOUNT_INVENTORY.number,  accountName: ACCOUNT_INVENTORY.name,  debit: null, credit: cost },
    ],
  });

  // Mark job processed
  await printJobs.updateOne(
    { _id: job._id },
    { $set: { processed: true, processedAt, cost } }
  );

  console.log(`Processed "${job.project}": ${job.usageG}g @ $${costPerGram.toFixed(4)}/g = $${cost}`);
}

// Poll loop
async function poll() {
  try {
    await processJobs();
  } catch (err) {
    console.error("Poll error:", err.message);
  }
  setTimeout(poll, parseInt(POLL_INTERVAL_MS, 10));
}

// Process any backlog on startup, then begin polling
await poll();
