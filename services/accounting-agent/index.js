/**
 * accounting-agent
 *
 * Listens for print-job-completed events via BullMQ.
 * For each job:
 *   1. Look up the spool to get cost-per-gram
 *   2. Deduct usageG from spool.remainingG
 *   3. Write a double-entry journal entry (debit COGS, credit Inventory)
 *   4. Mark the print_job processed: true
 *
 * Also processes any backlog of unprocessed jobs on startup.
 *
 * Chart of accounts (must exist in the `accounts` collection):
 *   1200  Inventory - Filament   (asset)
 *   5000  Cost of Goods Sold     (cogs)
 */

import "../shared/env.js";
import { MongoClient } from "mongodb";
import { createWorker, QUEUE_NAMES } from "../agent-bus/index.js";
import { processJob, drainBacklog } from "./bookkeeping.js";

const {
  MONGODB_URI,
  DB_NAME = "tektonology",
} = process.env;

if (!MONGODB_URI) throw new Error("Missing env var: MONGODB_URI");

const mongo = new MongoClient(MONGODB_URI);
await mongo.connect();
const db = mongo.db(DB_NAME);

const collections = {
  printJobs:      db.collection("print_jobs"),
  spools:         db.collection("spools"),
  journalEntries: db.collection("journal_entries"),
};

// --- Process any backlog from before the worker was running ---
const backlogCount = await drainBacklog(collections);
if (backlogCount > 0) {
  console.log(`Processed ${backlogCount} backlogged job(s)`);
}

// --- BullMQ Worker ---
const worker = createWorker(
  QUEUE_NAMES.PRINT_JOB_COMPLETED,
  async (bullJob) => {
    const { printJobId, project, spoolId, usageG } = bullJob.data;
    console.log(`Received job: "${project}" (${printJobId})`);
    const { cost, costPerGram } = await processJob(printJobId, { project, spoolId, usageG }, collections);
    console.log(`Processed "${project}": ${usageG}g @ $${costPerGram.toFixed(4)}/g = $${cost}`);
  },
  {
    autorun: false,
    limiter: { max: 1, duration: 1000 },
  }
);

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

worker.on("error", (err) => {
  console.error("Worker error:", err.message);
});

worker.run();
console.log("accounting-agent running — listening for print-job-completed events");
