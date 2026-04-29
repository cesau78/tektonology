import type { HardwareItem, HardwareStatus, Kneeler, PewSection } from "@/data/types";
import { isPillarKneeler, isPewOnlyKneeler, kneelerHardware } from "@/lib/pew-layout";

/** One horizontal slice of the kneeler strip for a single part name (L/M/R or implied). */
export interface PartDisplaySegment {
  status: HardwareStatus;
  weight: number;
  date?: string;
  sideLabel?: "left" | "right" | "middle";
}

function expandHardwareLineToSegments(h: HardwareItem): PartDisplaySegment[] {
  if (h.side === "left" || h.side === "right" || h.side === "middle") {
    return [
      {
        status: h.status,
        weight: Math.max(1, h.quantity),
        date: h.date,
        sideLabel: h.side,
      },
    ];
  }
  if (h.quantity === 2) {
    return [
      { status: h.status, weight: 1, date: h.date, sideLabel: "left" },
      { status: h.status, weight: 1, date: h.date, sideLabel: "right" },
    ];
  }
  if (h.quantity === 3) {
    return [
      { status: h.status, weight: 1, date: h.date, sideLabel: "left" },
      { status: h.status, weight: 1, date: h.date, sideLabel: "middle" },
      { status: h.status, weight: 1, date: h.date, sideLabel: "right" },
    ];
  }
  return [
    {
      status: h.status,
      weight: Math.max(1, h.quantity),
      date: h.date,
    },
  ];
}

/** Segments for map/section strips: same part name, possibly multiple JSON rows. */
export function partDisplaySegmentsForPartOnKneeler(
  kneeler: Kneeler,
  partName: string,
): PartDisplaySegment[] {
  const name = partName.trim();
  if (!name || isPillarKneeler(kneeler) || isPewOnlyKneeler(kneeler)) return [];
  const items = kneelerHardware(kneeler).filter((h) => h.name === name);
  if (items.length === 0) return [];
  const out: PartDisplaySegment[] = [];
  for (const h of items) {
    out.push(...expandHardwareLineToSegments(h));
  }
  return out;
}

export function partDisplaySegmentsShouldSplit(segments: PartDisplaySegment[]): boolean {
  return segments.length > 1;
}

const SIDE_ORDER: Record<"left" | "right" | "middle", number> = {
  left: 0,
  middle: 1,
  right: 2,
};

/** Sort hardware lines for multiline Excel / details: left → middle → right → unspecified. */
export function sortHardwareItemsForPartDisplay(items: HardwareItem[]): HardwareItem[] {
  return [...items]
    .map((h, index) => ({ h, index }))
    .sort((a, b) => {
      const ao = a.h.side != null ? SIDE_ORDER[a.h.side] : 3;
      const bo = b.h.side != null ? SIDE_ORDER[b.h.side] : 3;
      if (ao !== bo) return ao - bo;
      return a.index - b.index;
    })
    .map(({ h }) => h);
}

/** Default part selection (matches PewMap): URL token, else part with most needed+upcoming qty. */
export function defaultPartFilter(
  partParam: string | null,
  partNames: string[],
  sections: PewSection[],
): string {
  if (partParam) {
    const match = partNames.find(
      (n) => n === partParam || n.toLowerCase().replace(/\s+/g, "-") === partParam,
    );
    if (match) return match;
  }
  const allHw = sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers)
    .flatMap((k) => kneelerHardware(k));
  const counts: Record<string, number> = {};
  for (const h of allHw) {
    if (h.status === "needed" || h.status === "upcoming") {
      counts[h.name] = (counts[h.name] ?? 0) + h.quantity;
    }
  }
  let best = partNames[0] ?? "";
  let bestCount = -1;
  for (const name of partNames) {
    if ((counts[name] ?? 0) > bestCount) {
      best = name;
      bestCount = counts[name] ?? 0;
    }
  }
  return best;
}
