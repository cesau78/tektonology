import type { Auditable } from "./auditable.js";

/**
 * Whether the design is original or sourced from a third party.
 */
export type ProductOrigin = "original" | "third-party";

/**
 * An STL file associated with a product version.
 */
export interface ProductStl {
  label: string;        // e.g. "Boot Cap (PLA)"
  url: string;          // path to STL file
  color?: string;       // hex color for rendering
}

/**
 * A published version of a product design.
 * Published versions must have a GitHub commit.
 */
export interface ProductVersion {
  version: string;         // semver — e.g. "1.0.0"
  commit: string;          // GitHub commit hash
  effective: string;        // ISO date — when this version was released
  scadUrl?: string;        // path to OpenSCAD source (original designs only)
  stls: ProductStl[];      // STL files for this version
  changelog?: string;      // what changed in this version
}

/**
 * A product design — the catalog entity that feeds the website
 * and links to print jobs via components.
 *
 * MongoDB collection: products
 */
export interface Product extends Auditable {
  productId: number;
  name: string;            // e.g. "Kneeler Boot - Compound Fastened"
  category: string;        // e.g. "Kneeler Replacement Parts", "Tools"
  description: string;
  origin: ProductOrigin;
  sourceUrl?: string;      // URL to third-party STL or repo
  effective: string;       // ISO date — when the product was first created
  printSettings: Record<string, string>; // camelCase keys, display-ready values
  assemblyGuide?: string[];
  versions: ProductVersion[];
}
