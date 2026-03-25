import type { Auditable } from "./auditable.js";

/**
 * Print job outcome — determines how cost is classified and
 * whether components flow into inventory.
 *
 *   production — components become inventory (sellable / project-ready)
 *   prototype  — test fits, new ideas; never sold, expensed as R&D
 *   tooling    — shop tools; capitalized or expensed, not sold
 *   failed     — material + time loss; components[] empty, expensed
 */
export type PrintJobOutcome = "production" | "prototype" | "tooling" | "failed";

/**
 * A component produced by a print job.
 */
export interface Component {
  part: string;       // e.g. "Insert", "Bushing", "Cap, Slipper"
  quantity: number;
}

/**
 * A print job has a two-phase lifecycle:
 *
 * Phase 1 — written by printing-agent on print completion:
 *   project, spoolId, usageG, date, outcome, components, processed: false
 *
 * Phase 2 — enriched by accounting-agent:
 *   cost, processedAt, processed: true
 *
 * Only "production" jobs feed components into Inventory.
 */
export interface PrintJob extends Auditable {
  project: string;
  outcome: PrintJobOutcome;
  printerId: number;     // references Printer.printerId
  nozzleId: number;      // references Nozzle.nozzleId
  plateId: number;       // references Plate.plateId
  spoolId: number;       // references Spool.spoolId
  usageG: number;
  hours: number;         // print duration in hours
  components: Component[]; // parts produced (empty on failure)
  effective: string;      // ISO date — when the print occurred

  processed: boolean;

  // Set by accounting-agent after processing:
  cost?: number;         // usageG × (spool.cost / spool.weightG)
  processedAt?: string;  // ISO 8601
}
