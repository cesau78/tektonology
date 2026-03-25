/**
 * Audit stamps for all collection-level documents.
 * Every entity that lives in its own MongoDB collection should extend this.
 */
export interface Auditable {
  createdAt: string;     // ISO 8601 — when the record was entered into the system
  updatedAt: string;     // ISO 8601 — last modification
  deletedAt?: string;    // ISO 8601 — soft delete
}
