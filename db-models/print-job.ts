export interface PrintJob {
  project: string;
  spoolId: number;
  usageG: number;
  cost: number;      // computed server-side: usageG × (spool.cost / spool.weightG)
  loggedAt: string;  // ISO 8601
}

export interface PrintJobRequest {
  project: string;
  spoolId: number;
  usageG: number;
  loggedAt: string;
}
