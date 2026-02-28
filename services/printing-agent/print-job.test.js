import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractGrams, buildJobDoc, logJob } from "./print-job.js";

describe("extractGrams", () => {
  it("returns grams from filament_used_g (number)", () => {
    assert.equal(extractGrams({ filament_used_g: 12.5 }), 12.5);
  });

  it("returns grams from filament_used_g (string)", () => {
    assert.equal(extractGrams({ filament_used_g: "8.3" }), 8.3);
  });

  it("returns grams from mc_print_filament_g when first field is absent", () => {
    assert.equal(extractGrams({ mc_print_filament_g: 5.1 }), 5.1);
  });

  it("returns grams from filament_g as last resort", () => {
    assert.equal(extractGrams({ filament_g: 3.7 }), 3.7);
  });

  it("prefers filament_used_g over later candidates", () => {
    assert.equal(
      extractGrams({ filament_used_g: 10, mc_print_filament_g: 20, filament_g: 30 }),
      10
    );
  });

  it("skips zero values", () => {
    assert.equal(extractGrams({ filament_used_g: 0, filament_g: 4.0 }), 4.0);
  });

  it("skips negative values", () => {
    assert.equal(extractGrams({ filament_used_g: -1, filament_g: 2.0 }), 2.0);
  });

  it("returns null when no candidate fields exist", () => {
    assert.equal(extractGrams({}), null);
  });

  it("returns null when all values are zero", () => {
    assert.equal(extractGrams({ filament_used_g: 0, mc_print_filament_g: 0, filament_g: 0 }), null);
  });

  it("returns null for non-numeric string values", () => {
    assert.equal(extractGrams({ filament_used_g: "n/a" }), null);
  });

  it("parses string '0' as zero and skips it", () => {
    assert.equal(extractGrams({ filament_used_g: "0", filament_g: 1.5 }), 1.5);
  });
});

describe("buildJobDoc", () => {
  it("builds a document with correct fields", () => {
    const doc = buildJobDoc({
      project: "kneeler-boot",
      usageG: 15.2,
      loggedAt: "2026-02-28T12:00:00.000Z",
      activeSpoolId: "3",
    });

    assert.deepEqual(doc, {
      project: "kneeler-boot",
      spoolId: 3,
      usageG: 15.2,
      loggedAt: "2026-02-28T12:00:00.000Z",
      processed: false,
    });
  });

  it("parses activeSpoolId as integer", () => {
    const doc = buildJobDoc({
      project: "test",
      usageG: 1,
      loggedAt: "2026-01-01T00:00:00Z",
      activeSpoolId: "42",
    });
    assert.equal(doc.spoolId, 42);
  });
});

describe("logJob", () => {
  it("inserts into MongoDB and enqueues to BullMQ", async () => {
    const insertedId = "abc123";
    const mockPrintJobs = {
      insertOne: async (doc) => {
        assert.equal(doc.project, "widget");
        assert.equal(doc.processed, false);
        return { insertedId };
      },
    };

    let queuedData = null;
    const mockQueue = {
      add: async (name, data) => {
        assert.equal(name, "completed");
        queuedData = data;
      },
    };

    const id = await logJob({
      project: "widget",
      usageG: 10,
      loggedAt: "2026-02-28T00:00:00Z",
      activeSpoolId: "1",
      printJobs: mockPrintJobs,
      printJobQueue: mockQueue,
    });

    assert.equal(id, insertedId);
    assert.equal(queuedData.printJobId, "abc123");
    assert.equal(queuedData.project, "widget");
    assert.equal(queuedData.spoolId, 1);
    assert.equal(queuedData.usageG, 10);
  });

  it("propagates MongoDB insert errors", async () => {
    const mockPrintJobs = {
      insertOne: async () => { throw new Error("DB down"); },
    };
    const mockQueue = { add: async () => {} };

    await assert.rejects(
      () => logJob({
        project: "test", usageG: 1, loggedAt: "2026-01-01T00:00:00Z",
        activeSpoolId: "1", printJobs: mockPrintJobs, printJobQueue: mockQueue,
      }),
      { message: "DB down" }
    );
  });

  it("propagates queue errors", async () => {
    const mockPrintJobs = {
      insertOne: async () => ({ insertedId: "x" }),
    };
    const mockQueue = {
      add: async () => { throw new Error("Redis down"); },
    };

    await assert.rejects(
      () => logJob({
        project: "test", usageG: 1, loggedAt: "2026-01-01T00:00:00Z",
        activeSpoolId: "1", printJobs: mockPrintJobs, printJobQueue: mockQueue,
      }),
      { message: "Redis down" }
    );
  });
});
