/**
 * A print job has a two-phase lifecycle:
 *
 * Phase 1 — written by printing-agent on print completion:
 *   project, spoolId, usageG, loggedAt, processed: false
 *
 * Phase 2 — enriched by bookkeeping-agent:
 *   cost, processedAt, processed: true
 */
export interface PrintJob {
  project: string;
  spoolId: number;
  usageG: number;
  loggedAt: string;    // ISO 8601 — set by printing-agent

  processed: boolean;

  // Set by bookkeeping-agent after processing:
  cost?: number;       // usageG × (spool.cost / spool.weightG)
  processedAt?: string; // ISO 8601
  deletedAt?: string;   // ISO 8601 — set on soft delete
}
