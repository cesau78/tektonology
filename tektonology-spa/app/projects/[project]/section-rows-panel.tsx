import type { Kneeler, HardwareStatus, PewSection, PewRow } from "@/data/types";
import { formatBenchPewId, formatHardwareItemStatusForDetails } from "@/lib/pew-bench-display";
import { labelForRowFrontType } from "@/lib/pew-front-type-labels";
import {
  pewRailColorClass,
  isPillarKneeler,
  pewRailSegmentsForRow,
  effectiveRowCapacityForMap,
  maxRowCapacityInSection,
  alignRowStripWidthPercent,
} from "@/lib/pew-layout";
import { PillarGapLabel } from "@/components/pillar-gap-label";

function kneelerStatus(kneeler: Kneeler): HardwareStatus {
  if (kneeler.hardware.length === 0) return "unknown";
  const statuses = kneeler.hardware.map((h) => h.status);
  if (statuses.every((s) => s === "installed")) return "installed";
  if (statuses.some((s) => s === "installed" || s === "upcoming")) return "upcoming";
  if (statuses.some((s) => s === "needed")) return "needed";
  return "unknown";
}

const kneelerColors: Record<HardwareStatus, string> = {
  unknown:
    "bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600",
  needed:
    "bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700",
  upcoming:
    "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700",
  installed:
    "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700",
};

function pewBenchStripForRow(section: PewSection, row: PewRow) {
  return pewRailSegmentsForRow(section, row);
}

function KneelerStatusList({ kneeler }: { kneeler: Kneeler }) {
  if (kneeler.hardware.length === 0) {
    return (
      <p className="px-2 pb-2 text-xs text-muted-foreground">Unknown</p>
    );
  }
  return (
    <div className="px-2 pb-2 space-y-1.5 text-xs text-foreground">
      {kneeler.hardware.map((h, hi) => (
        <p key={hi} className="leading-snug">
          {formatHardwareItemStatusForDetails(h)}
        </p>
      ))}
    </div>
  );
}

/** Expandable rows: pew/rail strip, kneeler map, per-kneeler hardware. */
export function SectionRowsPanel({ section }: { section: PewSection }) {
  return (
    <div
      className={`flex flex-col gap-2 ${
        section.mapRowAlign === "start"
          ? "items-start"
          : section.mapRowAlign === "end"
            ? "items-end"
            : ""
      }`}
    >
      {section.rows.map((row) => {
        const benchStrip = pewBenchStripForRow(section, row);
        const mapAlign = section.mapRowAlign ?? "fill";
        const maxCap = maxRowCapacityInSection(section);
        const scaleRows = mapAlign !== "fill" && maxCap > 0;
        const widthPct = scaleRows
          ? alignRowStripWidthPercent(section, effectiveRowCapacityForMap(row, section))
          : 100;

        return (
          <div
            key={row.id}
            className={scaleRows ? "min-w-0" : "w-full"}
            style={scaleRows ? { width: `${widthPct}%` } : undefined}
          >
            <div className="w-full min-w-0">
              <details className="border rounded-lg w-full">
                <summary className="px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {labelForRowFrontType(row.frontType)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {row.kneelers.length} kneelers
                  </span>
                </summary>
                <div className="px-3 pb-3 space-y-3">
                  {benchStrip && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Pew / Rail
                      </div>
                      <div className="relative flex w-full min-w-0 items-center gap-px overflow-visible border rounded p-2">
                        {benchStrip.map((seg) =>
                          seg.variant === "gap" ? (
                            <div
                              key={seg.id}
                              className="relative flex min-h-[8px] min-w-0 items-center justify-center overflow-visible"
                              style={{ flex: seg.capacity }}
                            >
                              <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                                <PillarGapLabel spanning />
                              </div>
                            </div>
                          ) : (
                            <div
                              key={seg.id}
                              className={`rounded-sm min-h-[8px] ${pewRailColorClass}`}
                              style={{ flex: seg.capacity }}
                              title="Pew / Rail"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {row.kneelers.length > 0 ? (
                    <div className="flex w-full min-w-0 items-center gap-px border rounded p-2">
                      {row.kneelers.map((kneeler) => {
                        const idLabel = formatBenchPewId(section, row, kneeler);
                        if (isPillarKneeler(kneeler)) {
                          return (
                            <div
                              key={kneeler.id}
                              className="flex items-center justify-center min-w-0 py-1"
                              style={{ flex: kneeler.capacity }}
                              title="Pillar (gap)"
                            />
                          );
                        }
                        const status = kneelerStatus(kneeler);
                        return (
                          <div
                            key={kneeler.id}
                            className={`rounded border ${kneelerColors[status]} flex items-center justify-center py-1`}
                            style={{ flex: kneeler.capacity }}
                            title={idLabel}
                          >
                            <span className="text-[8px] text-muted-foreground text-center leading-tight px-0.5">
                              {idLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : benchStrip ? (
                    <p className="text-xs text-muted-foreground">
                      No kneelers in this row; the pillar column continues from the row above.
                    </p>
                  ) : null}

                  <div className="space-y-1">
                    {row.kneelers.map((kneeler) => {
                      return (
                        <details key={kneeler.id} className="border rounded">
                          <summary className="px-2 py-1 text-xs cursor-pointer hover:bg-muted/50">
                            {isPillarKneeler(kneeler)
                              ? "Pillar (gap)"
                              : formatBenchPewId(section, row, kneeler)}
                          </summary>
                          <KneelerStatusList kneeler={kneeler} />
                        </details>
                      );
                    })}
                  </div>
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}
