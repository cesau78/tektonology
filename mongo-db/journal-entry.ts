import type { Auditable } from "./auditable.js";

/**
 * A single debit or credit line within a journal entry.
 * Exactly one of debit/credit is non-null per line (double-entry rule).
 */
export interface JournalLine {
  accountNumber: number; // references Account.number
  accountName: string;
  debit: number | null;
  credit: number | null;
}

/**
 * One balanced transaction in the general ledger.
 * Lines are embedded — they're always read and written together.
 *
 * MongoDB collection: journal_entries
 */
export interface JournalEntry extends Auditable {
  transactionId: number;
  effective: string;    // ISO date — when the transaction occurred
  description: string;
  lines: JournalLine[];
}
