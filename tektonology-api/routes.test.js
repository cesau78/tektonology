import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

// Mock auth module before importing routes — prevents Auth0 SDK from loading
mock.module("./auth.js", {
  namedExports: {
    jwtCheck: (_req, _res, next) => next(),
    requireAuth: (_req, _res, next) => next(),
    requireEmailVerified: (_req, _res, next) => next(),
    requireRole: () => (_req, _res, next) => next(),
  },
});

const { default: express } = await import("express");
const { MongoClient } = await import("mongodb");
const { createRoutes } = await import("./routes.js");

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "tektonology_test";

let client, db, app, server, baseUrl;

/**
 * Tiny fetch wrapper that builds the full URL and sets JSON headers by default.
 */
async function api(method, path, body, headers = {}) {
  const opts = { method, headers: { ...headers } };
  if (body !== undefined && !opts.headers["content-type"]) {
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  } else if (body !== undefined) {
    opts.body = body;
  }
  const res = await fetch(`${baseUrl}${path}`, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
}

// Convenience verbs
const GET = (path, headers) => api("GET", path, undefined, headers);
const POST = (path, body, headers) => api("POST", path, body, headers);
const PUT = (path, body) => api("PUT", path, body);
const DELETE = (path) => api("DELETE", path);

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/** Insert a standard chart of accounts for balance testing. */
async function seedAccounts() {
  const accts = [
    { number: 1000, name: "Cash", type: "asset", balance: 0 },
    { number: 2000, name: "Accounts Payable", type: "liability", balance: 0 },
    { number: 3000, name: "Owner Equity", type: "equity", balance: 0 },
    { number: 4000, name: "Sales Revenue", type: "revenue", balance: 0 },
    { number: 5000, name: "Filament Expense", type: "expense", balance: 0 },
  ];
  await db.collection("accounts").insertMany(accts);
  return accts;
}

/** Build a balanced journal entry payload. */
function balancedEntry(overrides = {}) {
  return {
    date: "2025-06-01",
    description: "Test entry",
    lines: [
      { accountNumber: 1000, debit: 100, credit: 0 },
      { accountNumber: 4000, debit: 0, credit: 100 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

before(async () => {
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);

  app = express();
  app.use(express.json());
  createRoutes(app, db);

  // Listen on random port
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.dropDatabase();
  await client.close();
});

beforeEach(async () => {
  // Clean all collections before each test
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).deleteMany({});
  }
});

// ===========================================================================
// GET /api/finance/journal
// ===========================================================================

describe("GET /api/finance/journal", () => {
  it("returns empty array when no entries exist", async () => {
    const res = await GET("/api/finance/journal");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("returns entries excluding soft-deleted by default", async () => {
    const entries = db.collection("journal_entries");
    await entries.insertMany([
      { transactionId: 1, date: "2025-01-01", lines: [], description: "Active" },
      { transactionId: 2, date: "2025-01-02", lines: [], description: "Deleted", deletedAt: "2025-06-01T00:00:00.000Z" },
    ]);
    const res = await GET("/api/finance/journal");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].transactionId, 1);
  });

  it("returns all entries (including soft-deleted) when ?includeDeleted=true", async () => {
    const entries = db.collection("journal_entries");
    await entries.insertMany([
      { transactionId: 1, date: "2025-01-01", lines: [], description: "Active" },
      { transactionId: 2, date: "2025-01-02", lines: [], description: "Deleted", deletedAt: "2025-06-01T00:00:00.000Z" },
    ]);
    const res = await GET("/api/finance/journal?includeDeleted=true");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
  });
});

// ===========================================================================
// POST /api/finance/journal
// ===========================================================================

describe("POST /api/finance/journal", () => {
  it("creates a balanced journal entry successfully", async () => {
    await seedAccounts();
    const res = await POST("/api/finance/journal", balancedEntry());
    assert.equal(res.status, 201);
    assert.equal(res.body.transactionId, 1);
    assert.equal(res.body.date, "2025-06-01");
    assert.equal(res.body.lines.length, 2);
  });

  it("rejects entry with unbalanced debits/credits", async () => {
    await seedAccounts();
    const entry = balancedEntry({
      lines: [
        { accountNumber: 1000, debit: 100, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 50 },
      ],
    });
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Dd]ebits must equal credits/);
  });

  it("rejects entry with fewer than 2 lines", async () => {
    const entry = {
      date: "2025-06-01",
      lines: [{ accountNumber: 1000, debit: 100, credit: 0 }],
    };
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /at least 2 lines/);
  });

  it("rejects entry without a date", async () => {
    const entry = {
      lines: [
        { accountNumber: 1000, debit: 100, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 100 },
      ],
    };
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 400);
  });

  it("rejects entry without lines", async () => {
    const entry = { date: "2025-06-01" };
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 400);
  });

  it("auto-assigns incrementing transactionId", async () => {
    await seedAccounts();
    const r1 = await POST("/api/finance/journal", balancedEntry());
    assert.equal(r1.body.transactionId, 1);

    const r2 = await POST("/api/finance/journal", balancedEntry({ date: "2025-06-02" }));
    assert.equal(r2.body.transactionId, 2);

    const r3 = await POST("/api/finance/journal", balancedEntry({ date: "2025-06-03" }));
    assert.equal(r3.body.transactionId, 3);
  });

  it("updates debit-normal account balances (asset, expense)", async () => {
    await seedAccounts();
    // Debit Cash (asset) 100, Credit Revenue 100
    await POST("/api/finance/journal", balancedEntry());

    const cash = await db.collection("accounts").findOne({ number: 1000 });
    // Asset is debit-normal: debit increases balance
    assert.equal(cash.balance, 100);
  });

  it("updates credit-normal account balances (liability, equity, revenue)", async () => {
    await seedAccounts();
    // Debit Cash (asset) 100, Credit Revenue (credit-normal) 100
    await POST("/api/finance/journal", balancedEntry());

    const revenue = await db.collection("accounts").findOne({ number: 4000 });
    // Revenue is credit-normal: credit increases balance
    assert.equal(revenue.balance, 100);
  });

  it("handles expense accounts correctly (debit-normal)", async () => {
    await seedAccounts();
    const entry = balancedEntry({
      lines: [
        { accountNumber: 5000, debit: 75, credit: 0 },
        { accountNumber: 2000, debit: 0, credit: 75 },
      ],
    });
    await POST("/api/finance/journal", entry);

    const expense = await db.collection("accounts").findOne({ number: 5000 });
    assert.equal(expense.balance, 75); // debit-normal: debit increases

    const payable = await db.collection("accounts").findOne({ number: 2000 });
    assert.equal(payable.balance, 75); // credit-normal: credit increases
  });
});

// ===========================================================================
// PUT /api/finance/journal/:transactionId
// ===========================================================================

describe("PUT /api/finance/journal/:transactionId", () => {
  it("updates an existing entry", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const updated = balancedEntry({
      date: "2025-07-01",
      description: "Updated entry",
      lines: [
        { accountNumber: 1000, debit: 200, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 200 },
      ],
    });
    const res = await PUT("/api/finance/journal/1", updated);
    assert.equal(res.status, 200);
    assert.equal(res.body.date, "2025-07-01");
    assert.equal(res.body.description, "Updated entry");
  });

  it("returns 404 for non-existent transactionId", async () => {
    const res = await PUT("/api/finance/journal/999", balancedEntry());
    assert.equal(res.status, 404);
  });

  it("rejects unbalanced updates", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const unbalanced = {
      date: "2025-07-01",
      lines: [
        { accountNumber: 1000, debit: 200, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 100 },
      ],
    };
    const res = await PUT("/api/finance/journal/1", unbalanced);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Dd]ebits must equal credits/);
  });

  it("rejects update with fewer than 2 lines", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const res = await PUT("/api/finance/journal/1", {
      date: "2025-07-01",
      lines: [{ accountNumber: 1000, debit: 100, credit: 0 }],
    });
    assert.equal(res.status, 400);
  });

  it("reverses old balances and applies new ones correctly", async () => {
    await seedAccounts();
    // Create: Cash +100, Revenue +100
    await POST("/api/finance/journal", balancedEntry());

    // Update: Cash +200, Revenue +200 (old reversed first)
    const updated = balancedEntry({
      lines: [
        { accountNumber: 1000, debit: 200, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 200 },
      ],
    });
    await PUT("/api/finance/journal/1", updated);

    const cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 200); // was 100, reversed to 0, then +200

    const revenue = await db.collection("accounts").findOne({ number: 4000 });
    assert.equal(revenue.balance, 200);
  });

  it("handles changing accounts in an update", async () => {
    await seedAccounts();
    // Original: Cash debit 100, Revenue credit 100
    await POST("/api/finance/journal", balancedEntry());

    // Update: Expense debit 100, Payable credit 100
    const updated = balancedEntry({
      lines: [
        { accountNumber: 5000, debit: 100, credit: 0 },
        { accountNumber: 2000, debit: 0, credit: 100 },
      ],
    });
    await PUT("/api/finance/journal/1", updated);

    // Old balances should be reversed
    const cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 0);
    const revenue = await db.collection("accounts").findOne({ number: 4000 });
    assert.equal(revenue.balance, 0);

    // New balances should be applied
    const expense = await db.collection("accounts").findOne({ number: 5000 });
    assert.equal(expense.balance, 100);
    const payable = await db.collection("accounts").findOne({ number: 2000 });
    assert.equal(payable.balance, 100);
  });
});

// ===========================================================================
// DELETE /api/finance/journal/:transactionId (soft delete)
// ===========================================================================

describe("DELETE /api/finance/journal/:transactionId (soft delete)", () => {
  it("soft-deletes by setting deletedAt", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const res = await DELETE("/api/finance/journal/1");
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, 1);

    // Verify it still exists in DB with deletedAt set
    const doc = await db.collection("journal_entries").findOne({ transactionId: 1 });
    assert.ok(doc, "Entry should still exist in database");
    assert.ok(doc.deletedAt, "deletedAt should be set");
  });

  it("reverses account balances on soft delete", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    // Verify balances before delete
    let cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 100);

    await DELETE("/api/finance/journal/1");

    // Balances should be reversed
    cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 0);

    const revenue = await db.collection("accounts").findOne({ number: 4000 });
    assert.equal(revenue.balance, 0);
  });

  it("returns 409 if already soft-deleted", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());
    await DELETE("/api/finance/journal/1");

    const res = await DELETE("/api/finance/journal/1");
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already deleted/);
  });

  it("returns 404 for non-existent entry", async () => {
    const res = await DELETE("/api/finance/journal/999");
    assert.equal(res.status, 404);
  });
});

// ===========================================================================
// DELETE /api/finance/journal/:transactionId/permanent
// ===========================================================================

describe("DELETE /api/finance/journal/:transactionId/permanent", () => {
  it("permanently deletes a soft-deleted entry", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());
    await DELETE("/api/finance/journal/1"); // soft-delete first

    const res = await DELETE("/api/finance/journal/1/permanent");
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, 1);

    // Verify entry is gone from the database
    const doc = await db.collection("journal_entries").findOne({ transactionId: 1 });
    assert.equal(doc, null);
  });

  it("returns 409 if entry is NOT soft-deleted first", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const res = await DELETE("/api/finance/journal/1/permanent");
    assert.equal(res.status, 409);
    assert.match(res.body.error, /soft-deleted first/);
  });

  it("returns 404 for non-existent entry", async () => {
    const res = await DELETE("/api/finance/journal/999/permanent");
    assert.equal(res.status, 404);
  });
});

// ===========================================================================
// POST /api/finance/journal/:transactionId/restore
// ===========================================================================

describe("POST /api/finance/journal/:transactionId/restore", () => {
  it("restores a soft-deleted entry (removes deletedAt)", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());
    await DELETE("/api/finance/journal/1"); // soft-delete

    const res = await POST("/api/finance/journal/1/restore");
    assert.equal(res.status, 200);
    assert.equal(res.body.restored, 1);

    // Verify deletedAt is removed
    const doc = await db.collection("journal_entries").findOne({ transactionId: 1 });
    assert.ok(doc);
    assert.equal(doc.deletedAt, undefined);
  });

  it("re-applies account balances on restore", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());
    await DELETE("/api/finance/journal/1"); // reverses balances

    // Balances should be 0 after soft delete
    let cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 0);

    await POST("/api/finance/journal/1/restore");

    // Balances should be restored
    cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 100);

    const revenue = await db.collection("accounts").findOne({ number: 4000 });
    assert.equal(revenue.balance, 100);
  });

  it("returns 409 if entry is not deleted", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const res = await POST("/api/finance/journal/1/restore");
    assert.equal(res.status, 409);
    assert.match(res.body.error, /not deleted/);
  });

  it("returns 404 for non-existent entry", async () => {
    const res = await POST("/api/finance/journal/999/restore");
    assert.equal(res.status, 404);
  });
});

// ===========================================================================
// Full lifecycle: create -> soft-delete -> restore -> edit -> hard-delete
// ===========================================================================

describe("Full journal entry lifecycle", () => {
  it("create -> soft-delete -> restore -> edit -> soft-delete -> permanent delete", async () => {
    await seedAccounts();

    // 1. Create
    const createRes = await POST("/api/finance/journal", balancedEntry());
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.transactionId, 1);

    // 2. Soft-delete
    const softDeleteRes = await DELETE("/api/finance/journal/1");
    assert.equal(softDeleteRes.status, 200);

    // Verify excluded from default GET
    const getRes1 = await GET("/api/finance/journal");
    assert.equal(getRes1.body.length, 0);

    // 3. Restore
    const restoreRes = await POST("/api/finance/journal/1/restore");
    assert.equal(restoreRes.status, 200);

    // Verify included in default GET
    const getRes2 = await GET("/api/finance/journal");
    assert.equal(getRes2.body.length, 1);

    // 4. Edit
    const editRes = await PUT("/api/finance/journal/1", balancedEntry({
      date: "2025-08-01",
      description: "Edited",
      lines: [
        { accountNumber: 1000, debit: 500, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 500 },
      ],
    }));
    assert.equal(editRes.status, 200);
    assert.equal(editRes.body.description, "Edited");

    // 5. Soft-delete again
    await DELETE("/api/finance/journal/1");

    // 6. Permanent delete
    const permRes = await DELETE("/api/finance/journal/1/permanent");
    assert.equal(permRes.status, 200);

    // Verify gone from DB entirely
    const doc = await db.collection("journal_entries").findOne({ transactionId: 1 });
    assert.equal(doc, null);

    // All balances should be back to 0 (create -> soft-delete reversed -> restore re-applied -> edit changed -> soft-delete reversed)
    const cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 0);
    const revenue = await db.collection("accounts").findOne({ number: 4000 });
    assert.equal(revenue.balance, 0);
  });
});
