export type PrintSettings = Record<string, string>;

export interface DownloadLink {
  label: string;
  url: string;
  color?: string;
  edgeColor?: string;
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

/** Lifecycle: inspected (OK as-is) → needed → upcoming (scheduled) → installed (replacement in place). */
export type HardwareStatus = "unknown" | "inspected" | "needed" | "upcoming" | "installed";

/** Pew-local side for hardware on a kneeler (liturgical L/M/R along the bench). */
export type HardwareSide = "left" | "right" | "middle";

/**
 * When `side` is omitted and `quantity` is 2 or 3, strips treat the line as implied
 * left+right or left+middle+right with equal weights (see `hardware-part-segments`).
 */
export interface HardwareItem {
  partId: string;
  name: string;
  quantity: number;
  status: HardwareStatus;
  date?: string;
  side?: HardwareSide;
}

/** Row column: seating (`Kneeler`, default), structural gap (`Pillar`), or bench without kneeler hardware (`PewOnly`). */
export type PewColumnType = "Kneeler" | "Pillar" | "PewOnly";

export interface Kneeler {
  id: string;
  /**
   * `"Pillar"` marks a structural column gap (same role as legacy `label: "Pillar"`).
   * Omit for normal seating columns.
   */
  type?: PewColumnType;
  label?: string;
  capacity: number;
  /** Omit or `[]` for `type: "Pillar"`. */
  hardware?: HardwareItem[];
}

export interface Aisle {
  id: string;
  name: string;
}

export type RowFrontType = "communionRail" | "pew" | "pewOnly";

/** When a row has no kneelers but the pew bench still follows column widths (e.g. pillar spans into this row). */
export interface PillarBenchContinuation {
  /** Row id in the same section whose kneeler widths to align with */
  fromRowId: string;
  /** Column id in that row marking the pillar (`type: "Pillar"` or legacy pillar label). */
  alignKneelerId: string;
}

export interface PewRow {
  id: string;
  label: string;
  /** Pew map / section panel: show wheelchair-accessible indicator for this row. */
  handicapAccessible?: boolean;
  /** Pew map row grid: explicit sort key when label is not `Row N` (optional). */
  mapRowNumber?: number;
  frontType: RowFrontType;
  /** Left-to-right columns: seating kneelers and/or `type: "Pillar"` gaps (capacity = column width). */
  kneelers: Kneeler[];
  pillarBenchContinuation?: PillarBenchContinuation;
  /** Flex widths for pew/rail strip when it differs from kneeler-derived layout. */
  pewRailSegmentWidths?: number[];
  /** Same length as pewRailSegmentWidths; "gap" for structural pillar (no rail). */
  pewRailSegmentKinds?: ("pew" | "gap")[];
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
  /** Default pew section when omitted in project JSON. */
  type?: SectionType;
  side: SectionSide;
  alignment: SectionAlignment;
  group: number;
  rows: PewRow[];
  /**
   * Pew map only: scale each row to the widest row in the section and align strips
   * to the outer edge (west → start, east → end). Default fills the block width.
   */
  mapRowAlign?: "start" | "end" | "fill";
  /**
   * When set with mapRowAlign: row strip width = min(100%, (rowSum / ref) × 100%).
   * Use when row 0 is sum 9 but a later row sums higher (e.g. 4×3=12) so all rows
   * share the same outer width as the ref (9) row.
   */
  mapRowAlignRefCapacity?: number;
  /**
   * Church-aligned grid / Excel only: added to the displayed row number before matching this
   * section's rows. Use -1 when outer pew row labels are one line ahead of the nave (shift down).
   */
  churchGridRowDelta?: number;
}

export interface ChurchLayout {
  orientation: ChurchOrientation;
  aisles: Aisle[];
  sections: PewSection[];
  /**
   * When true, pew map renders one horizontal band per logical row number so nave, transept,
   * rear, and outer sections stay vertically aligned (table layout).
   */
  pewMapUseRowGrid?: boolean;
  /**
   * Map row number where the cross-aisle band spans the nave center (same index as "Row N").
   * Defaults to 9 when omitted. Use 10 (etc.) when that row is still used for nave pews.
   */
  transeptGridRow?: number;
}

export interface Project {
  id: string;
  name: string;
  church: string;
  description: string;
  layout: ChurchLayout;
}

export interface PartCount {
  tread: number | null;
  collar: number | null;
  cap: number | null;
  m3Bolt: number | null;
  m3Nut: number | null;
}

export interface CumulativeByDate {
  [date: string]: number;
}

export interface InventoryTally {
  date: string;
  event: string;
  notes?: string;
  installed: {
    total: number;
    byDate: CumulativeByDate;
  };
  assembled: number | null;
  loose: PartCount;
  destroyed?: {
    total: number;
    byDate: CumulativeByDate;
  };
}

/** Site copy for the maintenance lifecycle (build-time JSON under data/site/). */
export interface MaintenanceLifecyclePhase {
  phaseNumber: number;
  title: string;
  role: string;
  summary: string;
  bullets: string[];
}

/** One sub-process under a lifecycle phase (friendly bullet with its own line of meaning). */
export interface LifecycleSubProcess {
  title: string;
  description: string;
}

/** One step in a loop with copy for the diagram label plus reader-facing detail. */
export interface LifecyclePhaseDetail {
  label: string;
  description: string;
  subItems: LifecycleSubProcess[];
}

/** One circular lifecycle diagram (steps run clockwise). */
export interface LifecycleLoopDescriptor {
  /** Heading above the ring. */
  title: string;
  /** Small caps label inside the ring. */
  centerEyebrow: string;
  centerNote: string;
  /** Step labels for the ring match `phaseDetails` in order. */
  phaseDetails: LifecyclePhaseDetail[];
}

export interface MaintenanceLifecycle {
  title: string;
  intro: string;
  phases: MaintenanceLifecyclePhase[];
  /** On-site Spot → Prepare → Restore loop; overview narrative (center note) and phase details. */
  restorationLoop: LifecycleLoopDescriptor;
  /** Funding, R&D, and obtaining what is needed before restoration work. */
  planningLoop: LifecycleLoopDescriptor;
}
