import { ObjectId } from "mongodb";
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
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await accounts.find(filter).sort({ number: 1 }).toArray();
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
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted account" });
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
    const existing = await accounts.findOne({ number: num });
    if (!existing) return res.status(404).json({ error: "Account not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Account already deleted" });
    const hasEntries = await journalEntries.findOne({ "lines.accountNumber": num, deletedAt: { $exists: false } });
    if (hasEntries) return res.status(409).json({ error: "Cannot delete account with journal entries" });
    await accounts.updateOne({ number: num }, { $set: { deletedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/finance/accounts/:number/permanent", write, async (req, res) => {
    const num = parseInt(req.params.number, 10);
    if (Number.isNaN(num)) return res.status(400).json({ error: "Invalid account number" });
    const existing = await accounts.findOne({ number: num });
    if (!existing) return res.status(404).json({ error: "Account not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Account must be soft-deleted first" });
    const hasEntries = await journalEntries.findOne({ "lines.accountNumber": num });
    if (hasEntries) return res.status(409).json({ error: "Cannot permanently delete account with journal entries" });
    await accounts.deleteOne({ number: num });
    res.json({ deleted: 1 });
  });

  app.post("/api/finance/accounts/:number/restore", write, async (req, res) => {
    const num = parseInt(req.params.number, 10);
    if (Number.isNaN(num)) return res.status(400).json({ error: "Invalid account number" });
    const existing = await accounts.findOne({ number: num });
    if (!existing) return res.status(404).json({ error: "Account not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Account is not deleted" });
    await accounts.updateOne({ number: num }, { $unset: { deletedAt: "" } });
    res.json({ restored: 1 });
  });

  // -- Journal Entries --
  app.get("/api/finance/journal", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await journalEntries.find(filter).sort({ date: 1, transactionId: 1 }).toArray();
    negotiate(req, res, docs, "journal.csv");
  });

  app.post("/api/finance/journal", write, async (req, res) => {
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

  app.put("/api/finance/journal/:transactionId", write, async (req, res) => {
    const txId = parseInt(req.params.transactionId, 10);
    if (Number.isNaN(txId)) return res.status(400).json({ error: "Invalid transaction ID" });

    const existing = await journalEntries.findOne({ transactionId: txId });
    if (!existing) return res.status(404).json({ error: "Transaction not found" });

    const update = req.body;
    if (!update.date || !update.lines || !Array.isArray(update.lines) || update.lines.length < 2) {
      return res.status(400).json({ error: "Entry must have date and at least 2 lines" });
    }

    const totalDebit = update.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = update.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      return res.status(400).json({ error: "Debits must equal credits" });
    }

    // Reverse old balance impacts
    for (const line of existing.lines) {
      const acct = await accounts.findOne({ number: line.accountNumber });
      if (!acct) continue;
      const creditNormal = ["liability", "equity", "revenue"].includes(acct.type);
      const dec = creditNormal
        ? (line.credit ?? 0) - (line.debit ?? 0)
        : (line.debit ?? 0) - (line.credit ?? 0);
      await accounts.updateOne(
        { number: line.accountNumber },
        { $inc: { balance: -dec } },
        { upsert: false }
      );
    }

    // Apply new balance impacts
    for (const line of update.lines) {
      const acct = await accounts.findOne({ number: line.accountNumber });
      if (!acct) continue;
      const creditNormal = ["liability", "equity", "revenue"].includes(acct.type);
      const inc = creditNormal
        ? (line.credit ?? 0) - (line.debit ?? 0)
        : (line.debit ?? 0) - (line.credit ?? 0);
      await accounts.updateOne(
        { number: line.accountNumber },
        { $inc: { balance: inc } },
        { upsert: false }
      );
    }

    await journalEntries.updateOne(
      { transactionId: txId },
      { $set: { date: update.date, description: update.description, lines: update.lines } }
    );

    const doc = await journalEntries.findOne({ transactionId: txId });
    res.json(doc);
  });

  app.delete("/api/finance/journal/:transactionId", write, async (req, res) => {
    const txId = parseInt(req.params.transactionId, 10);
    if (Number.isNaN(txId)) return res.status(400).json({ error: "Invalid transaction ID" });

    const existing = await journalEntries.findOne({ transactionId: txId });
    if (!existing) return res.status(404).json({ error: "Transaction not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Transaction already deleted" });

    // Reverse balance impacts
    for (const line of existing.lines) {
      const acct = await accounts.findOne({ number: line.accountNumber });
      if (!acct) continue;
      const creditNormal = ["liability", "equity", "revenue"].includes(acct.type);
      const dec = creditNormal
        ? (line.credit ?? 0) - (line.debit ?? 0)
        : (line.debit ?? 0) - (line.credit ?? 0);
      await accounts.updateOne(
        { number: line.accountNumber },
        { $inc: { balance: -dec } },
        { upsert: false }
      );
    }

    await journalEntries.updateOne(
      { transactionId: txId },
      { $set: { deletedAt: new Date().toISOString() } }
    );
    res.json({ deleted: 1 });
  });

  app.delete("/api/finance/journal/:transactionId/permanent", write, async (req, res) => {
    const txId = parseInt(req.params.transactionId, 10);
    if (Number.isNaN(txId)) return res.status(400).json({ error: "Invalid transaction ID" });

    const existing = await journalEntries.findOne({ transactionId: txId });
    if (!existing) return res.status(404).json({ error: "Transaction not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Transaction must be soft-deleted first" });

    await journalEntries.deleteOne({ transactionId: txId });
    res.json({ deleted: 1 });
  });

  app.post("/api/finance/journal/:transactionId/restore", write, async (req, res) => {
    const txId = parseInt(req.params.transactionId, 10);
    if (Number.isNaN(txId)) return res.status(400).json({ error: "Invalid transaction ID" });

    const existing = await journalEntries.findOne({ transactionId: txId });
    if (!existing) return res.status(404).json({ error: "Transaction not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Transaction is not deleted" });

    // Re-apply balance impacts
    for (const line of existing.lines) {
      const acct = await accounts.findOne({ number: line.accountNumber });
      if (!acct) continue;
      const creditNormal = ["liability", "equity", "revenue"].includes(acct.type);
      const inc = creditNormal
        ? (line.credit ?? 0) - (line.debit ?? 0)
        : (line.debit ?? 0) - (line.credit ?? 0);
      await accounts.updateOne(
        { number: line.accountNumber },
        { $inc: { balance: inc } },
        { upsert: false }
      );
    }

    await journalEntries.updateOne(
      { transactionId: txId },
      { $unset: { deletedAt: "" } }
    );
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Procurement
  // =========================================================================

  // -- Spools --
  app.get("/api/procurement/spools", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await spools.find(filter).sort({ spoolId: 1 }).toArray();
    negotiate(req, res, docs, "spools.csv");
  });

  app.get("/api/procurement/spools/:spoolId", read, async (req, res) => {
    const id = parseInt(req.params.spoolId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid spool ID" });
    const doc = await spools.findOne({ spoolId: id });
    if (!doc) return res.status(404).json({ error: "Spool not found" });
    res.json(doc);
  });

  app.post("/api/procurement/spools", write, async (req, res) => {
    const docs = req.headers["content-type"] === "text/csv" ? parseCsv(req.body) : req.body;
    const items = Array.isArray(docs) ? docs : [docs];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const result = await spools.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/procurement/spools/:spoolId", write, async (req, res) => {
    const id = parseInt(req.params.spoolId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid spool ID" });
    const existing = await spools.findOne({ spoolId: id });
    if (!existing) return res.status(404).json({ error: "Spool not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted spool" });
    const update = { ...req.body };
    delete update._id;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });
    await spools.updateOne({ spoolId: id }, { $set: update });
    const doc = await spools.findOne({ spoolId: id });
    res.json(doc);
  });

  app.delete("/api/procurement/spools/:spoolId", write, async (req, res) => {
    const id = parseInt(req.params.spoolId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid spool ID" });
    const existing = await spools.findOne({ spoolId: id });
    if (!existing) return res.status(404).json({ error: "Spool not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Spool already deleted" });
    await spools.updateOne({ spoolId: id }, { $set: { deletedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/procurement/spools/:spoolId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.spoolId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid spool ID" });
    const existing = await spools.findOne({ spoolId: id });
    if (!existing) return res.status(404).json({ error: "Spool not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Spool must be soft-deleted first" });
    await spools.deleteOne({ spoolId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/procurement/spools/:spoolId/restore", write, async (req, res) => {
    const id = parseInt(req.params.spoolId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid spool ID" });
    const existing = await spools.findOne({ spoolId: id });
    if (!existing) return res.status(404).json({ error: "Spool not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Spool is not deleted" });
    await spools.updateOne({ spoolId: id }, { $unset: { deletedAt: "" } });
    res.json({ restored: 1 });
  });

  // -- Hardware --
  app.get("/api/procurement/hardware", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await hardware.find(filter).sort({ hardwareId: 1 }).toArray();
    negotiate(req, res, docs, "hardware.csv");
  });

  app.get("/api/procurement/hardware/:hardwareId", read, async (req, res) => {
    const id = parseInt(req.params.hardwareId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid hardware ID" });
    const doc = await hardware.findOne({ hardwareId: id });
    if (!doc) return res.status(404).json({ error: "Hardware not found" });
    res.json(doc);
  });

  app.post("/api/procurement/hardware", write, async (req, res) => {
    const docs = req.headers["content-type"] === "text/csv" ? parseCsv(req.body) : req.body;
    const items = Array.isArray(docs) ? docs : [docs];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const result = await hardware.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/procurement/hardware/:hardwareId", write, async (req, res) => {
    const id = parseInt(req.params.hardwareId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid hardware ID" });
    const existing = await hardware.findOne({ hardwareId: id });
    if (!existing) return res.status(404).json({ error: "Hardware not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted hardware" });
    const update = { ...req.body };
    delete update._id;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });
    await hardware.updateOne({ hardwareId: id }, { $set: update });
    const doc = await hardware.findOne({ hardwareId: id });
    res.json(doc);
  });

  app.delete("/api/procurement/hardware/:hardwareId", write, async (req, res) => {
    const id = parseInt(req.params.hardwareId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid hardware ID" });
    const existing = await hardware.findOne({ hardwareId: id });
    if (!existing) return res.status(404).json({ error: "Hardware not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Hardware already deleted" });
    await hardware.updateOne({ hardwareId: id }, { $set: { deletedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/procurement/hardware/:hardwareId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.hardwareId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid hardware ID" });
    const existing = await hardware.findOne({ hardwareId: id });
    if (!existing) return res.status(404).json({ error: "Hardware not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Hardware must be soft-deleted first" });
    await hardware.deleteOne({ hardwareId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/procurement/hardware/:hardwareId/restore", write, async (req, res) => {
    const id = parseInt(req.params.hardwareId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid hardware ID" });
    const existing = await hardware.findOne({ hardwareId: id });
    if (!existing) return res.status(404).json({ error: "Hardware not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Hardware is not deleted" });
    await hardware.updateOne({ hardwareId: id }, { $unset: { deletedAt: "" } });
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Manufacturing
  // =========================================================================

  // -- Print Jobs --
  app.get("/api/manufacturing/print-jobs", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await printJobs.find(filter).sort({ date: -1, batchId: -1 }).toArray();
    negotiate(req, res, docs, "print-jobs.csv");
  });

  app.get("/api/manufacturing/print-jobs/:id", read, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid print job ID" });
    const doc = await printJobs.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: "Print job not found" });
    res.json(doc);
  });

  app.post("/api/manufacturing/print-jobs", write, async (req, res) => {
    const docs = req.headers["content-type"] === "text/csv" ? parseCsv(req.body) : req.body;
    const items = Array.isArray(docs) ? docs : [docs];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const result = await printJobs.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/manufacturing/print-jobs/:id", write, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid print job ID" });
    const oid = new ObjectId(req.params.id);
    const existing = await printJobs.findOne({ _id: oid });
    if (!existing) return res.status(404).json({ error: "Print job not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted print job" });
    const update = { ...req.body };
    delete update._id;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });
    await printJobs.updateOne({ _id: oid }, { $set: update });
    const doc = await printJobs.findOne({ _id: oid });
    res.json(doc);
  });

  app.delete("/api/manufacturing/print-jobs/:id", write, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid print job ID" });
    const existing = await printJobs.findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).json({ error: "Print job not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Print job already deleted" });
    await printJobs.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { deletedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/manufacturing/print-jobs/:id/permanent", write, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid print job ID" });
    const existing = await printJobs.findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).json({ error: "Print job not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Print job must be soft-deleted first" });
    await printJobs.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ deleted: 1 });
  });

  app.post("/api/manufacturing/print-jobs/:id/restore", write, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid print job ID" });
    const existing = await printJobs.findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).json({ error: "Print job not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Print job is not deleted" });
    await printJobs.updateOne({ _id: new ObjectId(req.params.id) }, { $unset: { deletedAt: "" } });
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Dashboard (aggregation — JSON only)
  // =========================================================================

  app.get("/api/dashboard", read, async (_req, res) => {
    const active = { deletedAt: { $exists: false } };
    const [accts, entries, spoolDocs, jobDocs] = await Promise.all([
      accounts.find(active).toArray(),
      journalEntries.find(active).toArray(),
      spools.find(active).toArray(),
      printJobs.find(active).toArray(),
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
