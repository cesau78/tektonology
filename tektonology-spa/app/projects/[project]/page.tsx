import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import type {
  Project,
  PewSection,
  PewRow,
  Kneeler,
  HardwareStatus,
} from "@/data/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const statuses = kneeler.hardware.map((h) => h.status);
  if (statuses.every((s) => s === "installed")) return "installed";
  if (statuses.some((s) => s === "installed" || s === "printed")) return "printed";
  return "needed";
}

const kneelerColors: Record<HardwareStatus, string> = {
  needed:
    "bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600",
  printed:
    "bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700",
  installed:
    "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700",
};

const statusLabels: Record<HardwareStatus, string> = {
  needed: "Parts Needed",
  printed: "In Progress",
  installed: "Installed",
};

const frontTypeLabels: Record<string, string> = {
  communionRail: "Communion Rail",
  pew: "Pew",
};

const compassFull: Record<string, string> = {
  N: "North",
  S: "South",
  E: "East",
  W: "West",
};

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

function getInventorySummary(project: Project) {
  const allHardware = project.layout.sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers)
    .flatMap((k) => k.hardware);

  const byPart = new Map<
    string,
    { needed: number; printed: number; installed: number }
  >();
  for (const h of allHardware) {
    const entry = byPart.get(h.name) ?? { needed: 0, printed: 0, installed: 0 };
    entry[h.status] += h.quantity;
    byPart.set(h.name, entry);
  }

  return Array.from(byPart.entries())
    .map(([name, counts]) => ({
      name,
      ...counts,
      total: counts.needed + counts.printed + counts.installed,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Group sections by their group number for side-by-side rendering
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

// --- components ---

function KneelerSegments({ kneelers }: { kneelers: Kneeler[] }) {
  return (
    <div className="flex gap-px">
      {kneelers.map((k) => {
        const status = kneelerStatus(k);
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

function RowStrip({ row }: { row: PewRow }) {
  return (
    <div className="flex flex-col gap-0">
      <div className={`bg-neutral-600 dark:bg-neutral-400 h-[5px] ${row.kneelers.length > 0 ? "rounded-t-sm" : "rounded-sm"}`} />
      {row.kneelers.length > 0 && <KneelerSegments kneelers={row.kneelers} />}
    </div>
  );
}


function SectionMapBlock({
  section,
  projectId,
}: {
  section: PewSection;
  projectId: string;
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
            <RowStrip key={row.id} row={row} />
          ))}
        </div>
      </div>
    </a>
  );
}

function KneelerHardwareTable({ kneeler }: { kneeler: Kneeler }) {
  return (
    <div className="px-2 pb-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left pb-1 font-medium">Part</th>
            <th className="text-right pb-1 font-medium">Qty</th>
            <th className="text-right pb-1 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {kneeler.hardware.map((h, hi) => (
            <tr key={hi} className="border-b border-border/30">
              <td className="py-1">{h.name}</td>
              <td className="py-1 text-right">{h.quantity}</td>
              <td className="py-1 text-right">
                <Badge
                  className={`text-[10px] ${
                    h.status === "installed"
                      ? "bg-green-100 text-green-900 border-green-300 hover:bg-green-100"
                      : h.status === "printed"
                        ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100"
                        : "bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                  }`}
                >
                  {h.status}
                </Badge>
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
  const { orientation, aisles, sections } = project.layout;
  const sectionGroups = groupSections(sections);

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
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-8 h-3 rounded-sm bg-neutral-600 dark:bg-neutral-400" />
          Pew / Rail
        </div>
        {(["needed", "printed", "installed"] as HardwareStatus[]).map(
          (status) => (
            <div
              key={status}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <div
                className={`w-6 h-2 rounded-sm border ${kneelerColors[status]}`}
              />
              {statusLabels[status]}
            </div>
          ),
        )}
      </div>

      {/* Pew Map */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Pew Map</CardTitle>
        </CardHeader>
        <CardContent>
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
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg px-12 py-2 text-xs font-medium text-amber-800 dark:text-amber-200 text-center">
                Altar ({compassFull[orientation.altar]})
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
                        <SectionMapBlock section={fullSection} projectId={projectId} />
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
                const hasOuter = westOuter || eastOuter;

                return (
                  <div key={`group-${gi}`} className="flex items-stretch gap-0">
                    {/* West Outer — or spacer to keep alignment */}
                    <div className="min-w-0" style={{ flex: 0.4 }}>
                      {westOuter && (
                        <SectionMapBlock section={westOuter} projectId={projectId} />
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
                            <SectionMapBlock section={westSection} projectId={projectId} />
                          )}
                          <div className="w-16 shrink-0" />
                          {eastSection && (
                            <SectionMapBlock section={eastSection} projectId={projectId} />
                          )}
                        </>
                      ) : (
                        <>
                          {westSection && (
                            <SectionMapBlock section={westSection} projectId={projectId} />
                          )}
                          {/* Nave */}
                          <div className="w-6 shrink-0 border-x border-dashed border-neutral-300 dark:border-neutral-600" />
                          {eastSection && (
                            <SectionMapBlock section={eastSection} projectId={projectId} />
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
                        <SectionMapBlock section={eastOuter} projectId={projectId} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Entrance */}
            <div className="flex justify-center mt-4">
              <div className="text-xs text-muted-foreground">
                &darr; Entrance ({compassFull[orientation.entrance]})
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              const installedParts = row.kneelers
                .flatMap((k) => k.hardware)
                .filter((h) => h.status === "installed")
                .reduce((s, h) => s + h.quantity, 0);

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
                      {row.kneelers.length} kneelers &middot; {installedParts}/
                      {totalParts} parts
                    </span>
                  </summary>
                  <div className="px-3 pb-3 space-y-3">
                    {/* Proportional row map */}
                    <div className="flex items-center gap-px border rounded p-2">
                      {row.kneelers.map((kneeler, ki) => {
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
                            title={`${kneeler.capacity}p — ${inst}/${total} parts`}
                          >
                            <span className="text-[8px] text-muted-foreground">
                              {kneeler.capacity}p
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Kneeler details */}
                    <div className="space-y-1">
                      {row.kneelers.map((kneeler, ki) => {
                        const total = kneeler.hardware.reduce(
                          (s, h) => s + h.quantity,
                          0,
                        );
                        const inst = kneeler.hardware
                          .filter((h) => h.status === "installed")
                          .reduce((s, h) => s + h.quantity, 0);
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
                                {inst}/{total}
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
                  <th className="pb-2 font-medium text-right">Needed</th>
                  <th className="pb-2 font-medium text-right">Printed</th>
                  <th className="pb-2 font-medium text-right">Installed</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.name} className="border-b border-border/50">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 text-right">{row.total}</td>
                    <td className="py-2 text-right">
                      {row.needed > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {row.needed}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.printed > 0 && (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100 text-xs">
                          {row.printed}
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
