import type { ReactNode } from "react";
import type { HardwareStatus } from "@/data/types";
import type { PartDisplaySegment } from "@/lib/hardware-part-segments";
import { partDisplaySegmentsShouldSplit } from "@/lib/hardware-part-segments";

export const kneelerStripTailwindByStatus: Record<HardwareStatus | "none", string> = {
  unknown:
    "bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600",
  needed:
    "bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700",
  upcoming:
    "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700",
  installed:
    "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700",
  none: "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
};

type StripVariant = "map" | "panel";

const roundedOuter: Record<StripVariant, string> = {
  map: "rounded-sm",
  panel: "rounded",
};

/**
 * Map row: short status strip (or split) for the selected part.
 */
export function KneelerPartStripMap({
  segments,
  noneFill,
  title,
}: {
  segments: PartDisplaySegment[];
  noneFill: boolean;
  title?: string;
}) {
  const minHeightClass = "h-2";
  const round = roundedOuter.map;

  if (noneFill || segments.length === 0) {
    return (
      <div
        className={`${minHeightClass} w-full min-w-0 border ${kneelerStripTailwindByStatus.none} ${round}`}
        title={title}
      />
    );
  }

  if (!partDisplaySegmentsShouldSplit(segments)) {
    const s = segments[0]!;
    return (
      <div
        className={`${minHeightClass} w-full min-w-0 border ${kneelerStripTailwindByStatus[s.status]} ${round}`}
        title={title}
      />
    );
  }

  return (
    <div
      className={`flex w-full min-w-0 gap-px ${minHeightClass} ${round} overflow-hidden border border-neutral-300 dark:border-neutral-600`}
      title={title}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          className={`min-h-0 min-w-0 ${kneelerStripTailwindByStatus[s.status]}`}
          style={{ flex: s.weight }}
        />
      ))}
    </div>
  );
}

/**
 * Section panel: kneeler cell with optional split background and centered label.
 */
export function KneelerPartStripPanel({
  segments,
  noneFill,
  title,
  children,
}: {
  segments: PartDisplaySegment[];
  noneFill: boolean;
  title?: string;
  children: ReactNode;
}) {
  const round = roundedOuter.panel;

  if (noneFill || segments.length === 0) {
    return (
      <div
        className={`relative flex w-full min-w-0 items-center justify-center border ${kneelerStripTailwindByStatus.none} ${round} py-1`}
        title={title}
      >
        <span className="relative z-10 text-[8px] text-muted-foreground text-center leading-tight px-0.5">
          {children}
        </span>
      </div>
    );
  }

  if (!partDisplaySegmentsShouldSplit(segments)) {
    const s = segments[0]!;
    return (
      <div
        className={`relative flex w-full min-w-0 items-center justify-center border ${kneelerStripTailwindByStatus[s.status]} ${round} py-1`}
        title={title}
      >
        <span className="relative z-10 text-[8px] text-muted-foreground text-center leading-tight px-0.5">
          {children}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex w-full min-w-0 items-center justify-center overflow-hidden border border-neutral-300 dark:border-neutral-600 ${round} py-1`}
      title={title}
    >
      <div className="pointer-events-none absolute inset-0 flex gap-px">
        {segments.map((s, i) => (
          <div
            key={i}
            className={`min-h-0 min-w-0 ${kneelerStripTailwindByStatus[s.status]}`}
            style={{ flex: s.weight }}
          />
        ))}
      </div>
      <span className="relative z-10 text-[8px] text-muted-foreground text-center leading-tight px-0.5">
        {children}
      </span>
    </div>
  );
}
