import { requireEmailVerified, requireRole } from "./auth.js";
import { parseCsv, negotiate, csvBodyParser } from "./csv.js";

const verified = requireEmailVerified;
const read = [verified, requireRole("owner", "auditor")];
const write = [verified, requireRole("owner")];

/**
 * @param {import('express').Express} app
 * @param {import('mongodb').Db} db
 */
export function createRoutes(app, db) {
  const accounts = db.collection("accounts");
  const journalEntries = db.collection("journal_entries");
  const spools = db.collection("spools");
  const hardware = db.collection("hardware");
  const printJobs = db.collection("print_jobs");

  // Raw body parsing for text/csv requests
  app.use(csvBodyParser);

  // =========================================================================
  // Finance
  // =========================================================================

  // -- Accounts --
  app.get("/api/finance/accounts", read, async (req, res) => {
    const docs = await accounts.find().sort({ number: 1 }).toArray();
    negotiate(req, res, docs, "accounts.csv");
  });

  app.post("/api/finance/accounts", write, async (req, res) => {
    const docs = req.headers["content-type"] === "text/csv" ? parseCsv(req.body) : req.body;
    const items = Array.isArray(docs) ? docs : [docs];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    for (const item of items) {
      if (await accounts.findOne({ number: item.number })) {
        return res.status(409).json({ error: `Account code ${item.number} already exists` });
      }
      if (await accounts.findOne({ name: item.name })) {
        return res.status(409).json({ error: `Account name "${item.name}" already exists` });
      }
    }
    const result = await accounts.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/finance/accounts/:number", write, async (req, res) => {
    const num = parseInt(req.params.number, 10);
    if (Number.isNaN(num)) return res.status(400).json({ error: "Invalid account number" });
    const existing = await accounts.findOne({ number: num });
    if (!existing) return res.status(404).json({ error: "Account not found" });
    const { number: newNumber, name, type } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (type !== undefined) update.type = type;
    if (newNumber !== undefined) update.number = newNumber;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });
    if (update.number !== undefined && update.number !== num) {
      if (await accounts.findOne({ number: update.number })) {
        return res.status(409).json({ error: `Account code ${update.number} already exists` });
      }
    }
    if (update.name !== undefined && update.name !== existing.name) {
      if (await accounts.findOne({ name: update.name })) {
        return res.status(409).json({ error: `Account name "${update.name}" already exists` });
      }
    }
    await accounts.updateOne({ number: num }, { $set: update });
    if (update.number !== undefined && update.number !== num) {
      await journalEntries.updateMany(
        { "lines.accountNumber": num },
        { $set: { "lines.$[el].accountNumber": update.number } },
        { arrayFilters: [{ "el.accountNumber": num }] }
      );
    }
    const doc = await accounts.findOne({ number: update.number ?? num });
    res.json(doc);
  });

  app.delete("/api/finance/accounts/:number", write, async (req, res) => {
    const num = parseInt(req.params.number, 10);
    if (Number.isNaN(num)) return res.status(400).json({ error: "Invalid account number" });
    const hasEntries = await journalEntries.findOne({ "lines.accountNumber": num });
    if (hasEntries) return res.status(409).json({ error: "Cannot delete account with ledger entries" });
    const result = await accounts.deleteOne({ number: num });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Account not found" });
    res.json({ deleted: 1 });
  });

  // -- Journal Entries (General Ledger) --
  app.get("/api/finance/ledger", read, async (req, res) => {
    const docs = await journalEntries.find().sort({ date: 1, transactionId: 1 }).toArray();
    negotiate(req, res, docs, "ledger.csv");
  });

  app.post("/api/finance/ledger", write, async (req, res) => {
    if (req.headers["content-type"] === "text/csv") {
      const rows = parseCsv(req.body);
      if (rows.length === 0) return res.status(400).json({ error: "No records provided" });
      const result = await journalEntries.insertMany(rows);
      return res.status(201).json({ inserted: result.insertedCount });
    }

    // JSON: single journal entry with balanced lines
    const entry = req.body;
    if (!entry.date || !entry.lines || !Array.isArray(entry.lines) || entry.lines.length < 2) {
      return res.status(400).json({ error: "Entry must have date and at least 2 lines" });
    }

    const totalDebit = entry.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      return res.status(400).json({ error: "Debits must equal credits" });
    }

    const last = await journalEntries.findOne({}, { sort: { transactionId: -1 } });
    entry.transactionId = (last?.transactionId ?? 0) + 1;

    for (const line of entry.lines) {
      const acct = await accounts.findOne({ number: line.accountNumber });
      const creditNormal = acct && ["liability", "equity", "revenue"].includes(acct.type);
      const inc = creditNormal
        ? (line.credit ?? 0) - (line.debit ?? 0)
        : (line.debit ?? 0) - (line.credit ?? 0);
      await accounts.updateOne(
        { number: line.accountNumber },
        { $inc: { balance: inc } },
        { upsert: false }
      );
    }

    await journalEntries.insertOne(entry);
    res.status(201).json(entry);
  });

  // =========================================================================
  // Procurement
  // =========================================================================

  // -- Spools --
  app.get("/api/procurement/spools", read, async (req, res) => {
    const docs = await spools.find().sort({ spoolId: 1 }).toArray();
    negotiate(req, res, docs, "spools.csv");
  });

  app.post("/api/procurement/spools", write, async (req, res) => {
    const docs = req.headers["content-type"] === "text/csv" ? parseCsv(req.body) : req.body;
    const items = Array.isArray(docs) ? docs : [docs];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const result = await spools.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  // -- Hardware --
  app.get("/api/procurement/hardware", read, async (req, res) => {
    const docs = await hardware.find().sort({ hardwareId: 1 }).toArray();
    negotiate(req, res, docs, "hardware.csv");
  });

  app.post("/api/procurement/hardware", write, async (req, res) => {
    const docs = req.headers["content-type"] === "text/csv" ? parseCsv(req.body) : req.body;
    const items = Array.isArray(docs) ? docs : [docs];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const result = await hardware.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  // =========================================================================
  // Manufacturing
  // =========================================================================

  // -- Print Jobs --
  app.get("/api/manufacturing/print-jobs", read, async (req, res) => {
    const docs = await printJobs.find().sort({ date: -1, batchId: -1 }).toArray();
    negotiate(req, res, docs, "print-jobs.csv");
  });

  app.post("/api/manufacturing/print-jobs", write, async (req, res) => {
    const docs = req.headers["content-type"] === "text/csv" ? parseCsv(req.body) : req.body;
    const items = Array.isArray(docs) ? docs : [docs];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const result = await printJobs.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  // =========================================================================
  // Dashboard (aggregation — JSON only)
  // =========================================================================

  app.get("/api/dashboard", read, async (_req, res) => {
    const [accts, entries, spoolDocs, jobDocs] = await Promise.all([
      accounts.find().toArray(),
      journalEntries.find().toArray(),
      spools.find().toArray(),
      printJobs.find().toArray(),
    ]);

    const byType = {};
    for (const a of accts) {
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push({ number: a.number, name: a.name, balance: a.balance });
    }

    const sum = (type) => (byType[type] ?? []).reduce((s, a) => s + a.balance, 0);

    const expensesByCategory = {};
    let revenue = 0;
    for (const e of entries) {
      for (const line of e.lines) {
        const acct = accts.find((a) => a.number === line.accountNumber);
        if (!acct) continue;
        if (acct.type === "revenue" && line.credit) revenue += line.credit;
        if (acct.type === "expense" && line.debit) {
          expensesByCategory[acct.name] = (expensesByCategory[acct.name] ?? 0) + line.debit;
        }
      }
    }
    const totalExpenses = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);

    const totalFilamentG = spoolDocs.reduce((s, sp) => s + (sp.remainingG ?? 0), 0);
    const totalFilamentCost = spoolDocs.reduce((s, sp) => s + (sp.cost ?? 0), 0);
    const activeSpools = spoolDocs.filter((s) => (s.remainingG ?? 0) > 0).length;
    const depletedSpools = spoolDocs.filter((s) => (s.remainingG ?? 0) === 0).length;

    const totalPrintHours = jobDocs.reduce((s, j) => s + (j.totalHours ?? 0), 0);
    const totalPrintCost = jobDocs.reduce((s, j) => s + (j.cost ?? 0), 0);
    const totalJobs = jobDocs.length;
    const failedJobs = jobDocs.filter((j) => j.success === false).length;

    res.json({
      balanceSheet: {
        byType,
        totalAssets: sum("asset"),
        totalLiabilities: sum("liability"),
        totalEquity: sum("equity"),
      },
      profitLoss: {
        revenue,
        expensesByCategory,
        totalExpenses,
        netIncome: revenue - totalExpenses,
      },
      procurement: {
        totalFilamentG,
        totalFilamentCost,
        activeSpools,
        depletedSpools,
        totalSpools: spoolDocs.length,
      },
      manufacturing: {
        totalPrintHours,
        totalPrintCost,
        totalJobs,
        failedJobs,
        scrapRate: totalJobs > 0 ? ((failedJobs / totalJobs) * 100).toFixed(1) : "0",
      },
    });
  });
}
