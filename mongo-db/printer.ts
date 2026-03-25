import type { Auditable } from "./auditable.js";

/**
 * A 3D printer — tracks purchase cost and cumulative machine hours.
 *
 * MongoDB collection: printers
 */
export interface Printer extends Auditable {
  printerId: number;
  brand: string;
  name: string;         // e.g. "A1 Lab - Zigbu"
  effective: string;    // ISO date — when the purchase occurred
  baseCost: number;
  taxes: number;
  shipping: number;
  cost: number;         // fully-loaded cost (base + tax + shipping)
  hoursUsed: number;    // cumulative machine hours
  journalId?: number;   // references JournalEntry.transactionId
}
