import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import type {
  Project,
  Kneeler,
  HardwareStatus,
} from "@/data/types";
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

// --- components ---

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
      <PewMap
        churchName={project.church}
        orientation={orientation}
        sections={sections}
        partNames={partNames}
      />

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
                      {row.kneelers.map((kneeler) => {
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
