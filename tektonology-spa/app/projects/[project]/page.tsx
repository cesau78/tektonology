import { Suspense } from "react";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import type {
  Project,
  Kneeler,
  HardwareStatus,
  PewSection,
  PewRow,
} from "@/data/types";
import {
  pewRailColorClass,
  isPillarKneeler,
  pewBenchSegmentsFromKneelers,
  pewBenchSegmentsFromContinuation,
} from "@/lib/pew-layout";
import { PillarGapLabel } from "@/components/pillar-gap-label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PewMap } from "./pew-map";

function getProject(id: string): Project | undefined {
  const filePath = join(process.cwd(), "data", "projects", `${id}.json`);
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Project;
  } catch {
    return undefined;
  }
}

export function generateStaticParams() {
  const dir = join(process.cwd(), "data", "projects");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ project: f.replace(".json", "") }));
}

// --- helpers ---

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

const statusLabels: Record<HardwareStatus, string> = {
  unknown: "Unknown",
  needed: "Parts Needed",
  upcoming: "Upcoming",
  installed: "Installed",
};

const frontTypeLabels: Record<string, string> = {
  communionRail: "Communion Rail",
  pew: "Pew",
};

function pewBenchStripForRow(section: PewSection, row: PewRow) {
  if (row.pillarBenchContinuation) {
    return pewBenchSegmentsFromContinuation(section, row);
  }
  if (row.kneelers.some(isPillarKneeler)) {
    return pewBenchSegmentsFromKneelers(row.kneelers, row.id);
  }
  return null;
}

function getInventorySummary(project: Project) {
  const allHardware = project.layout.sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers)
    .flatMap((k) => k.hardware);

  const byPart = new Map<
    string,
    { unknown: number; needed: number; upcoming: number; installed: number }
  >();
  for (const h of allHardware) {
    const entry = byPart.get(h.name) ?? { unknown: 0, needed: 0, upcoming: 0, installed: 0 };
    entry[h.status] += h.quantity;
    byPart.set(h.name, entry);
  }

  return Array.from(byPart.entries())
    .map(([name, counts]) => ({
      name,
      ...counts,
      total: counts.unknown + counts.needed + counts.upcoming + counts.installed,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// --- components ---

function KneelerHardwareTable({ kneeler }: { kneeler: Kneeler }) {
  if (kneeler.hardware.length === 0) {
    return (
      <p className="px-2 pb-2 text-xs text-muted-foreground">No hardware tracked for this segment.</p>
    );
  }
  return (
    <div className="px-2 pb-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left pb-1 font-medium">Part</th>
            <th className="text-right pb-1 font-medium">Qty</th>
            <th className="text-right pb-1 font-medium">Status</th>
            <th className="text-right pb-1 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {kneeler.hardware.map((h, hi) => (
            <tr key={hi} className="border-b border-border/30">
              <td className="py-1">{h.name}</td>
              <td className="py-1 text-right">{h.quantity}</td>
              <td className="py-1 text-right">
                <Badge
                  className={`text-[10px] w-20 justify-center ${
                    h.status === "installed"
                      ? "bg-green-100 text-green-900 border-green-300 hover:bg-green-100"
                      : h.status === "upcoming"
                        ? "bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-100"
                        : h.status === "needed"
                          ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100"
                          : "bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                  }`}
                >
                  {statusLabels[h.status]}
                </Badge>
              </td>
              <td className="py-1 text-right text-muted-foreground">
                {h.date ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- page ---

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const inventory = getInventorySummary(project);
  const { orientation, sections } = project.layout;
  const partNames = Array.from(
    new Set(
      sections
        .flatMap((s) => s.rows)
        .flatMap((r) => r.kneelers)
        .flatMap((k) => k.hardware)
        .map((h) => h.name),
    ),
  ).sort();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/projects"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Projects
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2 mb-1">
          {project.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {project.church} &mdash; {project.description}
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-4 mb-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
            Pew / Rail
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`w-8 h-3 rounded-sm ${pewRailColorClass}`} />
              Pew / Rail
            </div>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
            Kneeler Parts
          </div>
          <div className="flex flex-wrap gap-4">
            {(["needed", "upcoming", "installed"] as const).map((status) => (
              <div
                key={status}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <div
                  className={`w-6 h-2 rounded-sm border ${kneelerColors[status]}`}
                />
                {statusLabels[status]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pew Map */}
      <Suspense fallback={null}>
        <PewMap
          churchName={project.church}
          orientation={orientation}
          sections={sections}
          partNames={partNames}
        />
      </Suspense>

      {/* Section Details */}
      {sections.filter((s) => s.type !== "crossAisle").map((section) => (
        <Card key={section.id} id={section.id} className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{section.label}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {section.side === "full" ? "Full width" : `${section.side.charAt(0).toUpperCase() + section.side.slice(1)} side`}
                {section.alignment !== "full" &&
                  ` \u00b7 ${section.alignment === "outer" ? "Outer" : "Nave"} aligned`}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {section.rows.map((row) => {
              const totalParts = row.kneelers
                .flatMap((k) => k.hardware)
                .reduce((s, h) => s + h.quantity, 0);
              const benchStrip = pewBenchStripForRow(section, row);

              return (
                <details
                  key={row.id}
                  className="border rounded-lg mb-2 last:mb-0"
                >
                  <summary className="px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {frontTypeLabels[row.frontType]}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {row.kneelers.length} kneelers &middot; {totalParts} parts
                    </span>
                  </summary>
                  <div className="px-3 pb-3 space-y-3">
                    {benchStrip && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Pew / Rail
                        </div>
                        <div className="relative flex items-center gap-px overflow-visible border rounded p-2">
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

                    {/* Proportional kneeler map */}
                    {row.kneelers.length > 0 ? (
                    <div className="flex items-center gap-px border rounded p-2">
                      {row.kneelers.map((kneeler) => {
                        const mapLabel = kneeler.label
                          ? `${kneeler.label} (${kneeler.capacity}p)`
                          : `${kneeler.capacity}p`;
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
                        const total = kneeler.hardware.reduce(
                          (s, h) => s + h.quantity,
                          0,
                        );
                        const inst = kneeler.hardware
                          .filter((h) => h.status === "installed")
                          .reduce((s, h) => s + h.quantity, 0);
                        return (
                          <div
                            key={kneeler.id}
                            className={`rounded border ${kneelerColors[status]} flex items-center justify-center py-1`}
                            style={{ flex: kneeler.capacity }}
                            title={`${mapLabel} — ${inst} of ${total} parts`}
                          >
                            <span className="text-[8px] text-muted-foreground text-center leading-tight px-0.5">
                              {mapLabel}
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

                    {/* Kneeler details */}
                    <div className="space-y-1">
                      {row.kneelers.map((kneeler, ki) => {
                        const partCount = kneeler.hardware.reduce((s, h) => s + h.quantity, 0);
                        return (
                          <details
                            key={kneeler.id}
                            className="border rounded"
                          >
                            <summary className="px-2 py-1 text-xs cursor-pointer hover:bg-muted/50 flex items-center justify-between">
                              <span>
                                {kneeler.label ?? `Kneeler ${ki + 1}`}
                                <span className="text-muted-foreground ml-1">
                                  ({kneeler.capacity}p)
                                </span>
                              </span>
                              <span className="text-muted-foreground">
                                {partCount} parts
                              </span>
                            </summary>
                            <KneelerHardwareTable kneeler={kneeler} />
                          </details>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Parts Inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parts Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Part</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Unknown</th>
                  <th className="pb-2 font-medium text-right">Needed</th>
                  <th className="pb-2 font-medium text-right">Upcoming</th>
                  <th className="pb-2 font-medium text-right">Installed</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.name} className="border-b border-border/50">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 text-right">{row.total}</td>
                    <td className="py-2 text-right">
                      {row.unknown > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {row.unknown}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.needed > 0 && (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100 text-xs">
                          {row.needed}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.upcoming > 0 && (
                        <Badge className="bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-100 text-xs">
                          {row.upcoming}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.installed > 0 && (
                        <Badge className="bg-green-100 text-green-900 border-green-300 hover:bg-green-100 text-xs">
                          {row.installed}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
