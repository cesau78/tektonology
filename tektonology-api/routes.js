import { requireEmailVerified, requireRole } from "./auth.js";

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

  // -- Accounts --
  app.get("/api/accounts", read, async (_req, res) => {
    const docs = await accounts.find().sort({ number: 1 }).toArray();
    res.json(docs);
  });

  // -- Journal Entries (Ledger) --
  app.get("/api/journal-entries", read, async (_req, res) => {
    const docs = await journalEntries.find().sort({ date: 1, transactionId: 1 }).toArray();
    res.json(docs);
  });

  app.post("/api/journal-entries", write, async (req, res) => {
    const entry = req.body;

    if (!entry.date || !entry.lines || !Array.isArray(entry.lines) || entry.lines.length < 2) {
      return res.status(400).json({ error: "Entry must have date and at least 2 lines" });
    }

    const totalDebit = entry.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      return res.status(400).json({ error: "Debits must equal credits" });
    }

    // Auto-assign transactionId
    const last = await journalEntries.findOne({}, { sort: { transactionId: -1 } });
    entry.transactionId = (last?.transactionId ?? 0) + 1;

    // Update account balances
    for (const line of entry.lines) {
      const inc = (line.debit ?? 0) - (line.credit ?? 0);
      await accounts.updateOne(
        { number: line.accountNumber },
        { $inc: { balance: inc } },
        { upsert: false }
      );
    }

    await journalEntries.insertOne(entry);
    res.status(201).json(entry);
  });

  // -- Spools --
  app.get("/api/spools", read, async (_req, res) => {
    const docs = await spools.find().sort({ spoolId: 1 }).toArray();
    res.json(docs);
  });

  // -- Hardware --
  app.get("/api/hardware", read, async (_req, res) => {
    const docs = await hardware.find().sort({ hardwareId: 1 }).toArray();
    res.json(docs);
  });

  // -- Print Jobs --
  app.get("/api/print-jobs", read, async (_req, res) => {
    const docs = await printJobs.find().sort({ date: -1, batchId: -1 }).toArray();
    res.json(docs);
  });

  // -- Dashboard aggregation --
  app.get("/api/dashboard", read, async (_req, res) => {
    const [accts, entries, spoolDocs, jobDocs] = await Promise.all([
      accounts.find().toArray(),
      journalEntries.find().toArray(),
      spools.find().toArray(),
      printJobs.find().toArray(),
    ]);

    // Account totals by type
    const byType = {};
    for (const a of accts) {
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push({ number: a.number, name: a.name, balance: a.balance });
    }

    const sum = (type) => (byType[type] ?? []).reduce((s, a) => s + a.balance, 0);

    // P&L from journal entries
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

    // Spool metrics
    const totalFilamentG = spoolDocs.reduce((s, sp) => s + (sp.remainingG ?? 0), 0);
    const totalFilamentCost = spoolDocs.reduce((s, sp) => s + (sp.cost ?? 0), 0);
    const activeSpools = spoolDocs.filter((s) => (s.remainingG ?? 0) > 0).length;
    const depletedSpools = spoolDocs.filter((s) => (s.remainingG ?? 0) === 0).length;

    // Print job metrics
    const totalPrintHours = jobDocs.reduce((s, j) => s + (j.totalHours ?? 0), 0);
    const totalPrintCost = jobDocs.reduce((s, j) => s + (j.cost ?? 0), 0);
    const totalJobs = jobDocs.length;
    const failedJobs = jobDocs.filter((j) => j.success === false).length;

    res.json({
      balanceSheet: {
        byType,
        totalAssets: sum("asset"),
        totalLiabilities: Math.abs(sum("liability")),
        totalEquity: Math.abs(sum("equity")),
      },
      profitLoss: {
        revenue,
        expensesByCategory,
        totalExpenses,
        netIncome: revenue - totalExpenses,
      },
      operations: {
        totalFilamentG,
        totalFilamentCost,
        activeSpools,
        depletedSpools,
        totalSpools: spoolDocs.length,
        totalPrintHours,
        totalPrintCost,
        totalJobs,
        failedJobs,
        scrapRate: totalJobs > 0 ? ((failedJobs / totalJobs) * 100).toFixed(1) : "0",
      },
    });
  });
}
