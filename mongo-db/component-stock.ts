import type { Auditable } from "./auditable.js";

/**
 * A batch of printed components on hand, ready for assembly into inventory.
 * Produced by one or more print jobs; consumed when assembled into Inventory.
 *
 * MongoDB collection: component_stock
 */
export interface ComponentStock extends Auditable {
  batchId: number;
  printJobId?: string;  // MongoDB _id of the originating PrintJob (if linked)
  part: string;         // e.g. "Insert", "Cap, Slipper", "Spacer"
  effective: string;    // ISO date — when the batch was produced
  quantity: number;     // total pieces produced in this batch
  remaining: number;    // pieces still available (decremented on assembly)
}
