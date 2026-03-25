import type { Auditable } from "./auditable.js";

/**
 * A hardware inventory item (bolts, nuts, wrenches, etc.).
 *
 * MongoDB collection: hardware
 */
export interface Hardware extends Auditable {
  hardwareId: number;
  supplier: string;
  supplierId: string | null;
  item: string;
  dimensions: string;
  material: string;
  effective: string; // ISO date — when the purchase occurred
  baseCost: number;
  taxes: number;
  shipping: number;
  cost: number;      // fully-loaded cost (base + tax + shipping)
  quantity: number;
  remaining: number;
  journalId?: number;  // references JournalEntry.transactionId
}
