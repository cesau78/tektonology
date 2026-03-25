import type { Auditable } from "./auditable.js";

/**
 * A component used to assemble an inventory item.
 * References a specific print job and the part it produced.
 */
export interface InventoryComponent {
  printJobId: string;    // MongoDB _id of the PrintJob
  part: string;          // component part name
  quantity: number;
}

/**
 * Hardware used in assembling an inventory item.
 */
export interface InventoryHardware {
  hardwareId: number;    // references Hardware.hardwareId
  item: string;
  quantity: number;
}

/**
 * A finished-good available for projects or sale.
 * Assembled from components (across one or more print jobs)
 * and optionally hardware.
 *
 * MongoDB collection: inventory
 */
export interface Inventory extends Auditable {
  inventoryId: number;
  product: string;                    // e.g. "Compound Bonded Boot"
  effective: string;                  // ISO date — when assembly occurred
  components: InventoryComponent[];   // printed parts used in assembly
  hardware?: InventoryHardware[];     // optional fasteners, etc.
  quantity: number;                   // total assembled
  remaining: number;                  // available after project/sale consumption
}
