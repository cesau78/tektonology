export interface Spool {
  spoolId: number;
  brand: string;
  material: string;
  color: string;
  purchased: string; // ISO date: YYYY-MM-DD
  cost: number;      // fully-loaded cost (base + tax + shipping)
  weightG: number;   // starting weight in grams
  remainingG: number;
  deletedAt?: string; // ISO 8601 — set on soft delete
}
