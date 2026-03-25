import type { Auditable } from "./auditable.js";

/**
 * An inventory item consumed by a project.
 */
export interface ProjectItem {
  inventoryId: number;   // references Inventory.inventoryId
  product: string;
  quantity: number;
}

/**
 * A custom-ordered batch or restoration project.
 * Consumes inventory items. May be pro-bono (e.g. Saint Stanislaus).
 *
 * MongoDB collection: projects
 */
export interface Project extends Auditable {
  projectId: number;
  name: string;          // e.g. "Saint Stanislaus Kneeler Restoration"
  client?: string;
  proBono: boolean;
  effective: string;     // ISO date — when the project started
  status: "active" | "completed" | "cancelled";
  items: ProjectItem[];
  journalId?: number;    // references JournalEntry.transactionId
}
