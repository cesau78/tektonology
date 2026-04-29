import type { HardwareItem, Kneeler, PewRow, PewSection } from "@/data/types";
import {
  churchGridRowMajorSectionOrder,
  collectGridRowNumbers,
  parseMapRowNumber,
} from "@/lib/pew-map-grid";

export const PRAYER_SOLE_PART_ID = "prayer-sole";

/** Sum of Prayer Sole `quantity` assigned per install session (was 60 × 4 sessions; now 75 × 3). */
export const PRAYER_SOLE_SESSION_CAPACITY = 75;

/** Planned number of install sessions (length of `DEFAULT_PRAYER_SOLE_SESSION_DATES`). */
export const PRAYER_SOLE_SESSION_COUNT = 3;

/** Default session dates (YYYY-MM-DD), install order. */
export const DEFAULT_PRAYER_SOLE_SESSION_DATES: readonly string[] = [
  "2028-05-03",
  "2028-05-10",
  "2028-05-17",
];

/** Total Prayer Sole units marked `upcoming` when scheduling all default sessions (3 × 75). */
export const PRAYER_SOLE_DEFAULT_TOTAL_UPCOMING_QUANTITY =
  PRAYER_SOLE_SESSION_CAPACITY * PRAYER_SOLE_SESSION_COUNT;

/** Reassigns `date` on each upcoming Prayer Sole line in church row-major order (see {@link churchGridRowMajorSectionOrder}). */
function forEachUpcomingPrayerSoleHardwareInRowMajorOrder(
  sections: PewSection[],
  transeptGridRow: number,
  partId: string,
  fn: (args: { row: PewRow; kneeler: Kneeler; hardware: HardwareItem }) => void,
): void {
  const rowNums = collectGridRowNumbers(sections, transeptGridRow);
  const secOrder = churchGridRowMajorSectionOrder(sections);
  for (const n of rowNums) {
    for (const sec of secOrder) {
      const row = sec.rows.find((r) => parseMapRowNumber(r) === n);
      if (!row) continue;
      for (const k of row.kneelers) {
        for (const h of k.hardware ?? []) {
          if (h.partId !== partId || h.status !== "upcoming") continue;
          fn({ row, kneeler: k, hardware: h });
        }
      }
    }
  }
}

/**
 * Resets all Prayer Sole `upcoming` to `needed`, then promotes lines back to `upcoming` in
 * church **row-major** order until {@link retainQuantity} units are reached (whole hardware
 * lines, same threshold rule as {@link retainUpcomingPrayerSoleQuantity}). Use this so the next
 * install batch spans sections by pew-map row instead of staying where the JSON happened to mark
 * `upcoming`. Does not change `installed` or `inspected` lines.
 */
export function reselectUpcomingPrayerSoleInRowMajorOrder(
  sections: PewSection[],
  options?: {
    retainQuantity?: number;
    partId?: string;
    transeptGridRow?: number;
  },
): { retainedUpcomingQuantity: number } {
  const retain = options?.retainQuantity ?? PRAYER_SOLE_SESSION_CAPACITY;
  const partId = options?.partId ?? PRAYER_SOLE_PART_ID;
  const transeptGridRow = options?.transeptGridRow ?? 9;

  for (const sec of sections) {
    for (const row of sec.rows) {
      for (const k of row.kneelers) {
        for (const h of k.hardware ?? []) {
          if (h.partId !== partId || h.status !== "upcoming") continue;
          h.status = "needed";
          delete h.date;
        }
      }
    }
  }

  let running = 0;
  let retained = 0;
  const rowNums = collectGridRowNumbers(sections, transeptGridRow);
  const secOrder = churchGridRowMajorSectionOrder(sections);
  for (const n of rowNums) {
    for (const sec of secOrder) {
      const row = sec.rows.find((r) => parseMapRowNumber(r) === n);
      if (!row) continue;
      for (const k of row.kneelers) {
        for (const h of k.hardware ?? []) {
          if (h.partId !== partId || h.status !== "needed") continue;
          if (running < retain) {
            h.status = "upcoming";
            running += h.quantity;
            retained += h.quantity;
          }
        }
      }
    }
  }

  return { retainedUpcomingQuantity: retained };
}

export function redistributeUpcomingPrayerSoleDates(
  sections: PewSection[],
  options?: {
    sessionCapacity?: number;
    sessionDates?: readonly string[];
    partId?: string;
    /** Match pew-map grid (e.g. Saint Stanislaus uses 10). */
    transeptGridRow?: number;
  },
): { totalQuantity: number } {
  const capacity = options?.sessionCapacity ?? PRAYER_SOLE_SESSION_CAPACITY;
  const dates = options?.sessionDates ?? DEFAULT_PRAYER_SOLE_SESSION_DATES;
  const partId = options?.partId ?? PRAYER_SOLE_PART_ID;
  const transeptGridRow = options?.transeptGridRow ?? 9;
  let running = 0;

  forEachUpcomingPrayerSoleHardwareInRowMajorOrder(sections, transeptGridRow, partId, ({ hardware: h }) => {
    const idx = Math.min(dates.length - 1, Math.floor(running / capacity));
    h.date = dates[idx];
    running += h.quantity;
  });

  return { totalQuantity: running };
}

/**
 * Sets Prayer Sole lines from `upcoming` to `needed` after the first `retainQuantity`
 * units in traversal order. Remaining upcoming lines keep `upcoming`; their `date` is
 * left for {@link redistributeUpcomingPrayerSoleDates}.
 */
export function retainUpcomingPrayerSoleQuantity(
  sections: PewSection[],
  options?: {
    retainQuantity?: number;
    partId?: string;
    transeptGridRow?: number;
  },
): { retainedUpcomingQuantity: number; convertedToNeededQuantity: number } {
  const retain = options?.retainQuantity ?? 75;
  const partId = options?.partId ?? PRAYER_SOLE_PART_ID;
  const transeptGridRow = options?.transeptGridRow ?? 9;
  let running = 0;
  let retained = 0;
  let converted = 0;

  forEachUpcomingPrayerSoleHardwareInRowMajorOrder(sections, transeptGridRow, partId, ({ hardware: h }) => {
    if (running < retain) {
      running += h.quantity;
      retained += h.quantity;
    } else {
      h.status = "needed";
      delete h.date;
      converted += h.quantity;
    }
  });

  return {
    retainedUpcomingQuantity: retained,
    convertedToNeededQuantity: converted,
  };
}
