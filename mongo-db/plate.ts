import type { Auditable } from "./auditable.js";

/**
 * A build plate — tracks purchase cost and cumulative usage hours.
 *
 * MongoDB collection: plates
 */
export interface Plate extends Auditable {
  plateId: number;
  brand: string;
  plate: string;        // e.g. "Textured PEI", "Cool Plate Supertrack", "Engineering"
  effective: string;    // ISO date — when the purchase occurred
  baseCost: number;
  taxes: number;
  shipping: number;
  cost: number;         // fully-loaded cost (base + tax + shipping)
  hoursUsed: number;    // cumulative print hours on this plate
  journalId?: number;   // references JournalEntry.transactionId
}
