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
const { MongoClient, ObjectId } = await import("mongodb");
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
    effective: "2025-06-01",
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
      { transactionId: 1, effective: "2025-01-01", lines: [], description: "Active" },
      { transactionId: 2, effective: "2025-01-02", lines: [], description: "Deleted", deletedAt: "2025-06-01T00:00:00.000Z" },
    ]);
    const res = await GET("/api/finance/journal");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].transactionId, 1);
  });

  it("returns all entries (including soft-deleted) when ?includeDeleted=true", async () => {
    const entries = db.collection("journal_entries");
    await entries.insertMany([
      { transactionId: 1, effective: "2025-01-01", lines: [], description: "Active" },
      { transactionId: 2, effective: "2025-01-02", lines: [], description: "Deleted", deletedAt: "2025-06-01T00:00:00.000Z" },
    ]);
    const res = await GET("/api/finance/journal?includeDeleted=true");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
  });

  it("filters entries by accountNumber query param", async () => {
    await seedAccounts();
    const entries = db.collection("journal_entries");
    await entries.insertMany([
      {
        transactionId: 1,
        effective: "2025-01-01",
        description: "Has 1000",
        lines: [
          { accountNumber: 1000, debit: 50, credit: 0 },
          { accountNumber: 4000, debit: 0, credit: 50 },
        ],
      },
      {
        transactionId: 2,
        effective: "2025-01-02",
        description: "Only 2000",
        lines: [
          { accountNumber: 2000, debit: 30, credit: 0 },
          { accountNumber: 4000, debit: 0, credit: 30 },
        ],
      },
    ]);
    const res = await GET("/api/finance/journal?accountNumber=1000");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].transactionId, 1);
  });

  it("ignores invalid accountNumber param", async () => {
    const entries = db.collection("journal_entries");
    await entries.insertMany([
      { transactionId: 1, effective: "2025-01-01", lines: [], description: "A" },
      { transactionId: 2, effective: "2025-01-02", lines: [], description: "B" },
    ]);
    const res = await GET("/api/finance/journal?accountNumber=abc");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
  });

  it("combines accountNumber with includeDeleted", async () => {
    await seedAccounts();
    const entries = db.collection("journal_entries");
    await entries.insertMany([
      {
        transactionId: 1,
        effective: "2025-01-01",
        description: "Active with 1000",
        lines: [
          { accountNumber: 1000, debit: 100, credit: 0 },
          { accountNumber: 4000, debit: 0, credit: 100 },
        ],
      },
      {
        transactionId: 2,
        effective: "2025-01-02",
        description: "Deleted with 1000",
        deletedAt: "2025-06-01T00:00:00.000Z",
        lines: [
          { accountNumber: 1000, debit: 200, credit: 0 },
          { accountNumber: 4000, debit: 0, credit: 200 },
        ],
      },
    ]);
    // Without includeDeleted — should exclude the deleted entry
    const res1 = await GET("/api/finance/journal?accountNumber=1000");
    assert.equal(res1.status, 200);
    assert.equal(res1.body.length, 1);
    assert.equal(res1.body[0].transactionId, 1);

    // With includeDeleted — should return both
    const res2 = await GET("/api/finance/journal?accountNumber=1000&includeDeleted=true");
    assert.equal(res2.status, 200);
    assert.equal(res2.body.length, 2);
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
    assert.equal(res.body.effective, "2025-06-01");
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
      effective: "2025-06-01",
      lines: [{ accountNumber: 1000, debit: 100, credit: 0 }],
    };
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /at least 2 lines/);
  });

  it("rejects entry without an effective date", async () => {
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
    const entry = { effective: "2025-06-01" };
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 400);
  });

  it("auto-assigns incrementing transactionId", async () => {
    await seedAccounts();
    const r1 = await POST("/api/finance/journal", balancedEntry());
    assert.equal(r1.body.transactionId, 1);

    const r2 = await POST("/api/finance/journal", balancedEntry({ effective: "2025-06-02" }));
    assert.equal(r2.body.transactionId, 2);

    const r3 = await POST("/api/finance/journal", balancedEntry({ effective: "2025-06-03" }));
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
      effective: "2025-07-01",
      description: "Updated entry",
      lines: [
        { accountNumber: 1000, debit: 200, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 200 },
      ],
    });
    const res = await PUT("/api/finance/journal/1", updated);
    assert.equal(res.status, 200);
    assert.equal(res.body.effective, "2025-07-01");
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
      effective: "2025-07-01",
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
      effective: "2025-07-01",
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
      effective: "2025-08-01",
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

// ===========================================================================
// GET /api/finance/accounts
// ===========================================================================

describe("GET /api/finance/accounts", () => {
  it("returns empty array when no accounts exist", async () => {
    const res = await GET("/api/finance/accounts");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("returns accounts sorted by number", async () => {
    await seedAccounts();
    const res = await GET("/api/finance/accounts");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 5);
    assert.equal(res.body[0].number, 1000);
    assert.equal(res.body[4].number, 5000);
  });

  it("returns CSV when Accept: text/csv", async () => {
    await seedAccounts();
    const res = await GET("/api/finance/accounts", { accept: "text/csv" });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type").startsWith("text/csv"));
    assert.ok(res.body.includes("number"));
    assert.ok(res.body.includes("Cash"));
  });
});

// ===========================================================================
// POST /api/finance/accounts
// ===========================================================================

describe("POST /api/finance/accounts", () => {
  it("creates a single account", async () => {
    const res = await POST("/api/finance/accounts", { number: 1100, name: "Petty Cash", type: "asset", balance: 0 });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("creates multiple accounts from array", async () => {
    const res = await POST("/api/finance/accounts", [
      { number: 1100, name: "Petty Cash", type: "asset", balance: 0 },
      { number: 1200, name: "Checking", type: "asset", balance: 0 },
    ]);
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 2);
  });

  it("rejects duplicate account number", async () => {
    await seedAccounts();
    const res = await POST("/api/finance/accounts", { number: 1000, name: "Duplicate", type: "asset", balance: 0 });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /1000.*already exists/);
  });

  it("rejects duplicate account name", async () => {
    await seedAccounts();
    const res = await POST("/api/finance/accounts", { number: 9999, name: "Cash", type: "asset", balance: 0 });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /Cash.*already exists/);
  });

  it("rejects empty array", async () => {
    const res = await POST("/api/finance/accounts", []);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Nn]o records/);
  });

  it("accepts CSV content-type", async () => {
    const csv = "number,name,type,balance\n1100,Petty Cash,asset,0\n";
    const res = await POST("/api/finance/accounts", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });
});

// ===========================================================================
// PUT /api/finance/accounts/:number
// ===========================================================================

describe("PUT /api/finance/accounts/:number", () => {
  it("updates account name", async () => {
    await seedAccounts();
    const res = await PUT("/api/finance/accounts/1000", { name: "Cash on Hand" });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Cash on Hand");
  });

  it("updates account type", async () => {
    await seedAccounts();
    const res = await PUT("/api/finance/accounts/1000", { type: "expense" });
    assert.equal(res.status, 200);
    assert.equal(res.body.type, "expense");
  });

  it("updates account number and cascades to journal entries", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const res = await PUT("/api/finance/accounts/1000", { number: 1001 });
    assert.equal(res.status, 200);
    assert.equal(res.body.number, 1001);

    // Verify journal entries were updated
    const entry = await db.collection("journal_entries").findOne({ transactionId: 1 });
    assert.equal(entry.lines[0].accountNumber, 1001);
  });

  it("returns 400 for invalid (NaN) account number", async () => {
    const res = await PUT("/api/finance/accounts/abc", { name: "Test" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Ii]nvalid/);
  });

  it("returns 404 for non-existent account", async () => {
    const res = await PUT("/api/finance/accounts/9999", { name: "Test" });
    assert.equal(res.status, 404);
  });

  it("returns 400 when nothing to update", async () => {
    await seedAccounts();
    const res = await PUT("/api/finance/accounts/1000", {});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Nn]othing to update/);
  });

  it("rejects duplicate number on rename", async () => {
    await seedAccounts();
    const res = await PUT("/api/finance/accounts/1000", { number: 2000 });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /2000.*already exists/);
  });

  it("rejects duplicate name on rename", async () => {
    await seedAccounts();
    const res = await PUT("/api/finance/accounts/1000", { name: "Accounts Payable" });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /Accounts Payable.*already exists/);
  });

  it("allows setting same number (no-op rename)", async () => {
    await seedAccounts();
    const res = await PUT("/api/finance/accounts/1000", { number: 1000, name: "Cash Updated" });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Cash Updated");
  });

  it("allows setting same name (no-op rename)", async () => {
    await seedAccounts();
    const res = await PUT("/api/finance/accounts/1000", { name: "Cash" });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Cash");
  });
});

// ===========================================================================
// DELETE /api/finance/accounts/:number
// ===========================================================================

describe("DELETE /api/finance/accounts/:number (soft delete)", () => {
  it("soft-deletes an account with no journal entries", async () => {
    await seedAccounts();
    const res = await DELETE("/api/finance/accounts/1000");
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, 1);
    const doc = await db.collection("accounts").findOne({ number: 1000 });
    assert.ok(doc);
    assert.ok(doc.deletedAt);
  });

  it("excludes soft-deleted from default GET", async () => {
    await seedAccounts();
    await DELETE("/api/finance/accounts/1000");
    const res = await GET("/api/finance/accounts");
    assert.equal(res.body.length, 4);
  });

  it("includes soft-deleted with ?includeDeleted=true", async () => {
    await seedAccounts();
    await DELETE("/api/finance/accounts/1000");
    const res = await GET("/api/finance/accounts?includeDeleted=true");
    assert.equal(res.body.length, 5);
  });

  it("returns 409 when account has active journal entries", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const res = await DELETE("/api/finance/accounts/1000");
    assert.equal(res.status, 409);
    assert.match(res.body.error, /journal entries/);
  });

  it("returns 409 if already deleted", async () => {
    await seedAccounts();
    await DELETE("/api/finance/accounts/1000");
    const res = await DELETE("/api/finance/accounts/1000");
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already deleted/);
  });

  it("returns 404 for non-existent account", async () => {
    const res = await DELETE("/api/finance/accounts/9999");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid (NaN) account number", async () => {
    const res = await DELETE("/api/finance/accounts/abc");
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Ii]nvalid/);
  });

  it("rejects PUT on deleted account", async () => {
    await seedAccounts();
    await DELETE("/api/finance/accounts/1000");
    const res = await PUT("/api/finance/accounts/1000", { name: "New Name" });
    assert.equal(res.status, 409);
  });
});

describe("DELETE /api/finance/accounts/:number/permanent", () => {
  it("permanently deletes a soft-deleted account", async () => {
    await seedAccounts();
    await DELETE("/api/finance/accounts/1000");
    const res = await DELETE("/api/finance/accounts/1000/permanent");
    assert.equal(res.status, 200);
    const doc = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(doc, null);
  });

  it("returns 409 if not soft-deleted first", async () => {
    await seedAccounts();
    const res = await DELETE("/api/finance/accounts/1000/permanent");
    assert.equal(res.status, 409);
    assert.match(res.body.error, /soft-deleted first/);
  });

  it("returns 409 if account has journal entries", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());
    // Soft-delete the journal entry first so the account can be soft-deleted
    await DELETE("/api/finance/journal/1");
    // Now soft-delete the account
    await DELETE("/api/finance/accounts/1000");
    // Permanent delete should still block because journal entries reference it
    const res = await DELETE("/api/finance/accounts/1000/permanent");
    assert.equal(res.status, 409);
    assert.match(res.body.error, /journal entries/);
  });

  it("returns 404 for non-existent account", async () => {
    const res = await DELETE("/api/finance/accounts/9999/permanent");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid (NaN) account number", async () => {
    const res = await DELETE("/api/finance/accounts/abc/permanent");
    assert.equal(res.status, 400);
  });
});

describe("POST /api/finance/accounts/:number/restore", () => {
  it("restores a soft-deleted account", async () => {
    await seedAccounts();
    await DELETE("/api/finance/accounts/1000");
    const res = await POST("/api/finance/accounts/1000/restore");
    assert.equal(res.status, 200);
    assert.equal(res.body.restored, 1);
    const doc = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(doc.deletedAt, undefined);
  });

  it("returns 409 if not deleted", async () => {
    await seedAccounts();
    const res = await POST("/api/finance/accounts/1000/restore");
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent account", async () => {
    const res = await POST("/api/finance/accounts/9999/restore");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid (NaN) account number", async () => {
    const res = await POST("/api/finance/accounts/abc/restore");
    assert.equal(res.status, 400);
  });
});

// ===========================================================================
// POST /api/finance/journal (CSV)
// ===========================================================================

describe("POST /api/finance/journal (CSV)", () => {
  it("inserts journal rows from CSV", async () => {
    const csv = "transactionId,effective,description\n1,2025-01-01,Test row\n";
    const res = await POST("/api/finance/journal", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("rejects empty CSV", async () => {
    const csv = "transactionId,effective,description\n";
    const res = await POST("/api/finance/journal", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Nn]o records/);
  });
});

// ===========================================================================
// GET /api/finance/journal (CSV)
// ===========================================================================

describe("GET /api/finance/journal (CSV)", () => {
  it("returns CSV when Accept: text/csv", async () => {
    await db.collection("journal_entries").insertOne({
      transactionId: 1,
      effective: "2025-01-01",
      description: "Test",
      lines: [],
    });
    const res = await GET("/api/finance/journal", { accept: "text/csv" });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type").startsWith("text/csv"));
    assert.ok(res.body.includes("transactionId"));
  });
});

// ===========================================================================
// Invalid transactionId (NaN) edge cases
// ===========================================================================

describe("Invalid transactionId (NaN)", () => {
  it("PUT returns 400 for NaN transactionId", async () => {
    const res = await PUT("/api/finance/journal/abc", balancedEntry());
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Ii]nvalid/);
  });

  it("DELETE returns 400 for NaN transactionId", async () => {
    const res = await DELETE("/api/finance/journal/abc");
    assert.equal(res.status, 400);
  });

  it("DELETE permanent returns 400 for NaN transactionId", async () => {
    const res = await DELETE("/api/finance/journal/abc/permanent");
    assert.equal(res.status, 400);
  });

  it("POST restore returns 400 for NaN transactionId", async () => {
    const res = await POST("/api/finance/journal/abc/restore");
    assert.equal(res.status, 400);
  });
});

// ===========================================================================
// Procurement — Spools
// ===========================================================================

describe("GET /api/procurement/spools", () => {
  it("returns empty array when no spools", async () => {
    const res = await GET("/api/procurement/spools");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("returns spools sorted by spoolId", async () => {
    await db.collection("spools").insertMany([
      { spoolId: 2, brand: "Bambu", material: "PLA" },
      { spoolId: 1, brand: "Bambu", material: "PETG" },
    ]);
    const res = await GET("/api/procurement/spools");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].spoolId, 1);
  });

  it("returns CSV when Accept: text/csv", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    const res = await GET("/api/procurement/spools", { accept: "text/csv" });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type").startsWith("text/csv"));
    assert.ok(res.body.includes("spoolId"));
  });
});

describe("POST /api/procurement/spools", () => {
  it("creates a spool from JSON", async () => {
    const res = await POST("/api/procurement/spools", { spoolId: 1, brand: "Bambu", material: "PLA" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("creates spools from array", async () => {
    const res = await POST("/api/procurement/spools", [
      { spoolId: 1, brand: "Bambu" },
      { spoolId: 2, brand: "Polymaker" },
    ]);
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 2);
  });

  it("creates spools from CSV", async () => {
    const csv = "spoolId,brand,material\n1,Bambu,PLA\n";
    const res = await POST("/api/procurement/spools", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("rejects empty payload", async () => {
    const res = await POST("/api/procurement/spools", []);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Nn]o records/);
  });
});

describe("GET /api/procurement/spools/:spoolId", () => {
  it("returns a single spool by ID", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    const res = await GET("/api/procurement/spools/1");
    assert.equal(res.status, 200);
    assert.equal(res.body.brand, "Bambu");
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await GET("/api/procurement/spools/999");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await GET("/api/procurement/spools/abc");
    assert.equal(res.status, 400);
  });
});

describe("PUT /api/procurement/spools/:spoolId", () => {
  it("updates a spool", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu", material: "PLA" });
    const res = await PUT("/api/procurement/spools/1", { brand: "Polymaker" });
    assert.equal(res.status, 200);
    assert.equal(res.body.brand, "Polymaker");
    assert.equal(res.body.material, "PLA");
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await PUT("/api/procurement/spools/999", { brand: "X" });
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await PUT("/api/procurement/spools/abc", { brand: "X" });
    assert.equal(res.status, 400);
  });

  it("returns 400 for empty update", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    const res = await PUT("/api/procurement/spools/1", {});
    assert.equal(res.status, 400);
  });

  it("rejects edit on deleted spool", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu", deletedAt: "2025-01-01T00:00:00Z" });
    const res = await PUT("/api/procurement/spools/1", { brand: "X" });
    assert.equal(res.status, 409);
  });
});

describe("DELETE /api/procurement/spools/:spoolId (soft delete)", () => {
  it("soft-deletes a spool", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    const res = await DELETE("/api/procurement/spools/1");
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, 1);
    const doc = await db.collection("spools").findOne({ spoolId: 1 });
    assert.ok(doc.deletedAt);
  });

  it("excludes soft-deleted from default GET", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    await DELETE("/api/procurement/spools/1");
    const res = await GET("/api/procurement/spools");
    assert.equal(res.body.length, 0);
  });

  it("includes soft-deleted with ?includeDeleted=true", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    await DELETE("/api/procurement/spools/1");
    const res = await GET("/api/procurement/spools?includeDeleted=true");
    assert.equal(res.body.length, 1);
  });

  it("returns 409 if already deleted", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    await DELETE("/api/procurement/spools/1");
    const res = await DELETE("/api/procurement/spools/1");
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await DELETE("/api/procurement/spools/999");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await DELETE("/api/procurement/spools/abc");
    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/procurement/spools/:spoolId/permanent", () => {
  it("permanently deletes a soft-deleted spool", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    await DELETE("/api/procurement/spools/1");
    const res = await DELETE("/api/procurement/spools/1/permanent");
    assert.equal(res.status, 200);
    const doc = await db.collection("spools").findOne({ spoolId: 1 });
    assert.equal(doc, null);
  });

  it("returns 409 if not soft-deleted first", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    const res = await DELETE("/api/procurement/spools/1/permanent");
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await DELETE("/api/procurement/spools/999/permanent");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await DELETE("/api/procurement/spools/abc/permanent");
    assert.equal(res.status, 400);
  });
});

describe("POST /api/procurement/spools/:spoolId/restore", () => {
  it("restores a soft-deleted spool", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    await DELETE("/api/procurement/spools/1");
    const res = await POST("/api/procurement/spools/1/restore");
    assert.equal(res.status, 200);
    assert.equal(res.body.restored, 1);
    const doc = await db.collection("spools").findOne({ spoolId: 1 });
    assert.equal(doc.deletedAt, undefined);
  });

  it("returns 409 if not deleted", async () => {
    await db.collection("spools").insertOne({ spoolId: 1, brand: "Bambu" });
    const res = await POST("/api/procurement/spools/1/restore");
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await POST("/api/procurement/spools/999/restore");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await POST("/api/procurement/spools/abc/restore");
    assert.equal(res.status, 400);
  });
});

// ===========================================================================
// Procurement — Hardware
// ===========================================================================

describe("GET /api/procurement/hardware", () => {
  it("returns empty array when no hardware", async () => {
    const res = await GET("/api/procurement/hardware");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("returns hardware sorted by hardwareId", async () => {
    await db.collection("hardware").insertMany([
      { hardwareId: 2, item: "Bolt" },
      { hardwareId: 1, item: "Nut" },
    ]);
    const res = await GET("/api/procurement/hardware");
    assert.equal(res.status, 200);
    assert.equal(res.body[0].hardwareId, 1);
  });

  it("returns CSV when Accept: text/csv", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    const res = await GET("/api/procurement/hardware", { accept: "text/csv" });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type").startsWith("text/csv"));
  });
});

describe("POST /api/procurement/hardware", () => {
  it("creates hardware from JSON", async () => {
    const res = await POST("/api/procurement/hardware", { hardwareId: 1, item: "Bolt" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("creates hardware from array", async () => {
    const res = await POST("/api/procurement/hardware", [
      { hardwareId: 1, item: "Bolt" },
      { hardwareId: 2, item: "Nut" },
    ]);
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 2);
  });

  it("creates hardware from CSV", async () => {
    const csv = "hardwareId,item\n1,Bolt\n";
    const res = await POST("/api/procurement/hardware", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("rejects empty payload", async () => {
    const res = await POST("/api/procurement/hardware", []);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Nn]o records/);
  });
});

describe("GET /api/procurement/hardware/:hardwareId", () => {
  it("returns a single hardware item by ID", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    const res = await GET("/api/procurement/hardware/1");
    assert.equal(res.status, 200);
    assert.equal(res.body.item, "Bolt");
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await GET("/api/procurement/hardware/999");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await GET("/api/procurement/hardware/abc");
    assert.equal(res.status, 400);
  });
});

describe("PUT /api/procurement/hardware/:hardwareId", () => {
  it("updates a hardware item", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt", supplier: "McMaster" });
    const res = await PUT("/api/procurement/hardware/1", { item: "Nut" });
    assert.equal(res.status, 200);
    assert.equal(res.body.item, "Nut");
    assert.equal(res.body.supplier, "McMaster");
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await PUT("/api/procurement/hardware/999", { item: "X" });
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await PUT("/api/procurement/hardware/abc", { item: "X" });
    assert.equal(res.status, 400);
  });

  it("returns 400 for empty update", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    const res = await PUT("/api/procurement/hardware/1", {});
    assert.equal(res.status, 400);
  });

  it("rejects edit on deleted hardware", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt", deletedAt: "2025-01-01T00:00:00Z" });
    const res = await PUT("/api/procurement/hardware/1", { item: "X" });
    assert.equal(res.status, 409);
  });
});

describe("DELETE /api/procurement/hardware/:hardwareId (soft delete)", () => {
  it("soft-deletes a hardware item", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    const res = await DELETE("/api/procurement/hardware/1");
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, 1);
    const doc = await db.collection("hardware").findOne({ hardwareId: 1 });
    assert.ok(doc.deletedAt);
  });

  it("excludes soft-deleted from default GET", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    await DELETE("/api/procurement/hardware/1");
    const res = await GET("/api/procurement/hardware");
    assert.equal(res.body.length, 0);
  });

  it("includes soft-deleted with ?includeDeleted=true", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    await DELETE("/api/procurement/hardware/1");
    const res = await GET("/api/procurement/hardware?includeDeleted=true");
    assert.equal(res.body.length, 1);
  });

  it("returns 409 if already deleted", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    await DELETE("/api/procurement/hardware/1");
    const res = await DELETE("/api/procurement/hardware/1");
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await DELETE("/api/procurement/hardware/999");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await DELETE("/api/procurement/hardware/abc");
    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/procurement/hardware/:hardwareId/permanent", () => {
  it("permanently deletes a soft-deleted hardware item", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    await DELETE("/api/procurement/hardware/1");
    const res = await DELETE("/api/procurement/hardware/1/permanent");
    assert.equal(res.status, 200);
    const doc = await db.collection("hardware").findOne({ hardwareId: 1 });
    assert.equal(doc, null);
  });

  it("returns 409 if not soft-deleted first", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    const res = await DELETE("/api/procurement/hardware/1/permanent");
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await DELETE("/api/procurement/hardware/999/permanent");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await DELETE("/api/procurement/hardware/abc/permanent");
    assert.equal(res.status, 400);
  });
});

describe("POST /api/procurement/hardware/:hardwareId/restore", () => {
  it("restores a soft-deleted hardware item", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    await DELETE("/api/procurement/hardware/1");
    const res = await POST("/api/procurement/hardware/1/restore");
    assert.equal(res.status, 200);
    assert.equal(res.body.restored, 1);
    const doc = await db.collection("hardware").findOne({ hardwareId: 1 });
    assert.equal(doc.deletedAt, undefined);
  });

  it("returns 409 if not deleted", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Bolt" });
    const res = await POST("/api/procurement/hardware/1/restore");
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await POST("/api/procurement/hardware/999/restore");
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await POST("/api/procurement/hardware/abc/restore");
    assert.equal(res.status, 400);
  });
});

// ===========================================================================
// Manufacturing — Print Jobs
// ===========================================================================

describe("GET /api/manufacturing/print-jobs", () => {
  it("returns empty array when no print jobs", async () => {
    const res = await GET("/api/manufacturing/print-jobs");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("returns print jobs sorted by date descending", async () => {
    await db.collection("print_jobs").insertMany([
      { date: "2025-01-01", batchId: 1, project: "A" },
      { date: "2025-02-01", batchId: 1, project: "B" },
    ]);
    const res = await GET("/api/manufacturing/print-jobs");
    assert.equal(res.status, 200);
    assert.equal(res.body[0].project, "B");
  });

  it("returns CSV when Accept: text/csv", async () => {
    await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "A" });
    const res = await GET("/api/manufacturing/print-jobs", { accept: "text/csv" });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type").startsWith("text/csv"));
  });
});

describe("POST /api/manufacturing/print-jobs", () => {
  it("creates print job from JSON", async () => {
    const res = await POST("/api/manufacturing/print-jobs", { date: "2025-01-01", project: "Boot" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("creates print jobs from array", async () => {
    const res = await POST("/api/manufacturing/print-jobs", [
      { date: "2025-01-01", project: "Boot" },
      { date: "2025-01-02", project: "Bushing" },
    ]);
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 2);
  });

  it("creates print jobs from CSV", async () => {
    const csv = "date,project\n2025-01-01,Boot\n";
    const res = await POST("/api/manufacturing/print-jobs", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("rejects empty payload", async () => {
    const res = await POST("/api/manufacturing/print-jobs", []);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Nn]o records/);
  });
});

describe("GET /api/manufacturing/print-jobs/:id", () => {
  it("returns a single print job by ID", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    const res = await GET(`/api/manufacturing/print-jobs/${insertedId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.project, "Boot");
  });

  it("returns 404 for non-existent ID", async () => {
    const fakeId = new ObjectId();
    const res = await GET(`/api/manufacturing/print-jobs/${fakeId}`);
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await GET("/api/manufacturing/print-jobs/not-an-id");
    assert.equal(res.status, 400);
  });
});

describe("PUT /api/manufacturing/print-jobs/:id", () => {
  it("updates a print job", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot", usageG: 10 });
    const res = await PUT(`/api/manufacturing/print-jobs/${insertedId}`, { project: "Bushing", usageG: 20 });
    assert.equal(res.status, 200);
    assert.equal(res.body.project, "Bushing");
    assert.equal(res.body.usageG, 20);
    assert.equal(res.body.date, "2025-01-01"); // unchanged field preserved
  });

  it("returns 404 for non-existent ID", async () => {
    const fakeId = new ObjectId();
    const res = await PUT(`/api/manufacturing/print-jobs/${fakeId}`, { project: "X" });
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await PUT("/api/manufacturing/print-jobs/not-an-id", { project: "X" });
    assert.equal(res.status, 400);
  });

  it("returns 400 for empty update", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    const res = await PUT(`/api/manufacturing/print-jobs/${insertedId}`, {});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /[Nn]othing to update/);
  });

  it("ignores _id in update body", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    const res = await PUT(`/api/manufacturing/print-jobs/${insertedId}`, { _id: "fake", project: "Bushing" });
    assert.equal(res.status, 200);
    assert.equal(res.body.project, "Bushing");
  });
});

describe("DELETE /api/manufacturing/print-jobs/:id (soft delete)", () => {
  it("soft-deletes a print job by setting deletedAt", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    const res = await DELETE(`/api/manufacturing/print-jobs/${insertedId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, 1);
    // still exists in DB with deletedAt
    const doc = await db.collection("print_jobs").findOne({ _id: insertedId });
    assert.ok(doc);
    assert.ok(doc.deletedAt);
  });

  it("excludes soft-deleted from default GET list", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    await DELETE(`/api/manufacturing/print-jobs/${insertedId}`);
    const res = await GET("/api/manufacturing/print-jobs");
    assert.equal(res.body.length, 0);
  });

  it("includes soft-deleted with ?includeDeleted=true", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    await DELETE(`/api/manufacturing/print-jobs/${insertedId}`);
    const res = await GET("/api/manufacturing/print-jobs?includeDeleted=true");
    assert.equal(res.body.length, 1);
  });

  it("returns 409 if already soft-deleted", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    await DELETE(`/api/manufacturing/print-jobs/${insertedId}`);
    const res = await DELETE(`/api/manufacturing/print-jobs/${insertedId}`);
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const fakeId = new ObjectId();
    const res = await DELETE(`/api/manufacturing/print-jobs/${fakeId}`);
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await DELETE("/api/manufacturing/print-jobs/not-an-id");
    assert.equal(res.status, 400);
  });

  it("rejects PUT on soft-deleted print job", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    await DELETE(`/api/manufacturing/print-jobs/${insertedId}`);
    const res = await PUT(`/api/manufacturing/print-jobs/${insertedId}`, { project: "X" });
    assert.equal(res.status, 409);
  });
});

describe("DELETE /api/manufacturing/print-jobs/:id/permanent", () => {
  it("permanently deletes a soft-deleted print job", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    await DELETE(`/api/manufacturing/print-jobs/${insertedId}`);
    const res = await DELETE(`/api/manufacturing/print-jobs/${insertedId}/permanent`);
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, 1);
    const doc = await db.collection("print_jobs").findOne({ _id: insertedId });
    assert.equal(doc, null);
  });

  it("returns 409 if not soft-deleted first", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    const res = await DELETE(`/api/manufacturing/print-jobs/${insertedId}/permanent`);
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const fakeId = new ObjectId();
    const res = await DELETE(`/api/manufacturing/print-jobs/${fakeId}/permanent`);
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await DELETE("/api/manufacturing/print-jobs/not-an-id/permanent");
    assert.equal(res.status, 400);
  });
});

describe("POST /api/manufacturing/print-jobs/:id/restore", () => {
  it("restores a soft-deleted print job", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    await DELETE(`/api/manufacturing/print-jobs/${insertedId}`);
    const res = await POST(`/api/manufacturing/print-jobs/${insertedId}/restore`);
    assert.equal(res.status, 200);
    assert.equal(res.body.restored, 1);
    const doc = await db.collection("print_jobs").findOne({ _id: insertedId });
    assert.equal(doc.deletedAt, undefined);
  });

  it("returns 409 if not deleted", async () => {
    const { insertedId } = await db.collection("print_jobs").insertOne({ date: "2025-01-01", project: "Boot" });
    const res = await POST(`/api/manufacturing/print-jobs/${insertedId}/restore`);
    assert.equal(res.status, 409);
  });

  it("returns 404 for non-existent ID", async () => {
    const fakeId = new ObjectId();
    const res = await POST(`/api/manufacturing/print-jobs/${fakeId}/restore`);
    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid ID", async () => {
    const res = await POST("/api/manufacturing/print-jobs/not-an-id/restore");
    assert.equal(res.status, 400);
  });
});

// ===========================================================================
// Dashboard
// ===========================================================================

describe("GET /api/dashboard", () => {
  it("returns aggregated dashboard with empty collections", async () => {
    const res = await GET("/api/dashboard");
    assert.equal(res.status, 200);
    assert.ok(res.body.balanceSheet);
    assert.ok(res.body.profitLoss);
    assert.ok(res.body.procurement);
    assert.ok(res.body.manufacturing);
    assert.equal(res.body.procurement.totalSpools, 0);
    assert.equal(res.body.manufacturing.totalJobs, 0);
    assert.equal(res.body.manufacturing.scrapRate, "0");
  });

  it("returns correct balance sheet aggregations", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const res = await GET("/api/dashboard");
    assert.equal(res.body.balanceSheet.totalAssets, 100);
    assert.ok(res.body.balanceSheet.byType.asset);
  });

  it("returns correct P&L with expenses and revenue", async () => {
    await seedAccounts();
    // Revenue entry: cash debit 100, revenue credit 100
    await POST("/api/finance/journal", balancedEntry());
    // Expense entry: expense debit 50, payable credit 50
    await POST("/api/finance/journal", balancedEntry({
      effective: "2025-06-02",
      lines: [
        { accountNumber: 5000, debit: 50, credit: 0 },
        { accountNumber: 2000, debit: 0, credit: 50 },
      ],
    }));

    const res = await GET("/api/dashboard");
    assert.equal(res.body.profitLoss.revenue, 100);
    assert.equal(res.body.profitLoss.totalExpenses, 50);
    assert.equal(res.body.profitLoss.netIncome, 50);
    assert.ok(res.body.profitLoss.expensesByCategory["Filament Expense"]);
  });

  it("returns correct procurement aggregations", async () => {
    await db.collection("spools").insertMany([
      { spoolId: 1, remainingG: 500, cost: 25 },
      { spoolId: 2, remainingG: 0, cost: 25 },
    ]);

    const res = await GET("/api/dashboard");
    assert.equal(res.body.procurement.totalFilamentG, 500);
    assert.equal(res.body.procurement.totalFilamentCost, 50);
    assert.equal(res.body.procurement.activeSpools, 1);
    assert.equal(res.body.procurement.depletedSpools, 1);
    assert.equal(res.body.procurement.totalSpools, 2);
  });

  it("returns correct manufacturing aggregations", async () => {
    await db.collection("print_jobs").insertMany([
      { totalHours: 2, cost: 5, success: true },
      { totalHours: 1, cost: 3, success: false },
    ]);

    const res = await GET("/api/dashboard");
    assert.equal(res.body.manufacturing.totalPrintHours, 3);
    assert.equal(res.body.manufacturing.totalPrintCost, 8);
    assert.equal(res.body.manufacturing.totalJobs, 2);
    assert.equal(res.body.manufacturing.failedJobs, 1);
    assert.equal(res.body.manufacturing.scrapRate, "50.0");
  });
});

// ===========================================================================
// CSV utilities (exercised via routes)
// ===========================================================================

describe("CSV parsing edge cases", () => {
  it("handles quoted fields with commas", async () => {
    const csv = 'name,description\n"Widget, Large","A ""big"" item"\n';
    const res = await POST("/api/finance/accounts", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    // Verify the parsed data
    const doc = await db.collection("accounts").findOne({ name: "Widget, Large" });
    assert.ok(doc);
    assert.equal(doc.description, 'A "big" item');
  });

  it("handles CRLF line endings in CSV", async () => {
    const csv = "spoolId,brand\r\n1,Bambu\r\n";
    const res = await POST("/api/procurement/spools", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
  });

  it("handles CSV with empty trailing rows", async () => {
    const csv = "spoolId,brand\n1,Bambu\n\n";
    const res = await POST("/api/procurement/spools", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("toCsv escapes fields with newlines", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: "Line\nBreak" });
    const res = await GET("/api/procurement/hardware", { accept: "text/csv" });
    assert.equal(res.status, 200);
    // Field with newline should be quoted
    assert.ok(res.body.includes('"Line\nBreak"'));
  });

  it("toCsv returns empty string for empty array", async () => {
    const res = await GET("/api/procurement/hardware", { accept: "text/csv" });
    assert.equal(res.status, 200);
    assert.equal(res.body, "");
  });

  it("toCsv handles null/undefined field values", async () => {
    await db.collection("hardware").insertOne({ hardwareId: 1, item: null });
    const res = await GET("/api/procurement/hardware", { accept: "text/csv" });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes("hardwareId"));
  });

  it("parseCsv handles empty string input", async () => {
    const res = await POST("/api/procurement/spools", "", { "content-type": "text/csv" });
    assert.equal(res.status, 400);
  });

  it("skips rows where first field is empty", async () => {
    const csv = "spoolId,brand\n1,Bambu\n,\n";
    const res = await POST("/api/procurement/spools", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    assert.equal(res.body.inserted, 1);
  });

  it("handles rows with fewer columns than headers", async () => {
    const csv = "spoolId,brand,material\n1,Bambu\n";
    const res = await POST("/api/procurement/spools", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    const doc = await db.collection("spools").findOne({ spoolId: "1" });
    assert.equal(doc.material, "");
  });

  it("handles quoted field with newline inside", async () => {
    const csv = 'hardwareId,item\n1,"Multi\nLine"\n';
    const res = await POST("/api/procurement/hardware", csv, { "content-type": "text/csv" });
    assert.equal(res.status, 201);
    const doc = await db.collection("hardware").findOne({ hardwareId: "1" });
    assert.equal(doc.item, "Multi\nLine");
  });
});

// ===========================================================================
// Journal entry with missing account (acct is null in balance loops)
// ===========================================================================

describe("Journal entries with missing accounts", () => {
  it("POST skips balance update for non-existent account", async () => {
    // Insert only Cash account, not account 9999
    await db.collection("accounts").insertOne({ number: 1000, name: "Cash", type: "asset", balance: 0 });

    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000, debit: 100, credit: 0 },
        { accountNumber: 9999, debit: 0, credit: 100 },
      ],
    };
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 201);
    // Cash balance updated, 9999 skipped (no upsert)
    const cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 100);
  });

  it("PUT skips balance reversal for non-existent account in old entry", async () => {
    await db.collection("accounts").insertOne({ number: 1000, name: "Cash", type: "asset", balance: 0 });

    // Create entry referencing non-existent account
    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000, debit: 100, credit: 0 },
        { accountNumber: 9999, debit: 0, credit: 100 },
      ],
    };
    await POST("/api/finance/journal", entry);

    // Update to use only existing account
    const updated = {
      effective: "2025-06-02",
      lines: [
        { accountNumber: 1000, debit: 50, credit: 0 },
        { accountNumber: 9999, debit: 0, credit: 50 },
      ],
    };
    const res = await PUT("/api/finance/journal/1", updated);
    assert.equal(res.status, 200);
  });

  it("DELETE skips balance reversal for non-existent account", async () => {
    await db.collection("accounts").insertOne({ number: 1000, name: "Cash", type: "asset", balance: 0 });

    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000, debit: 100, credit: 0 },
        { accountNumber: 9999, debit: 0, credit: 100 },
      ],
    };
    await POST("/api/finance/journal", entry);

    const res = await DELETE("/api/finance/journal/1");
    assert.equal(res.status, 200);
  });

  it("restore skips balance re-apply for non-existent account", async () => {
    await db.collection("accounts").insertOne({ number: 1000, name: "Cash", type: "asset", balance: 0 });

    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000, debit: 100, credit: 0 },
        { accountNumber: 9999, debit: 0, credit: 100 },
      ],
    };
    await POST("/api/finance/journal", entry);
    await DELETE("/api/finance/journal/1");

    const res = await POST("/api/finance/journal/1/restore");
    assert.equal(res.status, 200);
  });

  it("dashboard handles entries with missing account references", async () => {
    await db.collection("accounts").insertOne({ number: 1000, name: "Cash", type: "asset", balance: 100 });
    await db.collection("journal_entries").insertOne({
      transactionId: 1,
      effective: "2025-01-01",
      lines: [
        { accountNumber: 1000, debit: 100 },
        { accountNumber: 9999, credit: 100 },
      ],
    });

    const res = await GET("/api/dashboard");
    assert.equal(res.status, 200);
    // Should not crash; missing account lines are skipped
    assert.equal(res.body.balanceSheet.totalAssets, 100);
  });
});

// ===========================================================================
// Journal entry edge cases for ?? operators
// ===========================================================================

describe("Journal entry null coalescing edge cases", () => {
  it("handles lines with only debit (no credit field)", async () => {
    await seedAccounts();
    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000, debit: 100 },
        { accountNumber: 4000, credit: 100 },
      ],
    };
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 201);

    const cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 100);
  });

  it("handles spools with missing remainingG and cost", async () => {
    await db.collection("spools").insertMany([
      { spoolId: 1 },
      { spoolId: 2 },
    ]);
    const res = await GET("/api/dashboard");
    assert.equal(res.status, 200);
    assert.equal(res.body.procurement.totalFilamentG, 0);
    assert.equal(res.body.procurement.totalFilamentCost, 0);
    assert.equal(res.body.procurement.activeSpools, 0);
    assert.equal(res.body.procurement.depletedSpools, 2);
  });

  it("handles print jobs with missing totalHours and cost", async () => {
    await db.collection("print_jobs").insertMany([
      { project: "A" },
      { project: "B" },
    ]);
    const res = await GET("/api/dashboard");
    assert.equal(res.status, 200);
    assert.equal(res.body.manufacturing.totalPrintHours, 0);
    assert.equal(res.body.manufacturing.totalPrintCost, 0);
    assert.equal(res.body.manufacturing.totalJobs, 2);
  });

  it("first journal entry gets transactionId 1 when no prior entries", async () => {
    await seedAccounts();
    const res = await POST("/api/finance/journal", balancedEntry());
    assert.equal(res.body.transactionId, 1);
  });

  it("POST handles lines with undefined debit and credit", async () => {
    await seedAccounts();
    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000 },
        { accountNumber: 4000 },
      ],
    };
    const res = await POST("/api/finance/journal", entry);
    assert.equal(res.status, 201);
    // Both debit and credit default to 0 via ?? operator, so balanced
    const cash = await db.collection("accounts").findOne({ number: 1000 });
    assert.equal(cash.balance, 0);
  });

  it("PUT reverses old entry with undefined debit/credit and applies new with partial fields", async () => {
    await seedAccounts();
    // Manually insert entry with lines missing debit/credit (existing accounts)
    await db.collection("journal_entries").insertOne({
      transactionId: 1,
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000 },
        { accountNumber: 4000 },
      ],
    });

    // Update with lines that have only debit or only credit (no zero counterpart)
    // This exercises ?? 0 in both reduce (line 150-151) and apply-new loop (line 177-178)
    const updated = {
      effective: "2025-07-01",
      lines: [
        { accountNumber: 1000, debit: 50 },
        { accountNumber: 4000, credit: 50 },
      ],
    };
    const res = await PUT("/api/finance/journal/1", updated);
    assert.equal(res.status, 200);
  });

  it("PUT applies new balance with all fields undefined for both account types", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    // Update with lines where both debit and credit are undefined
    // Both credit-normal (4000) and debit-normal (1000) exercise ?? 0 in apply-new loop
    const updated = {
      effective: "2025-07-01",
      lines: [
        { accountNumber: 1000 },
        { accountNumber: 4000 },
      ],
    };
    const res = await PUT("/api/finance/journal/1", updated);
    assert.equal(res.status, 200);
  });

  it("DELETE reverses lines with undefined debit/credit fields", async () => {
    await seedAccounts();
    // Manually insert entry with lines missing debit/credit
    await db.collection("journal_entries").insertOne({
      transactionId: 1,
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000 },
        { accountNumber: 4000 },
      ],
    });

    const res = await DELETE("/api/finance/journal/1");
    assert.equal(res.status, 200);
  });

  it("restore reapplies lines with undefined debit/credit fields", async () => {
    await seedAccounts();
    // Manually insert soft-deleted entry with lines missing debit/credit
    await db.collection("journal_entries").insertOne({
      transactionId: 1,
      effective: "2025-06-01",
      deletedAt: "2025-06-02T00:00:00Z",
      lines: [
        { accountNumber: 1000 },
        { accountNumber: 4000 },
      ],
    });

    const res = await POST("/api/finance/journal/1/restore");
    assert.equal(res.status, 200);
  });

  it("PUT handles update with no description field", async () => {
    await seedAccounts();
    await POST("/api/finance/journal", balancedEntry());

    const updated = {
      effective: "2025-07-01",
      lines: [
        { accountNumber: 1000, debit: 50, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 50 },
      ],
    };
    const res = await PUT("/api/finance/journal/1", updated);
    assert.equal(res.status, 200);
  });

  it("dashboard handles revenue with debit line (no credit)", async () => {
    await seedAccounts();
    // Revenue account with a debit line (reversal scenario)
    await db.collection("journal_entries").insertOne({
      transactionId: 1,
      effective: "2025-01-01",
      lines: [
        { accountNumber: 4000, debit: 50 },
        { accountNumber: 1000, credit: 50 },
      ],
    });

    const res = await GET("/api/dashboard");
    assert.equal(res.status, 200);
    // Revenue debit line should not add to revenue (line.credit is falsy)
    assert.equal(res.body.profitLoss.revenue, 0);
  });

  it("dashboard handles expense with credit line (no debit)", async () => {
    await seedAccounts();
    // Expense account with a credit line (reversal scenario)
    await db.collection("journal_entries").insertOne({
      transactionId: 1,
      effective: "2025-01-01",
      lines: [
        { accountNumber: 5000, credit: 50 },
        { accountNumber: 1000, debit: 50 },
      ],
    });

    const res = await GET("/api/dashboard");
    assert.equal(res.status, 200);
    assert.equal(res.body.profitLoss.totalExpenses, 0);
  });

  it("PUT with equity account (credit-normal) reversal and reapply", async () => {
    await seedAccounts();
    // Entry: debit cash, credit equity
    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000, debit: 100, credit: 0 },
        { accountNumber: 3000, debit: 0, credit: 100 },
      ],
    };
    await POST("/api/finance/journal", entry);

    const equity = await db.collection("accounts").findOne({ number: 3000 });
    assert.equal(equity.balance, 100);

    // Update: change amount
    const updated = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 1000, debit: 200, credit: 0 },
        { accountNumber: 3000, debit: 0, credit: 200 },
      ],
    };
    await PUT("/api/finance/journal/1", updated);

    const equityAfter = await db.collection("accounts").findOne({ number: 3000 });
    assert.equal(equityAfter.balance, 200);
  });

  it("DELETE and restore with liability account", async () => {
    await seedAccounts();
    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 5000, debit: 75, credit: 0 },
        { accountNumber: 2000, debit: 0, credit: 75 },
      ],
    };
    await POST("/api/finance/journal", entry);

    await DELETE("/api/finance/journal/1");
    const payableAfterDelete = await db.collection("accounts").findOne({ number: 2000 });
    assert.equal(payableAfterDelete.balance, 0);

    await POST("/api/finance/journal/1/restore");
    const payableAfterRestore = await db.collection("accounts").findOne({ number: 2000 });
    assert.equal(payableAfterRestore.balance, 75);
  });

  it("dashboard handles journal entries where debit/credit lines touch revenue or expense", async () => {
    await seedAccounts();
    // Entry with both revenue credit AND expense debit
    const entry = {
      effective: "2025-06-01",
      lines: [
        { accountNumber: 5000, debit: 100, credit: 0 },
        { accountNumber: 4000, debit: 0, credit: 100 },
      ],
    };
    await POST("/api/finance/journal", entry);

    const res = await GET("/api/dashboard");
    assert.equal(res.body.profitLoss.revenue, 100);
    assert.equal(res.body.profitLoss.totalExpenses, 100);
    assert.equal(res.body.profitLoss.netIncome, 0);
  });

  it("dashboard handles accounts with types not in byType yet", async () => {
    // Add a COGS account type not typically seeded
    await db.collection("accounts").insertOne({ number: 6000, name: "COGS", type: "cogs", balance: 50 });
    const res = await GET("/api/dashboard");
    assert.equal(res.status, 200);
    assert.ok(res.body.balanceSheet.byType.cogs);
    assert.equal(res.body.balanceSheet.byType.cogs[0].balance, 50);
  });
});

// ===========================================================================
// Generic CRUD resource tests
// ===========================================================================

/**
 * Generate a full CRUD test suite for a resource.
 * @param {string} label       — human name (e.g. "Printers")
 * @param {string} basePath    — API base (e.g. "/api/procurement/printers")
 * @param {string} collection  — Mongo collection name
 * @param {string} idField     — document ID field (e.g. "printerId")
 * @param {object} sampleDoc   — a valid document for insert
 */
function crudTests(label, basePath, collection, idField, sampleDoc) {
  describe(`${label} CRUD — ${basePath}`, () => {
    it("GET list returns empty array", async () => {
      const res = await GET(basePath);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    it("GET list excludes soft-deleted by default", async () => {
      await db.collection(collection).insertMany([
        { ...sampleDoc, [idField]: 1 },
        { ...sampleDoc, [idField]: 2, deletedAt: "2025-01-01T00:00:00Z" },
      ]);
      const res = await GET(basePath);
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0][idField], 1);
    });

    it("GET list includes soft-deleted with includeDeleted=true", async () => {
      await db.collection(collection).insertMany([
        { ...sampleDoc, [idField]: 1 },
        { ...sampleDoc, [idField]: 2, deletedAt: "2025-01-01T00:00:00Z" },
      ]);
      const res = await GET(`${basePath}?includeDeleted=true`);
      assert.equal(res.body.length, 2);
    });

    it("GET by ID returns the document", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1 });
      const res = await GET(`${basePath}/1`);
      assert.equal(res.status, 200);
      assert.equal(res.body[idField], 1);
    });

    it("GET by ID returns 400 for invalid ID", async () => {
      const res = await GET(`${basePath}/abc`);
      assert.equal(res.status, 400);
    });

    it("GET by ID returns 404 for missing", async () => {
      const res = await GET(`${basePath}/999`);
      assert.equal(res.status, 404);
    });

    it("POST creates a single record", async () => {
      const res = await POST(basePath, { ...sampleDoc, [idField]: 1 });
      assert.equal(res.status, 201);
      assert.equal(res.body.inserted, 1);
      const doc = await db.collection(collection).findOne({ [idField]: 1 });
      assert.ok(doc);
      assert.ok(doc.createdAt);
    });

    it("POST creates an array of records", async () => {
      const res = await POST(basePath, [
        { ...sampleDoc, [idField]: 1 },
        { ...sampleDoc, [idField]: 2 },
      ]);
      assert.equal(res.status, 201);
      assert.equal(res.body.inserted, 2);
    });

    it("POST preserves pre-set createdAt and updatedAt", async () => {
      const ts = "2020-01-01T00:00:00.000Z";
      const res = await POST(basePath, { ...sampleDoc, [idField]: 99, createdAt: ts, updatedAt: ts });
      assert.equal(res.status, 201);
      const doc = await db.collection(collection).findOne({ [idField]: 99 });
      assert.equal(doc.createdAt, ts);
      assert.equal(doc.updatedAt, ts);
    });

    it("POST returns 400 for empty array", async () => {
      const res = await POST(basePath, []);
      assert.equal(res.status, 400);
    });

    it("PUT updates a record", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1 });
      const res = await PUT(`${basePath}/1`, { name: "Updated" });
      assert.equal(res.status, 200);
      assert.equal(res.body.name, "Updated");
    });

    it("PUT returns 400 for invalid ID", async () => {
      const res = await PUT(`${basePath}/abc`, {});
      assert.equal(res.status, 400);
    });

    it("PUT returns 404 for missing", async () => {
      const res = await PUT(`${basePath}/999`, {});
      assert.equal(res.status, 404);
    });

    it("PUT returns 409 for soft-deleted", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1, deletedAt: "2025-01-01T00:00:00Z" });
      const res = await PUT(`${basePath}/1`, {});
      assert.equal(res.status, 409);
    });

    it("DELETE soft-deletes a record", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1 });
      const res = await DELETE(`${basePath}/1`);
      assert.equal(res.status, 200);
      assert.equal(res.body.deleted, 1);
      const doc = await db.collection(collection).findOne({ [idField]: 1 });
      assert.ok(doc.deletedAt);
    });

    it("DELETE returns 400 for invalid ID", async () => {
      const res = await DELETE(`${basePath}/abc`);
      assert.equal(res.status, 400);
    });

    it("DELETE returns 404 for missing", async () => {
      const res = await DELETE(`${basePath}/999`);
      assert.equal(res.status, 404);
    });

    it("DELETE returns 409 for already-deleted", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1, deletedAt: "2025-01-01T00:00:00Z" });
      const res = await DELETE(`${basePath}/1`);
      assert.equal(res.status, 409);
    });

    it("DELETE permanent removes a soft-deleted record", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1, deletedAt: "2025-01-01T00:00:00Z" });
      const res = await DELETE(`${basePath}/1/permanent`);
      assert.equal(res.status, 200);
      assert.equal(res.body.deleted, 1);
      const doc = await db.collection(collection).findOne({ [idField]: 1 });
      assert.equal(doc, null);
    });

    it("DELETE permanent returns 400 for invalid ID", async () => {
      const res = await DELETE(`${basePath}/abc/permanent`);
      assert.equal(res.status, 400);
    });

    it("DELETE permanent returns 404 for missing", async () => {
      const res = await DELETE(`${basePath}/999/permanent`);
      assert.equal(res.status, 404);
    });

    it("DELETE permanent returns 409 for non-deleted", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1 });
      const res = await DELETE(`${basePath}/1/permanent`);
      assert.equal(res.status, 409);
    });

    it("POST restore restores a soft-deleted record", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1, deletedAt: "2025-01-01T00:00:00Z" });
      const res = await POST(`${basePath}/1/restore`);
      assert.equal(res.status, 200);
      const doc = await db.collection(collection).findOne({ [idField]: 1 });
      assert.equal(doc.deletedAt, undefined);
    });

    it("POST restore returns 400 for invalid ID", async () => {
      const res = await POST(`${basePath}/abc/restore`);
      assert.equal(res.status, 400);
    });

    it("POST restore returns 404 for missing", async () => {
      const res = await POST(`${basePath}/999/restore`);
      assert.equal(res.status, 404);
    });

    it("POST restore returns 409 for non-deleted", async () => {
      await db.collection(collection).insertOne({ ...sampleDoc, [idField]: 1 });
      const res = await POST(`${basePath}/1/restore`);
      assert.equal(res.status, 409);
    });
  });
}

// Run CRUD tests for each resource
crudTests("Printers", "/api/procurement/printers", "printers", "printerId", { name: "A1 Lab", brand: "Bambu" });
crudTests("Nozzles", "/api/procurement/nozzles", "nozzles", "nozzleId", { brand: "Bambu", nozzle: "0.4mm Stainless" });
crudTests("Plates", "/api/procurement/plates", "plates", "plateId", { brand: "Bambu", plate: "Textured PEI" });
crudTests("Products", "/api/products", "products", "productId", { name: "Boot", price: 10 });
crudTests("Projects", "/api/projects", "projects", "projectId", { name: "Kneeler" });
crudTests("Sales", "/api/sales", "sales", "saleId", { product: "Boot", quantity: 1, effective: "2025-06-01" });
crudTests("Inventory", "/api/inventory", "inventory", "inventoryId", { product: "Boot", quantity: 10, remaining: 10, components: [], hardware: [] });
crudTests("Component Stock", "/api/manufacturing/components", "component_stock", "batchId", { part: "Insert", quantity: 20, remaining: 15 });

// ===========================================================================
// Inventory POST — component/hardware decrement
// ===========================================================================

describe("POST /api/inventory — stock decrement", () => {
  it("decrements component_stock remaining when creating inventory", async () => {
    await db.collection("component_stock").insertOne({ batchId: 10, part: "Upper Boot", quantity: 20, remaining: 15 });
    await db.collection("hardware").insertOne({ hardwareId: 20, item: "M5 Bolt", quantity: 100, remaining: 50 });

    const res = await POST("/api/inventory", {
      inventoryId: 1,
      product: "Boot Assembly",
      quantity: 5,
      remaining: 5,
      components: [{ batchId: 10, part: "Upper Boot", quantity: 5 }],
      hardware: [{ hardwareId: 20, item: "M5 Bolt", quantity: 10 }],
    });
    assert.equal(res.status, 201);

    const comp = await db.collection("component_stock").findOne({ batchId: 10 });
    assert.equal(comp.remaining, 10); // 15 - 5

    const hw = await db.collection("hardware").findOne({ hardwareId: 20 });
    assert.equal(hw.remaining, 40); // 50 - 10
  });

  it("skips decrement for zero-quantity components and hardware", async () => {
    await db.collection("component_stock").insertOne({ batchId: 10, part: "Boot", quantity: 20, remaining: 15 });
    await db.collection("hardware").insertOne({ hardwareId: 20, item: "Bolt", quantity: 100, remaining: 50 });

    await POST("/api/inventory", {
      inventoryId: 2,
      product: "Empty",
      quantity: 0,
      remaining: 0,
      components: [{ batchId: 10, part: "Boot", quantity: 0 }],
      hardware: [{ hardwareId: 20, item: "Bolt", quantity: 0 }],
    });

    const comp = await db.collection("component_stock").findOne({ batchId: 10 });
    assert.equal(comp.remaining, 15); // unchanged

    const hw = await db.collection("hardware").findOne({ hardwareId: 20 });
    assert.equal(hw.remaining, 50); // unchanged
  });

  it("handles inventory with no components or hardware arrays", async () => {
    const res = await POST("/api/inventory", {
      inventoryId: 3,
      product: "Simple",
      quantity: 1,
      remaining: 1,
    });
    assert.equal(res.status, 201);
  });

  it("skips decrement when batchId or hardwareId is falsy", async () => {
    await db.collection("component_stock").insertOne({ batchId: 10, part: "Boot", quantity: 20, remaining: 15 });
    await db.collection("hardware").insertOne({ hardwareId: 20, item: "Bolt", quantity: 100, remaining: 50 });

    await POST("/api/inventory", {
      inventoryId: 5,
      product: "Falsy IDs",
      quantity: 1,
      remaining: 1,
      components: [{ batchId: 0, part: "None", quantity: 5 }],
      hardware: [{ hardwareId: 0, item: "None", quantity: 5 }],
    });

    const comp = await db.collection("component_stock").findOne({ batchId: 10 });
    assert.equal(comp.remaining, 15); // unchanged — batchId 0 is falsy

    const hw = await db.collection("hardware").findOne({ hardwareId: 20 });
    assert.equal(hw.remaining, 50); // unchanged — hardwareId 0 is falsy
  });

  it("preserves pre-set timestamps on inventory items", async () => {
    const ts = "2020-01-01T00:00:00.000Z";
    const res = await POST("/api/inventory", {
      inventoryId: 4,
      product: "Timestamped",
      quantity: 1,
      remaining: 1,
      components: [],
      hardware: [],
      createdAt: ts,
      updatedAt: ts,
    });
    assert.equal(res.status, 201);
    const doc = await db.collection("inventory").findOne({ inventoryId: 4 });
    assert.equal(doc.createdAt, ts);
    assert.equal(doc.updatedAt, ts);
  });
});
