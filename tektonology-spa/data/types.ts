export type PrintSettings = Record<string, string>;

export interface DownloadLink {
  label: string;
  url: string;
  color?: string;
  rotation?: [number, number, number];
}

export interface PurchaseLink {
  label: string;
  url: string;
}

export interface AssemblyPart {
  url: string;
  color?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export interface AssemblyView {
  label: string;
  parts: AssemblyPart[];
  rotation?: [number, number, number];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  printSettings: PrintSettings;
  assemblyGuide: string[];
  stlDownloadUrls: DownloadLink[];
  purchaseLinks: PurchaseLink[];
  assemblyView?: AssemblyView;
}

export interface Batch {
  id: string;
  productId: string;
  printedDate: string;
  notes: string;
  quantity: number;
}

export type HardwareStatus = "unknown" | "needed" | "upcoming" | "installed";

export interface HardwareItem {
  partId: string;
  name: string;
  quantity: number;
  status: HardwareStatus;
  date?: string;
}

export interface Kneeler {
  id: string;
  label?: string;
  capacity: number;
  hardware: HardwareItem[];
}

export interface Aisle {
  id: string;
  name: string;
}

export type RowFrontType = "communionRail" | "pew";

/** When a row has no kneelers but the pew bench still follows column widths (e.g. pillar spans into this row). */
export interface PillarBenchContinuation {
  /** Row id in the same section whose kneeler widths to align with */
  fromRowId: string;
  /** Kneeler id in that row marking the pillar column */
  alignKneelerId: string;
}

export interface PewRow {
  id: string;
  label: string;
  frontType: RowFrontType;
  kneelers: Kneeler[];
  pillarBenchContinuation?: PillarBenchContinuation;
}

export interface ChurchOrientation {
  altar: string;
  entrance: string;
  left: string;
  right: string;
}

export type SectionSide = "westOuter" | "west" | "east" | "eastOuter" | "full";
export type SectionAlignment = "outer" | "nave" | "full";
export type SectionType = "pews" | "crossAisle";

export interface PewSection {
  id: string;
  label: string;
  type: SectionType;
  side: SectionSide;
  alignment: SectionAlignment;
  group: number;
  rows: PewRow[];
}

export interface ChurchLayout {
  orientation: ChurchOrientation;
  aisles: Aisle[];
  sections: PewSection[];
}

export interface Project {
  id: string;
  name: string;
  church: string;
  description: string;
  layout: ChurchLayout;
}
