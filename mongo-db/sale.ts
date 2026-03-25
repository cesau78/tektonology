import type { Auditable } from "./auditable.js";

/**
 * A line item within a sale.
 */
export interface SaleItem {
  inventoryId: number;   // references Inventory.inventoryId
  product: string;
  quantity: number;
  unitPrice: number;
  amount: number;        // quantity × unitPrice
}

/**
 * A sale of inventory items — generates revenue and recognizes COGS.
 *
 * MongoDB collection: sales
 */
export interface Sale extends Auditable {
  saleId: number;
  effective: string;     // ISO date — when the sale occurred
  customer: string;
  items: SaleItem[];
  revenue: number;       // sum of item amounts
  journalId?: number;    // references JournalEntry.transactionId
}
