"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  kneelerHardware,
  pewRailSegmentsForRow,
  mapPewRailSegmentsAlignedToKneelerColumns,
  alignMapRowStripWidthPercent,
  maxMapRowStripWidthNumeratorInSection,
  type PewBenchSegment,
} from "@/lib/pew-layout";
import { collectGridRowNumbers, parseMapRowNumber } from "@/lib/pew-map-grid";
import { PillarGapLabel } from "@/components/pillar-gap-label";
import { KneelerPartStripMap } from "@/components/kneeler-part-strip";
import { defaultPartFilter, partDisplaySegmentsForPartOnKneeler } from "@/lib/hardware-part-segments";
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
    .flatMap((k) => kneelerHardware(k))
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

function HandicapRowBadge() {
  return (
    <div
      className="flex w-full min-w-0 justify-center pb-px"
      title="Wheelchair accessible seating"
    >
      <span className="text-[11px] leading-none select-none" aria-hidden>
        ♿
      </span>
      <span className="sr-only">Wheelchair accessible seating</span>
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
    return <div className={`w-full ${pewRailBarClass} rounded-sm`} />;
  }
  const hasGap = segments.some((s) => s.variant === "gap");
  const benchWrapClass = hasGap
    ? "flex w-full min-w-0 gap-px items-stretch overflow-hidden rounded-sm"
    : "flex w-full min-w-0 gap-px rounded-sm overflow-hidden";
  return (
    <div className={benchWrapClass}>
      {segments.map((s) =>
        s.variant === "gap" ? (
          <div
            key={s.id}
            className="flex min-w-0 min-h-0 items-center self-stretch"
            style={{ flex: s.capacity }}
          >
            <PillarGapLabel stripHeight="rail" />
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

/** When rails are hidden (main project view), still show structural pillar gaps from pew/rail layout. */
function RailPillarGapsOnly({ row, section }: { row: PewRow; section: PewSection }) {
  const segments = pewRailSegmentsForRow(section, row);
  if (!segments?.some((s) => s.variant === "gap")) return null;
  return (
    <div className="flex w-full min-w-0 gap-px items-stretch overflow-hidden rounded-sm">
      {segments.map((s) =>
        s.variant === "gap" ? (
          <div
            key={s.id}
            className="flex min-w-0 min-h-0 items-center self-stretch"
            style={{ flex: s.capacity }}
          >
            <PillarGapLabel stripHeight="rail" />
          </div>
        ) : (
          <div
            key={s.id}
            className="flex min-w-0 min-h-[5px] items-center self-stretch"
            style={{ flex: s.capacity }}
            aria-hidden
          />
        ),
      )}
    </div>
  );
}

/** Pew rail + kneeler strip when column widths match (pillar = one cell spanning both bands). */
function RowStripColumnGrid({
  section,
  row,
  partFilter,
  showRails,
  segments,
}: {
  section: PewSection;
  row: PewRow;
  partFilter: string;
  showRails: boolean;
  segments: PewBenchSegment[];
}) {
  const kneelers = row.kneelers;
  const pillarGapsWhenRailsOff = !showRails && segments.some((s) => s.variant === "gap");
  const upperBand = showRails || pillarGapsWhenRailsOff;
  const gridCols = kneelers.map((k) => `${k.capacity}fr`).join(" ");

  return (
    <div
      className="grid w-full min-w-0 gap-px overflow-hidden"
      style={{
        gridTemplateColumns: gridCols,
        gridTemplateRows: upperBand ? "auto 1fr" : "1fr",
      }}
    >
      {kneelers.flatMap((k, i): ReactNode[] => {
        const seg = segments[i]!;
        if (isPillarKneeler(k)) {
          /** Upper band: spacer only (matches rail row height; avoids a second grey pill). Kneeler band: pillar strip. */
          const out: ReactNode[] = [];
          if (upperBand) {
            out.push(
              <div
                key={`${k.id}-pillar-rail`}
                className="flex min-w-0 min-h-0 items-center overflow-hidden"
                style={{ gridColumn: i + 1, gridRow: 1 }}
              >
                <div className="min-h-[5px] w-full min-w-0 shrink-0" aria-hidden />
              </div>,
            );
          }
          out.push(
            <div
              key={`${k.id}-pillar-kneel`}
              className="flex min-w-0 min-h-0 items-stretch overflow-hidden"
              style={{ gridColumn: i + 1, gridRow: upperBand ? 2 : 1 }}
              title="Pillar (gap)"
            >
              <PillarGapLabel stripHeight="kneeler" />
            </div>,
          );
          return out;
        }
        const out: ReactNode[] = [];
        if (upperBand) {
          out.push(
            <div
              key={`${k.id}-upper`}
              className="flex min-w-0 min-h-0 items-center"
              style={{ gridColumn: i + 1, gridRow: 1 }}
            >
              {showRails ? (
                seg.variant === "gap" ? (
                  <PillarGapLabel stripHeight="rail" />
                ) : (
                  <div className={`${pewRailBarClass} w-full min-h-[5px]`} />
                )
              ) : (
                <div className="min-h-[5px] w-full min-h-0" aria-hidden />
              )}
            </div>,
          );
        }
        const items = kneelerHardware(k).filter((h) => h.name === partFilter);
        const noneFill = items.length === 0;
        const kneelerSegs = noneFill ? [] : partDisplaySegmentsForPartOnKneeler(k, partFilter);
        out.push(
          <div
            key={`${k.id}-kneel`}
            className="flex min-w-0 min-h-0 items-center"
            style={{ gridColumn: i + 1, gridRow: upperBand ? 2 : 1 }}
          >
            <KneelerPartStripMap
              segments={kneelerSegs}
              noneFill={noneFill}
              title={formatBenchPewId(section, row, k)}
            />
          </div>,
        );
        return out;
      })}
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
  const handicap = row.handicapAccessible ? <HandicapRowBadge /> : null;

  if (row.kneelers.length > 0) {
    const mapSegments = mapPewRailSegmentsAlignedToKneelerColumns(section, row);
    return (
      <div className="flex w-full min-w-0 flex-col gap-0">
        {handicap}
        <RowStripColumnGrid
          section={section}
          row={row}
          partFilter={partFilter}
          showRails={showRails}
          segments={mapSegments}
        />
      </div>
    );
  }

  const segments = pewRailSegmentsForRow(section, row);
  const pillarGapsWhenRailsOff = !showRails && segments?.some((s) => s.variant === "gap");

  return (
    <div className="flex w-full min-w-0 flex-col gap-0 overflow-hidden">
      {handicap}
      {showRails && <PewRailStrip row={row} section={section} />}
      {!showRails && <RailPillarGapsOnly row={row} section={section} />}
      {!showRails && !pillarGapsWhenRailsOff ? (
        <div className="h-2 w-full shrink-0 rounded-sm bg-transparent" aria-hidden />
      ) : null}
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
  const maxCap = maxMapRowStripWidthNumeratorInSection(section);
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
      <div className={`flex flex-col gap-0.5 ${colAlign}`}>
        {section.rows.map((row) => {
          const widthPct = scaleRows ? alignMapRowStripWidthPercent(section, row) : 100;
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

function MapGridCell({
  section,
  row,
  partFilter,
  showRails,
  projectSlug,
}: {
  section: PewSection;
  row: PewRow;
  partFilter: string;
  showRails: boolean;
  projectSlug?: string;
}) {
  const mapAlign = section.mapRowAlign ?? "fill";
  const maxCap = maxMapRowStripWidthNumeratorInSection(section);
  const scaleRows = mapAlign !== "fill" && maxCap > 0;
  const widthPct = scaleRows ? alignMapRowStripWidthPercent(section, row) : 100;
  const colAlign =
    mapAlign === "start" ? "items-start" : mapAlign === "end" ? "items-end" : "";

  const inner = (
    <div className={`flex w-full min-w-0 flex-col gap-0 ${colAlign}`}>
      <div
        className={scaleRows ? "min-w-0" : "w-full"}
        style={scaleRows ? { width: `${widthPct}%` } : undefined}
      >
        <RowStrip
          row={row}
          partFilter={partFilter}
          section={section}
          showRails={showRails}
        />
      </div>
    </div>
  );

  if (projectSlug) {
    return (
      <Link
        href={`/projects/${projectSlug}/sections/${section.id}/`}
        className="block min-w-0 group"
      >
        <div className="rounded border border-transparent p-0.5 transition-colors group-hover:border-amber-300">
          {inner}
        </div>
      </Link>
    );
  }

  return <div className="p-0.5">{inner}</div>;
}

function ChurchAlignedPewTable({
  sections,
  partFilter,
  showRails,
  projectSlug,
  transeptGridRow = 9,
}: {
  sections: PewSection[];
  partFilter: string;
  showRails: boolean;
  projectSlug?: string;
  /** Map row index for the cross-aisle band across the nave (default 9). */
  transeptGridRow?: number;
}) {
  const transeptSection = sections.find((s) => s.type === "crossAisle");
  const transeptLabel = transeptSection?.label ?? "Transept";
  const rowNums = collectGridRowNumbers(sections, transeptGridRow);

  const westAll = sections
    .filter((s) => s.side === "west" && (s.type ?? "pews") === "pews")
    .sort((a, b) => a.group - b.group);
  const eastAll = sections
    .filter((s) => s.side === "east" && (s.type ?? "pews") === "pews")
    .sort((a, b) => a.group - b.group);

  const westOuter = sections.find((s) => s.side === "westOuter");
  const eastOuter = sections.find((s) => s.side === "eastOuter");
  const alignment = westAll[0]?.alignment ?? eastAll[0]?.alignment ?? "nave";

  function pickWest(n: number): { section: PewSection; row: PewRow } | undefined {
    for (const sec of westAll) {
      const row = sec.rows.find((r) => parseMapRowNumber(r) === n);
      if (row) return { section: sec, row };
    }
    return undefined;
  }

  function pickEast(n: number): { section: PewSection; row: PewRow } | undefined {
    for (const sec of eastAll) {
      const row = sec.rows.find((r) => parseMapRowNumber(r) === n);
      if (row) return { section: sec, row };
    }
    return undefined;
  }

  function pickOuter(section: PewSection | undefined, n: number) {
    if (!section) return undefined;
    const adj = n + (section.churchGridRowDelta ?? 0);
    const row = section.rows.find((r) => parseMapRowNumber(r) === adj);
    if (!row) return undefined;
    return { section, row };
  }

  const firstRowN = rowNums[0] ?? 0;

  return (
    <table className="w-full border-collapse table-fixed text-left">
      <colgroup>
        <col className="w-7" />
        <col className="w-[11%]" />
        <col className="w-[1.5rem]" />
        <col />
        <col className="w-[1.5rem]" />
        <col />
        <col className="w-[1.5rem]" />
        <col className="w-[11%]" />
      </colgroup>
      <tbody>
        {rowNums.map((n) => {
          const wo = pickOuter(westOuter, n);
          const eo = pickOuter(eastOuter, n);
          const w = pickWest(n);
          const e = pickEast(n);
          const isTranseptBand = n === transeptGridRow && transeptSection;

          return (
            <tr key={n} className="align-middle">
              <td className="border-b border-neutral-200 px-0.5 py-0.5 align-middle text-right text-[8px] tabular-nums text-muted-foreground dark:border-neutral-700">
                {n}
              </td>
              <td className="border-b border-neutral-200 p-0 align-middle dark:border-neutral-700">
                {wo ? (
                  <MapGridCell
                    section={wo.section}
                    row={wo.row}
                    partFilter={partFilter}
                    showRails={showRails}
                    projectSlug={projectSlug}
                  />
                ) : (
                  <div className="min-h-[8px]" aria-hidden />
                )}
              </td>
              <td className="border-x border-dashed border-neutral-300 p-0 align-middle dark:border-neutral-600">
                <div className="flex min-h-[8px] flex-col items-center justify-center">
                  {n === firstRowN && (
                    <span className="text-[8px] text-muted-foreground">W</span>
                  )}
                </div>
              </td>
              {isTranseptBand ? (
                <td
                  className="border-b border-neutral-200 p-0 align-middle dark:border-neutral-700"
                  colSpan={3}
                  title={`Row ${n}`}
                >
                  <div className="flex min-h-[1.5rem] items-center justify-center border-y border-dashed border-neutral-300 dark:border-neutral-600">
                    <span className="text-[9px] text-muted-foreground">{transeptLabel}</span>
                  </div>
                </td>
              ) : (
                <>
                  <td className="border-b border-neutral-200 p-0 align-middle dark:border-neutral-700">
                    {w ? (
                      <MapGridCell
                        section={w.section}
                        row={w.row}
                        partFilter={partFilter}
                        showRails={showRails}
                        projectSlug={projectSlug}
                      />
                    ) : (
                      <div className="min-h-[8px]" aria-hidden />
                    )}
                  </td>
                  <td
                    className={`border-x border-dashed border-neutral-300 p-0 align-middle dark:border-neutral-600 ${
                      alignment === "outer" ? "min-w-[4rem] w-[4rem]" : "w-[1.5rem]"
                    }`}
                  >
                    <div className="min-h-[8px]" aria-hidden />
                  </td>
                  <td className="border-b border-neutral-200 p-0 align-middle dark:border-neutral-700">
                    {e ? (
                      <MapGridCell
                        section={e.section}
                        row={e.row}
                        partFilter={partFilter}
                        showRails={showRails}
                        projectSlug={projectSlug}
                      />
                    ) : (
                      <div className="min-h-[8px]" aria-hidden />
                    )}
                  </td>
                </>
              )}
              <td className="border-x border-dashed border-neutral-300 p-0 align-middle dark:border-neutral-600">
                <div className="flex min-h-[8px] flex-col items-center justify-center">
                  {n === firstRowN && (
                    <span className="text-[8px] text-muted-foreground">E</span>
                  )}
                </div>
              </td>
              <td className="border-b border-neutral-200 p-0 align-middle dark:border-neutral-700">
                {eo ? (
                  <MapGridCell
                    section={eo.section}
                    row={eo.row}
                    partFilter={partFilter}
                    showRails={showRails}
                    projectSlug={projectSlug}
                  />
                ) : (
                  <div className="min-h-[8px]" aria-hidden />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
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
  pewMapUseRowGrid = false,
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
  /** When true, render nave / transept / rear / outer as one row-aligned table. */
  pewMapUseRowGrid?: boolean;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [partFilter, setPartFilter] = useState<string>(() =>
    defaultPartFilter(searchParams.get("part"), partNames, sections),
  );

  useEffect(() => {
    const param = searchParams.get("part");
    if (!param) return;
    const match = partNames.find(
      (n) => n === param || n.toLowerCase().replace(/\s+/g, "-") === param,
    );
    if (match && match !== partFilter) {
      setPartFilter(match);
    }
  }, [searchParams, partNames, partFilter]);
  const sectionGroups = groupSections(sections);

  const allHardware = sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers)
    .flatMap((k) => kneelerHardware(k))
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
              onChange={(e) => {
                const v = e.target.value;
                setPartFilter(v);
                const params = new URLSearchParams(searchParams.toString());
                params.set("part", v.toLowerCase().replace(/\s+/g, "-"));
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
              }}
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

          {/* Church body — row-aligned table or group-by-group blocks */}
          {pewMapUseRowGrid && !hideChurchFrame ? (
            <ChurchAlignedPewTable
              sections={sections}
              partFilter={partFilter}
              showRails={showRails}
              projectSlug={projectSlug}
              transeptGridRow={project?.layout.transeptGridRow ?? 9}
            />
          ) : (
          <div className="flex flex-col gap-2">
            {sectionGroups.map((group, gi) => {
              const fullSection = group.find((s) => s.side === "full");

              // Cross aisle (transept) — only across aisles + west/east (not westOuter/eastOuter)
              if (fullSection?.type === "crossAisle") {
                return (
                  <div key={`group-${gi}`} className="flex items-stretch gap-0">
                    <div className="min-w-0" style={{ flex: 0.4 }} aria-hidden />
                    <div className="w-6 shrink-0 border-x border-dashed border-neutral-300 dark:border-neutral-600 flex flex-col items-center">
                      {gi === 0 && (
                        <span className="text-[8px] text-muted-foreground mt-1">W</span>
                      )}
                    </div>
                    <div className="flex-[3] flex min-w-0 items-stretch">
                      <div className="flex min-h-[1.5rem] min-w-0 flex-1 items-center justify-center border-y border-dashed border-neutral-300 dark:border-neutral-600">
                        <span className="text-[9px] text-muted-foreground">{fullSection.label}</span>
                      </div>
                    </div>
                    <div className="w-6 shrink-0 border-x border-dashed border-neutral-300 dark:border-neutral-600 flex flex-col items-center">
                      {gi === 0 && (
                        <span className="text-[8px] text-muted-foreground mt-1">E</span>
                      )}
                    </div>
                    <div className="min-w-0" style={{ flex: 0.4 }} aria-hidden />
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
          )}

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
