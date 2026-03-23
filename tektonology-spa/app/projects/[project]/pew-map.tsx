"use client";

import { useState } from "react";
import type {
  PewSection,
  PewRow,
  Kneeler,
  HardwareStatus,
  ChurchOrientation,
} from "@/data/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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

function kneelerStatus(kneeler: Kneeler, partFilter: string | null): HardwareStatus | "none" {
  const items = partFilter
    ? kneeler.hardware.filter((h) => h.name === partFilter)
    : kneeler.hardware;
  if (items.length === 0) return partFilter ? "none" : "unknown";
  const statuses = items.map((h) => h.status);
  if (statuses.every((s) => s === "installed")) return "installed";
  if (statuses.some((s) => s === "installed" || s === "upcoming")) return "upcoming";
  if (statuses.some((s) => s === "needed")) return "needed";
  return "unknown";
}

function sectionStats(section: PewSection) {
  const allKneelers = section.rows.flatMap((r) => r.kneelers);
  const allHardware = allKneelers.flatMap((k) => k.hardware);
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

function KneelerSegments({ kneelers, partFilter }: { kneelers: Kneeler[]; partFilter: string | null }) {
  return (
    <div className="flex gap-px">
      {kneelers.map((k) => {
        const status = kneelerStatus(k, partFilter);
        return (
          <div
            key={k.id}
            className={`rounded-sm h-2 border ${kneelerColors[status]}`}
            style={{ flex: k.capacity }}
          />
        );
      })}
    </div>
  );
}

function RowStrip({ row, partFilter }: { row: PewRow; partFilter: string | null }) {
  return (
    <div className="flex flex-col gap-0">
      <div className={`bg-neutral-600 dark:bg-neutral-400 h-[5px] ${row.kneelers.length > 0 ? "rounded-t-sm" : "rounded-sm"}`} />
      {row.kneelers.length > 0 && <KneelerSegments kneelers={row.kneelers} partFilter={partFilter} />}
    </div>
  );
}

function SectionMapBlock({
  section,
  partFilter,
}: {
  section: PewSection;
  partFilter: string | null;
}) {
  const stats = sectionStats(section);
  return (
    <a href={`#${section.id}`} className="block group flex-1 min-w-0">
      <div className="border rounded-lg p-1.5 group-hover:border-amber-300 transition-colors h-full">
        <div className="text-[9px] text-muted-foreground mb-1 truncate">
          {section.label}{" "}
          <span className="text-[8px]">
            {section.rows.length}r &middot; {stats.kneelers}k &middot;{" "}
            {stats.pct}%
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {section.rows.map((row) => (
            <RowStrip key={row.id} row={row} partFilter={partFilter} />
          ))}
        </div>
      </div>
    </a>
  );
}

export function PewMap({
  churchName,
  orientation,
  sections,
  partNames,
}: {
  churchName: string;
  orientation: ChurchOrientation;
  sections: PewSection[];
  partNames: string[];
}) {
  const [partFilter, setPartFilter] = useState<string | null>(null);
  const sectionGroups = groupSections(sections);

  const allHardware = sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers)
    .flatMap((k) => k.hardware)
    .filter((h) => partFilter === null || h.name === partFilter);
  const installedCount = allHardware
    .filter((h) => h.status === "installed")
    .reduce((s, h) => s + h.quantity, 0);
  const neededCount = allHardware
    .filter((h) => h.status === "needed")
    .reduce((s, h) => s + h.quantity, 0);
  const trackable = installedCount + neededCount;
  const pct = trackable > 0 ? Math.round((installedCount / trackable) * 100) : 0;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{churchName}</CardTitle>
          <select
            className="text-xs border rounded px-2 py-1 bg-background text-foreground"
            value={partFilter ?? ""}
            onChange={(e) => setPartFilter(e.target.value || null)}
          >
            <option value="">All Parts</option>
            {partNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-3 text-center">
          {installedCount} / {trackable} installed ({pct}%)
        </div>
        <div className="relative">
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
            <div className="text-xs text-muted-foreground text-center">
              Altar
            </div>
          </div>

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
                      <SectionMapBlock section={fullSection} partFilter={partFilter} />
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
                      <SectionMapBlock section={westOuter} partFilter={partFilter} />
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
                          <SectionMapBlock section={westSection} partFilter={partFilter} />
                        )}
                        <div className="w-16 shrink-0" />
                        {eastSection && (
                          <SectionMapBlock section={eastSection} partFilter={partFilter} />
                        )}
                      </>
                    ) : (
                      <>
                        {westSection && (
                          <SectionMapBlock section={westSection} partFilter={partFilter} />
                        )}
                        {/* Nave */}
                        <div className="w-6 shrink-0 border-x border-dashed border-neutral-300 dark:border-neutral-600" />
                        {eastSection && (
                          <SectionMapBlock section={eastSection} partFilter={partFilter} />
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
                      <SectionMapBlock section={eastOuter} partFilter={partFilter} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Entrance */}
          <div className="flex justify-center mt-4">
            <div className="text-xs text-muted-foreground">
              &darr; Entrance
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
