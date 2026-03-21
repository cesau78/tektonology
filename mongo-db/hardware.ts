/**
 * A hardware inventory item (bolts, nuts, wrenches, etc.).
 *
 * MongoDB collection: hardware
 */
export interface Hardware {
  hardwareId: number;
  supplier: string;
  supplierId: string | null;
  item: string;
  dimensions: string;
  material: string;
  purchased: string; // ISO date: YYYY-MM-DD
  baseCost: number;
  taxes: number;
  shipping: number;
  cost: number;      // fully-loaded cost (base + tax + shipping)
  quantity: number;
  remaining: number;
  deletedAt?: string; // ISO 8601 — set on soft delete
}
