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
  const products = db.collection("products");
  const projects = db.collection("projects");
  const sales = db.collection("sales");
  const printers = db.collection("printers");
  const nozzles = db.collection("nozzles");
  const plates = db.collection("plates");
  const inventory = db.collection("inventory");
  const componentStock = db.collection("component_stock");

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
  // Procurement — Printers
  // =========================================================================

  app.get("/api/procurement/printers", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await printers.find(filter).sort({ printerId: 1 }).toArray();
    negotiate(req, res, docs, "printers.csv");
  });

  app.get("/api/procurement/printers/:printerId", read, async (req, res) => {
    const id = parseInt(req.params.printerId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid printer ID" });
    const doc = await printers.findOne({ printerId: id });
    if (!doc) return res.status(404).json({ error: "Printer not found" });
    res.json(doc);
  });

  app.post("/api/procurement/printers", write, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const now = new Date().toISOString();
    for (const item of items) { item.createdAt ??= now; item.updatedAt ??= now; }
    const result = await printers.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/procurement/printers/:printerId", write, async (req, res) => {
    const id = parseInt(req.params.printerId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid printer ID" });
    const existing = await printers.findOne({ printerId: id });
    if (!existing) return res.status(404).json({ error: "Printer not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted printer" });
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    await printers.updateOne({ printerId: id }, { $set: update });
    const doc = await printers.findOne({ printerId: id });
    res.json(doc);
  });

  app.delete("/api/procurement/printers/:printerId", write, async (req, res) => {
    const id = parseInt(req.params.printerId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid printer ID" });
    const existing = await printers.findOne({ printerId: id });
    if (!existing) return res.status(404).json({ error: "Printer not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Printer already deleted" });
    await printers.updateOne({ printerId: id }, { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/procurement/printers/:printerId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.printerId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid printer ID" });
    const existing = await printers.findOne({ printerId: id });
    if (!existing) return res.status(404).json({ error: "Printer not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Printer must be soft-deleted first" });
    await printers.deleteOne({ printerId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/procurement/printers/:printerId/restore", write, async (req, res) => {
    const id = parseInt(req.params.printerId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid printer ID" });
    const existing = await printers.findOne({ printerId: id });
    if (!existing) return res.status(404).json({ error: "Printer not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Printer is not deleted" });
    await printers.updateOne({ printerId: id }, { $unset: { deletedAt: "" }, $set: { updatedAt: new Date().toISOString() } });
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Procurement — Nozzles
  // =========================================================================

  app.get("/api/procurement/nozzles", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await nozzles.find(filter).sort({ nozzleId: 1 }).toArray();
    negotiate(req, res, docs, "nozzles.csv");
  });

  app.get("/api/procurement/nozzles/:nozzleId", read, async (req, res) => {
    const id = parseInt(req.params.nozzleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid nozzle ID" });
    const doc = await nozzles.findOne({ nozzleId: id });
    if (!doc) return res.status(404).json({ error: "Nozzle not found" });
    res.json(doc);
  });

  app.post("/api/procurement/nozzles", write, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const now = new Date().toISOString();
    for (const item of items) { item.createdAt ??= now; item.updatedAt ??= now; }
    const result = await nozzles.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/procurement/nozzles/:nozzleId", write, async (req, res) => {
    const id = parseInt(req.params.nozzleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid nozzle ID" });
    const existing = await nozzles.findOne({ nozzleId: id });
    if (!existing) return res.status(404).json({ error: "Nozzle not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted nozzle" });
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    await nozzles.updateOne({ nozzleId: id }, { $set: update });
    const doc = await nozzles.findOne({ nozzleId: id });
    res.json(doc);
  });

  app.delete("/api/procurement/nozzles/:nozzleId", write, async (req, res) => {
    const id = parseInt(req.params.nozzleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid nozzle ID" });
    const existing = await nozzles.findOne({ nozzleId: id });
    if (!existing) return res.status(404).json({ error: "Nozzle not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Nozzle already deleted" });
    await nozzles.updateOne({ nozzleId: id }, { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/procurement/nozzles/:nozzleId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.nozzleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid nozzle ID" });
    const existing = await nozzles.findOne({ nozzleId: id });
    if (!existing) return res.status(404).json({ error: "Nozzle not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Nozzle must be soft-deleted first" });
    await nozzles.deleteOne({ nozzleId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/procurement/nozzles/:nozzleId/restore", write, async (req, res) => {
    const id = parseInt(req.params.nozzleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid nozzle ID" });
    const existing = await nozzles.findOne({ nozzleId: id });
    if (!existing) return res.status(404).json({ error: "Nozzle not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Nozzle is not deleted" });
    await nozzles.updateOne({ nozzleId: id }, { $unset: { deletedAt: "" }, $set: { updatedAt: new Date().toISOString() } });
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Procurement — Plates
  // =========================================================================

  app.get("/api/procurement/plates", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await plates.find(filter).sort({ plateId: 1 }).toArray();
    negotiate(req, res, docs, "plates.csv");
  });

  app.get("/api/procurement/plates/:plateId", read, async (req, res) => {
    const id = parseInt(req.params.plateId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid plate ID" });
    const doc = await plates.findOne({ plateId: id });
    if (!doc) return res.status(404).json({ error: "Plate not found" });
    res.json(doc);
  });

  app.post("/api/procurement/plates", write, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const now = new Date().toISOString();
    for (const item of items) { item.createdAt ??= now; item.updatedAt ??= now; }
    const result = await plates.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/procurement/plates/:plateId", write, async (req, res) => {
    const id = parseInt(req.params.plateId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid plate ID" });
    const existing = await plates.findOne({ plateId: id });
    if (!existing) return res.status(404).json({ error: "Plate not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted plate" });
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    await plates.updateOne({ plateId: id }, { $set: update });
    const doc = await plates.findOne({ plateId: id });
    res.json(doc);
  });

  app.delete("/api/procurement/plates/:plateId", write, async (req, res) => {
    const id = parseInt(req.params.plateId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid plate ID" });
    const existing = await plates.findOne({ plateId: id });
    if (!existing) return res.status(404).json({ error: "Plate not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Plate already deleted" });
    await plates.updateOne({ plateId: id }, { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/procurement/plates/:plateId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.plateId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid plate ID" });
    const existing = await plates.findOne({ plateId: id });
    if (!existing) return res.status(404).json({ error: "Plate not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Plate must be soft-deleted first" });
    await plates.deleteOne({ plateId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/procurement/plates/:plateId/restore", write, async (req, res) => {
    const id = parseInt(req.params.plateId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid plate ID" });
    const existing = await plates.findOne({ plateId: id });
    if (!existing) return res.status(404).json({ error: "Plate not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Plate is not deleted" });
    await plates.updateOne({ plateId: id }, { $unset: { deletedAt: "" }, $set: { updatedAt: new Date().toISOString() } });
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Products (catalog — MongoDB-backed)
  // =========================================================================

  app.get("/api/products", async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await products.find(filter).sort({ name: 1 }).toArray();
    res.json(docs);
  });

  app.get("/api/products/:productId", async (req, res) => {
    const id = parseInt(req.params.productId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });
    const doc = await products.findOne({ productId: id });
    if (!doc) return res.status(404).json({ error: "Product not found" });
    res.json(doc);
  });

  app.post("/api/products", write, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const now = new Date().toISOString();
    for (const item of items) { item.createdAt ??= now; item.updatedAt ??= now; }
    const result = await products.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/products/:productId", write, async (req, res) => {
    const id = parseInt(req.params.productId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });
    const existing = await products.findOne({ productId: id });
    if (!existing) return res.status(404).json({ error: "Product not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted product" });
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    await products.updateOne({ productId: id }, { $set: update });
    const doc = await products.findOne({ productId: id });
    res.json(doc);
  });

  app.delete("/api/products/:productId", write, async (req, res) => {
    const id = parseInt(req.params.productId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });
    const existing = await products.findOne({ productId: id });
    if (!existing) return res.status(404).json({ error: "Product not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Product already deleted" });
    await products.updateOne({ productId: id }, { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/products/:productId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.productId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });
    const existing = await products.findOne({ productId: id });
    if (!existing) return res.status(404).json({ error: "Product not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Product must be soft-deleted first" });
    await products.deleteOne({ productId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/products/:productId/restore", write, async (req, res) => {
    const id = parseInt(req.params.productId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });
    const existing = await products.findOne({ productId: id });
    if (!existing) return res.status(404).json({ error: "Product not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Product is not deleted" });
    await products.updateOne({ productId: id }, { $unset: { deletedAt: "" }, $set: { updatedAt: new Date().toISOString() } });
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Projects (MongoDB-backed)
  // =========================================================================

  app.get("/api/projects", async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await projects.find(filter).sort({ name: 1 }).toArray();
    res.json(docs);
  });

  app.get("/api/projects/:projectId", async (req, res) => {
    const id = parseInt(req.params.projectId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid project ID" });
    const doc = await projects.findOne({ projectId: id });
    if (!doc) return res.status(404).json({ error: "Project not found" });
    res.json(doc);
  });

  app.post("/api/projects", write, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const now = new Date().toISOString();
    for (const item of items) { item.createdAt ??= now; item.updatedAt ??= now; }
    const result = await projects.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/projects/:projectId", write, async (req, res) => {
    const id = parseInt(req.params.projectId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid project ID" });
    const existing = await projects.findOne({ projectId: id });
    if (!existing) return res.status(404).json({ error: "Project not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted project" });
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    await projects.updateOne({ projectId: id }, { $set: update });
    const doc = await projects.findOne({ projectId: id });
    res.json(doc);
  });

  app.delete("/api/projects/:projectId", write, async (req, res) => {
    const id = parseInt(req.params.projectId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid project ID" });
    const existing = await projects.findOne({ projectId: id });
    if (!existing) return res.status(404).json({ error: "Project not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Project already deleted" });
    await projects.updateOne({ projectId: id }, { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/projects/:projectId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.projectId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid project ID" });
    const existing = await projects.findOne({ projectId: id });
    if (!existing) return res.status(404).json({ error: "Project not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Project must be soft-deleted first" });
    await projects.deleteOne({ projectId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/projects/:projectId/restore", write, async (req, res) => {
    const id = parseInt(req.params.projectId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid project ID" });
    const existing = await projects.findOne({ projectId: id });
    if (!existing) return res.status(404).json({ error: "Project not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Project is not deleted" });
    await projects.updateOne({ projectId: id }, { $unset: { deletedAt: "" }, $set: { updatedAt: new Date().toISOString() } });
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Sales
  // =========================================================================

  app.get("/api/sales", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await sales.find(filter).sort({ effective: -1 }).toArray();
    negotiate(req, res, docs, "sales.csv");
  });

  app.get("/api/sales/:saleId", read, async (req, res) => {
    const id = parseInt(req.params.saleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid sale ID" });
    const doc = await sales.findOne({ saleId: id });
    if (!doc) return res.status(404).json({ error: "Sale not found" });
    res.json(doc);
  });

  app.post("/api/sales", write, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const now = new Date().toISOString();
    for (const item of items) { item.createdAt ??= now; item.updatedAt ??= now; }
    const result = await sales.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/sales/:saleId", write, async (req, res) => {
    const id = parseInt(req.params.saleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid sale ID" });
    const existing = await sales.findOne({ saleId: id });
    if (!existing) return res.status(404).json({ error: "Sale not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted sale" });
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    await sales.updateOne({ saleId: id }, { $set: update });
    const doc = await sales.findOne({ saleId: id });
    res.json(doc);
  });

  app.delete("/api/sales/:saleId", write, async (req, res) => {
    const id = parseInt(req.params.saleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid sale ID" });
    const existing = await sales.findOne({ saleId: id });
    if (!existing) return res.status(404).json({ error: "Sale not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Sale already deleted" });
    await sales.updateOne({ saleId: id }, { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/sales/:saleId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.saleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid sale ID" });
    const existing = await sales.findOne({ saleId: id });
    if (!existing) return res.status(404).json({ error: "Sale not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Sale must be soft-deleted first" });
    await sales.deleteOne({ saleId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/sales/:saleId/restore", write, async (req, res) => {
    const id = parseInt(req.params.saleId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid sale ID" });
    const existing = await sales.findOne({ saleId: id });
    if (!existing) return res.status(404).json({ error: "Sale not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Sale is not deleted" });
    await sales.updateOne({ saleId: id }, { $unset: { deletedAt: "" }, $set: { updatedAt: new Date().toISOString() } });
    res.json({ restored: 1 });
  });

  // =========================================================================
  // Inventory
  // =========================================================================

  app.get("/api/inventory", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await inventory.find(filter).sort({ inventoryId: 1 }).toArray();
    negotiate(req, res, docs, "inventory.csv");
  });

  app.get("/api/inventory/:inventoryId", read, async (req, res) => {
    const id = parseInt(req.params.inventoryId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid inventory ID" });
    const doc = await inventory.findOne({ inventoryId: id });
    if (!doc) return res.status(404).json({ error: "Inventory item not found" });
    res.json(doc);
  });

  app.post("/api/inventory", write, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const now = new Date().toISOString();
    for (const item of items) { item.createdAt ??= now; item.updatedAt ??= now; }
    const result = await inventory.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/inventory/:inventoryId", write, async (req, res) => {
    const id = parseInt(req.params.inventoryId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid inventory ID" });
    const existing = await inventory.findOne({ inventoryId: id });
    if (!existing) return res.status(404).json({ error: "Inventory item not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted inventory item" });
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    await inventory.updateOne({ inventoryId: id }, { $set: update });
    const doc = await inventory.findOne({ inventoryId: id });
    res.json(doc);
  });

  app.delete("/api/inventory/:inventoryId", write, async (req, res) => {
    const id = parseInt(req.params.inventoryId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid inventory ID" });
    const existing = await inventory.findOne({ inventoryId: id });
    if (!existing) return res.status(404).json({ error: "Inventory item not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Inventory item already deleted" });
    await inventory.updateOne({ inventoryId: id }, { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/inventory/:inventoryId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.inventoryId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid inventory ID" });
    const existing = await inventory.findOne({ inventoryId: id });
    if (!existing) return res.status(404).json({ error: "Inventory item not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Inventory item must be soft-deleted first" });
    await inventory.deleteOne({ inventoryId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/inventory/:inventoryId/restore", write, async (req, res) => {
    const id = parseInt(req.params.inventoryId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid inventory ID" });
    const existing = await inventory.findOne({ inventoryId: id });
    if (!existing) return res.status(404).json({ error: "Inventory item not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Inventory item is not deleted" });
    await inventory.updateOne({ inventoryId: id }, { $unset: { deletedAt: "" }, $set: { updatedAt: new Date().toISOString() } });
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

  // =========================================================================
  // Manufacturing — Component Stock
  // =========================================================================

  app.get("/api/manufacturing/components", read, async (req, res) => {
    const filter = req.query.includeDeleted === "true" ? {} : { deletedAt: { $exists: false } };
    const docs = await componentStock.find(filter).sort({ batchId: 1 }).toArray();
    negotiate(req, res, docs, "component-stock.csv");
  });

  app.get("/api/manufacturing/components/:batchId", read, async (req, res) => {
    const id = parseInt(req.params.batchId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid batch ID" });
    const doc = await componentStock.findOne({ batchId: id });
    if (!doc) return res.status(404).json({ error: "Component batch not found" });
    res.json(doc);
  });

  app.post("/api/manufacturing/components", write, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(400).json({ error: "No records provided" });
    const now = new Date().toISOString();
    for (const item of items) { item.createdAt ??= now; item.updatedAt ??= now; }
    const result = await componentStock.insertMany(items);
    res.status(201).json({ inserted: result.insertedCount });
  });

  app.put("/api/manufacturing/components/:batchId", write, async (req, res) => {
    const id = parseInt(req.params.batchId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid batch ID" });
    const existing = await componentStock.findOne({ batchId: id });
    if (!existing) return res.status(404).json({ error: "Component batch not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Cannot edit deleted batch" });
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    await componentStock.updateOne({ batchId: id }, { $set: update });
    const doc = await componentStock.findOne({ batchId: id });
    res.json(doc);
  });

  app.delete("/api/manufacturing/components/:batchId", write, async (req, res) => {
    const id = parseInt(req.params.batchId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid batch ID" });
    const existing = await componentStock.findOne({ batchId: id });
    if (!existing) return res.status(404).json({ error: "Component batch not found" });
    if (existing.deletedAt) return res.status(409).json({ error: "Batch already deleted" });
    await componentStock.updateOne({ batchId: id }, { $set: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    res.json({ deleted: 1 });
  });

  app.delete("/api/manufacturing/components/:batchId/permanent", write, async (req, res) => {
    const id = parseInt(req.params.batchId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid batch ID" });
    const existing = await componentStock.findOne({ batchId: id });
    if (!existing) return res.status(404).json({ error: "Component batch not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Batch must be soft-deleted first" });
    await componentStock.deleteOne({ batchId: id });
    res.json({ deleted: 1 });
  });

  app.post("/api/manufacturing/components/:batchId/restore", write, async (req, res) => {
    const id = parseInt(req.params.batchId, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid batch ID" });
    const existing = await componentStock.findOne({ batchId: id });
    if (!existing) return res.status(404).json({ error: "Component batch not found" });
    if (!existing.deletedAt) return res.status(409).json({ error: "Batch is not deleted" });
    await componentStock.updateOne({ batchId: id }, { $unset: { deletedAt: "" }, $set: { updatedAt: new Date().toISOString() } });
    const doc = await componentStock.findOne({ batchId: id });
    res.json(doc);
  });
}
