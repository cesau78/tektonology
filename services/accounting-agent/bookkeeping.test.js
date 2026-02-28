import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processJob, drainBacklog, ACCOUNT_INVENTORY, ACCOUNT_COGS } from "./bookkeeping.js";

function makeMockCollections({ spool, printJob } = {}) {
  const updates = [];
  const inserts = [];

  return {
    printJobs: {
      findOne: async () => printJob ?? null,
      updateOne: async (filter, update) => { updates.push({ collection: "printJobs", filter, update }); },
      find: (query) => ({
        toArray: async () => printJob ? [printJob] : [],
      }),
    },
    spools: {
      findOne: async () => spool ?? null,
      updateOne: async (filter, update) => { updates.push({ collection: "spools", filter, update }); },
    },
    journalEntries: {
      insertOne: async (doc) => { inserts.push(doc); },
    },
    _updates: updates,
    _inserts: inserts,
  };
}

const MOCK_SPOOL = {
  spoolId: 1,
  brand: "Bambu",
  material: "PLA Basic",
  color: "black",
  cost: 20.00,
  weightG: 1000,
  remainingG: 800,
};

const MOCK_JOB_DATA = {
  project: "kneeler-boot",
  spoolId: 1,
  usageG: 25,
  loggedAt: "2026-02-28T12:00:00.000Z",
};

describe("processJob", () => {
  it("calculates cost correctly", async () => {
    const collections = makeMockCollections({ spool: MOCK_SPOOL });
    const result = await processJob("aabbccdd11223344aabbccdd", MOCK_JOB_DATA, collections);

    // $20/1000g = $0.02/g, 25g * $0.02 = $0.50
    assert.equal(result.cost, 0.5);
    assert.equal(result.costPerGram, 0.02);
    assert.equal(result.date, "2026-02-28");
  });

  it("deducts from spool remainingG", async () => {
    const collections = makeMockCollections({ spool: MOCK_SPOOL });
    await processJob("aabbccdd11223344aabbccdd", MOCK_JOB_DATA, collections);

    const spoolUpdate = collections._updates.find((u) => u.collection === "spools");
    assert.deepEqual(spoolUpdate.update, { $inc: { remainingG: -25 } });
  });

  it("creates a double-entry journal entry", async () => {
    const collections = makeMockCollections({ spool: MOCK_SPOOL });
    await processJob("aabbccdd11223344aabbccdd", MOCK_JOB_DATA, collections);

    assert.equal(collections._inserts.length, 1);
    const entry = collections._inserts[0];

    assert.equal(entry.date, "2026-02-28");
    assert.match(entry.description, /kneeler-boot/);
    assert.match(entry.description, /25g/);
    assert.match(entry.description, /PLA Basic/);

    assert.equal(entry.lines.length, 2);

    const debitLine = entry.lines.find((l) => l.debit !== null);
    assert.equal(debitLine.accountNumber, ACCOUNT_COGS.number);
    assert.equal(debitLine.debit, 0.5);
    assert.equal(debitLine.credit, null);

    const creditLine = entry.lines.find((l) => l.credit !== null);
    assert.equal(creditLine.accountNumber, ACCOUNT_INVENTORY.number);
    assert.equal(creditLine.credit, 0.5);
    assert.equal(creditLine.debit, null);
  });

  it("marks the print job as processed", async () => {
    const collections = makeMockCollections({ spool: MOCK_SPOOL });
    await processJob("aabbccdd11223344aabbccdd", MOCK_JOB_DATA, collections);

    const jobUpdate = collections._updates.find((u) => u.collection === "printJobs");
    assert.equal(jobUpdate.update.$set.processed, true);
    assert.equal(jobUpdate.update.$set.cost, 0.5);
    assert.ok(jobUpdate.update.$set.processedAt);
  });

  it("looks up job from MongoDB when data lacks usageG", async () => {
    const storedJob = { ...MOCK_JOB_DATA, _id: "aabbccdd11223344aabbccdd" };
    const collections = makeMockCollections({ spool: MOCK_SPOOL, printJob: storedJob });
    const result = await processJob("aabbccdd11223344aabbccdd", {}, collections);
    assert.equal(result.cost, 0.5);
  });

  it("throws when job is not found in MongoDB", async () => {
    const collections = makeMockCollections({ spool: MOCK_SPOOL, printJob: null });
    await assert.rejects(
      () => processJob("aabbccdd11223344aabbccdd", {}, collections),
      /not found in MongoDB/
    );
  });

  it("throws when spool is not found", async () => {
    const collections = makeMockCollections({ spool: null });
    await assert.rejects(
      () => processJob("aabbccdd11223344aabbccdd", MOCK_JOB_DATA, collections),
      /Spool 1 not found/
    );
  });

  it("handles fractional cost with correct rounding", async () => {
    const expensiveSpool = { ...MOCK_SPOOL, cost: 33.33, weightG: 1000 };
    const collections = makeMockCollections({ spool: expensiveSpool });
    const result = await processJob("aabbccdd11223344aabbccdd", { ...MOCK_JOB_DATA, usageG: 7 }, collections);

    // 33.33/1000 * 7 = 0.23331 → rounds to 0.2333
    assert.equal(result.cost, 0.2333);
  });

  it("uses current time when loggedAt is missing", async () => {
    const dataWithoutLoggedAt = { project: "test", spoolId: 1, usageG: 10 };
    const collections = makeMockCollections({ spool: MOCK_SPOOL });
    const result = await processJob("aabbccdd11223344aabbccdd", dataWithoutLoggedAt, collections);
    assert.ok(result.date); // should be today's date
  });
});

describe("drainBacklog", () => {
  it("returns 0 when no unprocessed jobs exist", async () => {
    const collections = makeMockCollections({});
    // Override find to return empty
    collections.printJobs.find = () => ({ toArray: async () => [] });
    const count = await drainBacklog(collections);
    assert.equal(count, 0);
  });

  it("processes all backlogged jobs and returns count", async () => {
    const job1 = { _id: "aabbccdd11223344aabbcc01", ...MOCK_JOB_DATA };
    const job2 = { _id: "aabbccdd11223344aabbcc02", ...MOCK_JOB_DATA, project: "bushing" };

    const updates = [];
    const inserts = [];
    const collections = {
      printJobs: {
        find: () => ({ toArray: async () => [job1, job2] }),
        findOne: async () => null,
        updateOne: async (f, u) => { updates.push({ collection: "printJobs", filter: f, update: u }); },
      },
      spools: {
        findOne: async () => MOCK_SPOOL,
        updateOne: async (f, u) => { updates.push({ collection: "spools", filter: f, update: u }); },
      },
      journalEntries: {
        insertOne: async (doc) => { inserts.push(doc); },
      },
    };

    const count = await drainBacklog(collections);
    assert.equal(count, 2);
    assert.equal(inserts.length, 2);
  });
});

describe("account constants", () => {
  it("exports correct inventory account", () => {
    assert.equal(ACCOUNT_INVENTORY.number, 1200);
    assert.equal(ACCOUNT_INVENTORY.name, "Inventory - Filament");
  });

  it("exports correct COGS account", () => {
    assert.equal(ACCOUNT_COGS.number, 5000);
    assert.equal(ACCOUNT_COGS.name, "Cost of Goods Sold");
  });
});
