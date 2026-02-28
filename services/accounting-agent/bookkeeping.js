import { ObjectId } from "mongodb";

const ACCOUNT_INVENTORY = { number: 1200, name: "Inventory - Filament" };
const ACCOUNT_COGS      = { number: 5000, name: "Cost of Goods Sold" };

/**
 * Process a single print job: calculate cost, deduct spool inventory,
 * create double-entry journal entry, mark job processed.
 */
export async function processJob(printJobId, data, { printJobs, spools, journalEntries }) {
  const job = data.usageG != null
    ? data
    : await printJobs.findOne({ _id: new ObjectId(printJobId) });

  if (!job) {
    throw new Error(`Print job ${printJobId} not found in MongoDB`);
  }

  const spool = await spools.findOne({ spoolId: job.spoolId });
  if (!spool) {
    throw new Error(`Spool ${job.spoolId} not found — skipping job ${printJobId}`);
  }

  const costPerGram = spool.cost / spool.weightG;
  const cost = parseFloat((job.usageG * costPerGram).toFixed(4));
  const processedAt = new Date().toISOString();
  const loggedAt = job.loggedAt ?? new Date().toISOString();
  const date = loggedAt.slice(0, 10);

  await spools.updateOne(
    { spoolId: job.spoolId },
    { $inc: { remainingG: -job.usageG } }
  );

  await journalEntries.insertOne({
    date,
    description: `${job.project} — ${job.usageG}g ${spool.material}`,
    printJobId: new ObjectId(printJobId),
    lines: [
      { accountNumber: ACCOUNT_COGS.number,       accountName: ACCOUNT_COGS.name,       debit: cost, credit: null },
      { accountNumber: ACCOUNT_INVENTORY.number,  accountName: ACCOUNT_INVENTORY.name,  debit: null, credit: cost },
    ],
  });

  await printJobs.updateOne(
    { _id: new ObjectId(printJobId) },
    { $set: { processed: true, processedAt, cost } }
  );

  return { cost, costPerGram, date };
}

/**
 * Process any unprocessed jobs from MongoDB (backlog drain).
 */
export async function drainBacklog({ printJobs, spools, journalEntries }) {
  const unprocessed = await printJobs.find({ processed: false }).toArray();
  if (unprocessed.length === 0) return 0;

  let processed = 0;
  for (const job of unprocessed) {
    await processJob(job._id, job, { printJobs, spools, journalEntries });
    processed++;
  }
  return processed;
}

export { ACCOUNT_INVENTORY, ACCOUNT_COGS };
