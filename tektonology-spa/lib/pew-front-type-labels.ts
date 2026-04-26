import type { RowFrontType } from "@/data/types";

const LABELS: Record<RowFrontType, string> = {
  communionRail: "Communion Rail",
  pew: "Pew with Kneeler",
  pewOnly: "Pew Only",
};

/** User-facing class name for a row’s `frontType` (UI, Excel row labels, etc.). */
export function labelForRowFrontType(frontType: RowFrontType | string): string {
  if (frontType in LABELS) {
    return LABELS[frontType as RowFrontType];
  }
  return String(frontType);
}
