import type { Auditable } from "./auditable.js";

export interface Spool extends Auditable {
  spoolId: number;
  brand: string;
  material: string;
  color: string;
  effective: string; // ISO date — when the purchase occurred
  cost: number;      // fully-loaded cost (base + tax + shipping)
  weightG: number;   // starting weight in grams
  remainingG: number;
  journalId?: number;  // references JournalEntry.transactionId
}
