"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { Kneeler, PewSection, PewRow } from "@/data/types";
import { formatBenchPewId, formatHardwareItemStatusForDetails } from "@/lib/pew-bench-display";
import { labelForRowFrontType } from "@/lib/pew-front-type-labels";
import {
  pewRailColorClass,
  pewMapBenchBandClass,
  isPillarKneeler,
  isPewOnlyKneeler,
  kneelerHardware,
  pewRailSegmentsForRow,
  alignMapRowStripWidthPercent,
  maxMapRowStripWidthNumeratorInSection,
} from "@/lib/pew-layout";
import { PillarGapLabel } from "@/components/pillar-gap-label";
import { KneelerPartStripPanel } from "@/components/kneeler-part-strip";
import { defaultPartFilter, partDisplaySegmentsForPartOnKneeler } from "@/lib/hardware-part-segments";

function pewBenchStripForRow(section: PewSection, row: PewRow) {
  return pewRailSegmentsForRow(section, row);
}

function KneelerStatusList({ kneeler }: { kneeler: Kneeler }) {
  if (isPillarKneeler(kneeler)) {
    return (
      <p className="px-2 pb-2 text-xs text-muted-foreground">
        Structural column — no kneeler hardware.
      </p>
    );
  }
  if (isPewOnlyKneeler(kneeler)) {
    return (
      <p className="px-2 pb-2 text-xs text-muted-foreground">
        Pew only — no kneeler hardware.
      </p>
    );
  }
  const hw = kneelerHardware(kneeler);
  if (hw.length === 0) {
    return (
      <p className="px-2 pb-2 text-xs text-muted-foreground">Unknown</p>
    );
  }
  return (
    <div className="px-2 pb-2 space-y-1.5 text-xs text-foreground">
      {hw.map((h, hi) => (
        <p key={`${h.partId}-${h.side ?? "n"}-${hi}`} className="leading-snug">
          {formatHardwareItemStatusForDetails(h)}
        </p>
      ))}
    </div>
  );
}

/** Expandable rows: pew/rail strip, kneeler map (matches map part from `?part=`), per-kneeler hardware. */
export function SectionRowsPanel({
  section,
  partNames,
}: {
  section: PewSection;
  partNames: string[];
}) {
  const searchParams = useSearchParams();
  const partFilter = useMemo(
    () => defaultPartFilter(searchParams.get("part"), partNames, [section]),
    [searchParams, partNames, section],
  );

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
        const maxCap = maxMapRowStripWidthNumeratorInSection(section);
        const scaleRows = mapAlign !== "fill" && maxCap > 0;
        const widthPct = scaleRows ? alignMapRowStripWidthPercent(section, row) : 100;

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
                    {row.handicapAccessible ? (
                      <span className="text-xs" title="Wheelchair accessible seating" aria-hidden>
                        ♿
                      </span>
                    ) : null}
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
                      <div className="flex w-full min-w-0 items-center gap-px overflow-hidden border rounded p-2">
                        {benchStrip.map((seg) =>
                          seg.variant === "gap" ? (
                            <div
                              key={seg.id}
                              className="flex min-h-[8px] min-w-0 items-center self-stretch"
                              style={{ flex: seg.capacity }}
                            >
                              <PillarGapLabel spanning />
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
                    <div className="flex w-full min-w-0 items-center gap-px overflow-hidden border rounded p-2">
                      {row.kneelers.map((kneeler) => {
                        const idLabel = formatBenchPewId(section, row, kneeler);
                        if (isPillarKneeler(kneeler)) {
                          return (
                            <div
                              key={kneeler.id}
                              className="flex min-w-0 items-center overflow-hidden py-1"
                              style={{ flex: kneeler.capacity }}
                              title="Pillar (gap)"
                            >
                              <PillarGapLabel compact spanning={kneeler.capacity > 1} />
                            </div>
                          );
                        }
                        if (isPewOnlyKneeler(kneeler)) {
                          return (
                            <div
                              key={kneeler.id}
                              className="flex min-w-0 items-center justify-center overflow-hidden py-1"
                              style={{ flex: kneeler.capacity }}
                              title="Pew only (no kneeler hardware)"
                            >
                              <div className={`self-center ${pewMapBenchBandClass}`} />
                            </div>
                          );
                        }
                        const items = kneelerHardware(kneeler).filter((h) => h.name === partFilter);
                        const noneFill = !partFilter || items.length === 0;
                        const segments = noneFill
                          ? []
                          : partDisplaySegmentsForPartOnKneeler(kneeler, partFilter);
                        return (
                          <div
                            key={kneeler.id}
                            className="flex min-w-0"
                            style={{ flex: kneeler.capacity }}
                          >
                            <KneelerPartStripPanel
                              segments={segments}
                              noneFill={noneFill}
                              title={idLabel}
                            >
                              {idLabel}
                            </KneelerPartStripPanel>
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
                              : isPewOnlyKneeler(kneeler)
                                ? "Pew only"
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
