"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  PewSection,
  PewRow,
  Kneeler,
  HardwareStatus,
  ChurchOrientation,
} from "@/data/types";
import { formatBenchPewId } from "@/lib/pew-bench-display";
import {
  pewRailBarClass,
  pewRailColorClass,
  isPillarKneeler,
  kneelerStatusForPart,
  pewRailSegmentsForRow,
  effectiveRowCapacityForMap,
  maxRowCapacityInSection,
  alignRowStripWidthPercent,
} from "@/lib/pew-layout";
import { PillarGapLabel } from "@/components/pillar-gap-label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ExportPewLayoutButton } from "@/components/export-pew-layout-button";
import type { Project } from "@/data/types";

const kneelerColors: Record<HardwareStatus | "none", string> = {
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

function sectionStats(section: PewSection, partFilter: string) {
  const allKneelers = section.rows.flatMap((r) => r.kneelers);
  const allHardware = allKneelers
    .flatMap((k) => k.hardware)
    .filter((h) => h.name === partFilter);
  const total = allHardware.reduce((s, h) => s + h.quantity, 0);
  const installed = allHardware
    .filter((h) => h.status === "installed")
    .reduce((s, h) => s + h.quantity, 0);
  const pct = total > 0 ? Math.round((installed / total) * 100) : 0;
  return { kneelers: allKneelers.length, total, installed, pct };
}

function groupSections(sections: PewSection[]) {
  const groups = new Map<number, PewSection[]>();
  for (const s of sections) {
    const arr = groups.get(s.group) ?? [];
    arr.push(s);
    groups.set(s.group, arr);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([, secs]) => secs);
}

function KneelerSegments({
  section,
  row,
  kneelers,
  partFilter,
}: {
  section: PewSection;
  row: PewRow;
  kneelers: Kneeler[];
  partFilter: string;
}) {
  return (
    <div className="flex w-full min-w-0 gap-px">
      {kneelers.map((k) => {
        if (isPillarKneeler(k)) {
          return (
            <div
              key={k.id}
              className="flex items-center justify-center min-w-0"
              style={{ flex: k.capacity }}
              title="Pillar (gap)"
            />
          );
        }
        const status = kneelerStatusForPart(k, partFilter);
        return (
          <div
            key={k.id}
            className={`rounded-sm h-2 border ${kneelerColors[status]}`}
            style={{ flex: k.capacity }}
            title={formatBenchPewId(section, row, k)}
          />
        );
      })}
    </div>
  );
}

function PewRailStrip({
  row,
  section,
}: {
  row: PewRow;
  section: PewSection;
}) {
  const segments = pewRailSegmentsForRow(section, row);
  if (!segments) {
    return (
      <div
        className={`w-full ${pewRailBarClass} ${row.kneelers.length > 0 ? "rounded-t-sm" : "rounded-sm"}`}
      />
    );
  }
  const hasGap = segments.some((s) => s.variant === "gap");
  const benchWrapClass =
    hasGap
      ? "flex w-full min-w-0 gap-px min-h-[5px] items-stretch overflow-visible rounded-sm relative z-10"
      : `flex w-full min-w-0 gap-px ${row.kneelers.length > 0 ? "rounded-t-sm overflow-hidden" : "rounded-sm overflow-hidden"}`;
  return (
    <div className={benchWrapClass}>
      {segments.map((s) =>
        s.variant === "gap" ? (
          <div
            key={s.id}
            className="relative flex min-w-0 min-h-[5px] items-center justify-center overflow-visible"
            style={{ flex: s.capacity }}
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <PillarGapLabel compact spanning />
            </div>
          </div>
        ) : (
          <div key={s.id} className="flex min-w-0 items-center" style={{ flex: s.capacity }}>
            <div className={`${pewRailBarClass} w-full`} />
          </div>
        ),
      )}
    </div>
  );
}

function RowStrip({
  row,
  partFilter,
  section,
  showRails,
}: {
  row: PewRow;
  partFilter: string;
  section: PewSection;
  showRails: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-0 overflow-visible">
      {showRails && <PewRailStrip row={row} section={section} />}
      {!showRails && row.kneelers.length === 0 ? (
        <div className="h-2 w-full shrink-0 rounded-sm bg-transparent" aria-hidden />
      ) : null}
      {row.kneelers.length > 0 && (
        <KneelerSegments
          section={section}
          row={row}
          kneelers={row.kneelers}
          partFilter={partFilter}
        />
      )}
    </div>
  );
}

function SectionMapBlock({
  section,
  partFilter,
  showRails,
  projectSlug,
}: {
  section: PewSection;
  partFilter: string;
  showRails: boolean;
  projectSlug?: string;
}) {
  const stats = sectionStats(section, partFilter);
  const mapAlign = section.mapRowAlign ?? "fill";
  const maxCap = maxRowCapacityInSection(section);
  const scaleRows = mapAlign !== "fill" && maxCap > 0;
  const colAlign =
    mapAlign === "start" ? "items-start" : mapAlign === "end" ? "items-end" : "";

  const inner = (
    <div className="border rounded-lg p-1.5 group-hover:border-amber-300 transition-colors h-full">
      <div className="text-[9px] text-muted-foreground mb-1 truncate">
        {section.label}{" "}
        <span className="text-[8px]">
          {section.rows.length}r &middot; {stats.kneelers}k &middot;{" "}
          {stats.pct}%
        </span>
      </div>
      <div className={`flex flex-col gap-1 ${colAlign}`}>
        {section.rows.map((row) => {
          const sum = effectiveRowCapacityForMap(row, section);
          const widthPct = scaleRows ? alignRowStripWidthPercent(section, sum) : 100;
          return (
            <div
              key={row.id}
              className={scaleRows ? "min-w-0" : "w-full"}
              style={scaleRows ? { width: `${widthPct}%` } : undefined}
            >
              <div className="w-full min-w-0">
                <RowStrip
                  row={row}
                  partFilter={partFilter}
                  section={section}
                  showRails={showRails}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (projectSlug) {
    return (
      <Link
        href={`/projects/${projectSlug}/sections/${section.id}/`}
        className="block group flex-1 min-w-0"
      >
        {inner}
      </Link>
    );
  }

  return <div className="block flex-1 min-w-0">{inner}</div>;
}

export function PewMap({
  churchName,
  orientation,
  sections,
  partNames,
  showRails = true,
  projectSlug,
  hideChurchFrame = false,
  project,
  exportSectionId,
}: {
  churchName: string;
  orientation: ChurchOrientation;
  sections: PewSection[];
  partNames: string[];
  /** When false, only kneeler strips (colored by selected part); no pew/rail row. */
  showRails?: boolean;
  /** Section tiles link to `/projects/{slug}/sections/{id}/`. */
  projectSlug?: string;
  /** Omit compass and altar/entrance labels (e.g. single-section view). */
  hideChurchFrame?: boolean;
  /** When set, show Excel export under the part selector (uses selected part in cells). */
  project?: Project;
  /** If set, export only this section; otherwise all pew sections. */
  exportSectionId?: string;
}) {
  const searchParams = useSearchParams();
  const initialPart = searchParams.get("part");

  function defaultPart(): string {
    if (initialPart) {
      const match = partNames.find(
        (n) => n === initialPart || n.toLowerCase().replace(/\s+/g, "-") === initialPart,
      );
      if (match) return match;
    }
    const allHw = sections
      .flatMap((s) => s.rows)
      .flatMap((r) => r.kneelers)
      .flatMap((k) => k.hardware);
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

  const [partFilter, setPartFilter] = useState<string>(defaultPart);
  const sectionGroups = groupSections(sections);

  const allHardware = sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers)
    .flatMap((k) => k.hardware)
    .filter((h) => h.name === partFilter);
  const installedCount = allHardware
    .filter((h) => h.status === "installed")
    .reduce((s, h) => s + h.quantity, 0);
  const neededCount = allHardware
    .filter((h) => h.status === "needed")
    .reduce((s, h) => s + h.quantity, 0);
  const upcomingCount = allHardware
    .filter((h) => h.status === "upcoming")
    .reduce((s, h) => s + h.quantity, 0);
  const trackable = installedCount + neededCount + upcomingCount;
  const pct = trackable > 0 ? Math.round((installedCount / trackable) * 100) : 0;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{churchName}</CardTitle>
            <select
              className="text-xs border rounded px-2 py-1 bg-background text-foreground"
              value={partFilter}
              onChange={(e) => setPartFilter(e.target.value)}
            >
              {partNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {project && partNames.length > 0 && partFilter && (
            <div className="flex w-full justify-end">
              <ExportPewLayoutButton
                project={project}
                sectionId={exportSectionId}
                partName={partFilter}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 max-w-xs mx-auto">
          <div className="text-sm text-muted-foreground text-center mb-1">
            {installedCount} / {trackable} Installed ({pct}%)
          </div>
          <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="mb-4 flex flex-col gap-3 text-xs text-muted-foreground">
          {showRails && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                Pew / Rail
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5">
                  <div className={`w-8 h-3 rounded-sm ${pewRailColorClass}`} />
                  <span>Pew / Rail</span>
                </div>
              </div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              Kneeler Parts
            </div>
            <div className="flex flex-wrap gap-4">
              {(["needed", "upcoming", "installed"] as const).map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`w-6 h-2 rounded-sm border ${kneelerColors[status]}`} />
                  <span>
                    {status === "needed"
                      ? "Parts Needed"
                      : status === "upcoming"
                        ? "Upcoming"
                        : "Installed"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4" />
        <div className="relative">
          {!hideChurchFrame && (
            <>
              {/* Compass Rose */}
              <div className="absolute top-0 right-0 w-16 h-16 flex items-center justify-center">
                <div className="relative w-12 h-12 text-[10px] font-medium text-muted-foreground">
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 text-foreground font-bold">
                    {orientation.altar}
                  </span>
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2">
                    {orientation.entrance}
                  </span>
                  <span className="absolute left-0 top-1/2 -translate-y-1/2">
                    {orientation.left}
                  </span>
                  <span className="absolute right-0 top-1/2 -translate-y-1/2">
                    {orientation.right}
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-neutral-300 dark:bg-neutral-600 absolute" />
                    <div className="h-px w-full bg-neutral-300 dark:bg-neutral-600 absolute" />
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-neutral-400" />
                </div>
              </div>

              {/* Altar */}
              <div className="flex justify-center mb-4">
                <div className="text-xs text-muted-foreground text-center">Altar</div>
              </div>
            </>
          )}

          {/* Church body — rendered group by group */}
          <div className="flex flex-col gap-3">
            {sectionGroups.map((group, gi) => {
              const fullSection = group.find((s) => s.side === "full");

              // Cross aisle (transept) — spans full width including outer columns
              if (fullSection?.type === "crossAisle") {
                return (
                  <div
                    key={`group-${gi}`}
                    className="h-6 border-y border-dashed border-neutral-300 dark:border-neutral-600 flex items-center justify-center"
                  >
                    <span className="text-[9px] text-muted-foreground">
                      {fullSection.label}
                    </span>
                  </div>
                );
              }

              // Full-width pew section
              if (fullSection) {
                return (
                  <div key={`group-${gi}`} className="flex items-stretch gap-0">
                    <div className="w-6 shrink-0" />
                    <div className="w-6 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <SectionMapBlock
                        section={fullSection}
                        partFilter={partFilter}
                        showRails={showRails}
                        projectSlug={projectSlug}
                      />
                    </div>
                    <div className="w-6 shrink-0" />
                    <div className="w-6 shrink-0" />
                  </div>
                );
              }

              const westOuter = group.find((s) => s.side === "westOuter");
              const westSection = group.find((s) => s.side === "west");
              const eastSection = group.find((s) => s.side === "east");
              const eastOuter = group.find((s) => s.side === "eastOuter");
              const alignment = westSection?.alignment ?? eastSection?.alignment ?? "nave";

              return (
                <div key={`group-${gi}`} className="flex items-stretch gap-0">
                  {/* West Outer — or spacer to keep alignment */}
                  <div className="min-w-0" style={{ flex: 0.4 }}>
                    {westOuter && (
                      <SectionMapBlock
                        section={westOuter}
                        partFilter={partFilter}
                        showRails={showRails}
                        projectSlug={projectSlug}
                      />
                    )}
                  </div>

                  {/* West Aisle */}
                  <div className="w-6 shrink-0 border-x border-dashed border-neutral-300 dark:border-neutral-600 flex flex-col items-center">
                    {gi === 0 && <span className="text-[8px] text-muted-foreground mt-1">W</span>}
                  </div>

                  {/* Center — west/east pair with nave or gap */}
                  <div className="flex-[3] flex items-stretch gap-0 min-w-0">
                    {alignment === "outer" ? (
                      <>
                        {westSection && (
                          <SectionMapBlock
                            section={westSection}
                            partFilter={partFilter}
                            showRails={showRails}
                            projectSlug={projectSlug}
                          />
                        )}
                        <div className="w-16 shrink-0" />
                        {eastSection && (
                          <SectionMapBlock
                            section={eastSection}
                            partFilter={partFilter}
                            showRails={showRails}
                            projectSlug={projectSlug}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        {westSection && (
                          <SectionMapBlock
                            section={westSection}
                            partFilter={partFilter}
                            showRails={showRails}
                            projectSlug={projectSlug}
                          />
                        )}
                        {/* Nave */}
                        <div className="w-6 shrink-0 border-x border-dashed border-neutral-300 dark:border-neutral-600" />
                        {eastSection && (
                          <SectionMapBlock
                            section={eastSection}
                            partFilter={partFilter}
                            showRails={showRails}
                            projectSlug={projectSlug}
                          />
                        )}
                      </>
                    )}
                  </div>

                  {/* East Aisle */}
                  <div className="w-6 shrink-0 border-x border-dashed border-neutral-300 dark:border-neutral-600 flex flex-col items-center">
                    {gi === 0 && <span className="text-[8px] text-muted-foreground mt-1">E</span>}
                  </div>

                  {/* East Outer — or spacer to keep alignment */}
                  <div className="min-w-0" style={{ flex: 0.4 }}>
                    {eastOuter && (
                      <SectionMapBlock
                        section={eastOuter}
                        partFilter={partFilter}
                        showRails={showRails}
                        projectSlug={projectSlug}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!hideChurchFrame && (
            <div className="flex justify-center mt-4">
              <div className="text-xs text-muted-foreground">&darr; Entrance</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
