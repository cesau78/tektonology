import type { Auditable } from "./auditable.js";

/**
 * A printer nozzle — tracks purchase cost and cumulative usage hours.
 *
 * MongoDB collection: nozzles
 */
export interface Nozzle extends Auditable {
  nozzleId: number;
  brand: string;
  nozzle: string;       // e.g. "0.4mm Stainless", "0.6mm Hardened"
  effective: string;    // ISO date — when the purchase occurred
  baseCost: number;
  taxes: number;
  shipping: number;
  cost: number;         // fully-loaded cost (base + tax + shipping)
  hoursUsed: number;    // cumulative print hours on this nozzle
  journalId?: number;   // references JournalEntry.transactionId
}
