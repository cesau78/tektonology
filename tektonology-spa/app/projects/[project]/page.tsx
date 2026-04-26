import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Project, HardwareStatus } from "@/data/types";
import { getProject, listProjectJsonSlugs } from "@/lib/project-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportPewLayoutButton } from "@/components/export-pew-layout-button";
import { PewMap } from "./pew-map";

export function generateStaticParams() {
  return listProjectJsonSlugs().map((project) => ({ project }));
}

const statusLabels: Record<HardwareStatus, string> = {
  unknown: "Unknown",
  needed: "Parts Needed",
  upcoming: "Upcoming",
  installed: "Installed",
};

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
        <ExportPewLayoutButton
          project={project}
          label="Download pew layout (Excel)"
          hint="One sheet per section; one row per church row; pews are merged across narrow columns (capacity ×3 units, rounded; 1p width = 8); section boxes"
        />
      </div>

      <div className="mb-4">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
          Map (selected part)
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Kneeler strips show status for the part chosen in the map card. Click a section to open rows,
          kneelers, and hardware on the section page.
        </p>
        <div className="flex flex-wrap gap-4">
          {(["needed", "upcoming", "installed"] as const).map((status) => (
            <div
              key={status}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <div
                className={`w-6 h-2 rounded-sm border ${
                  status === "needed"
                    ? "bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700"
                    : status === "upcoming"
                      ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700"
                      : "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700"
                }`}
              />
              {statusLabels[status]}
            </div>
          ))}
        </div>
      </div>

      <Suspense fallback={null}>
        <PewMap
          churchName={project.church}
          orientation={orientation}
          sections={sections}
          partNames={partNames}
          showRails={false}
          projectSlug={projectId}
        />
      </Suspense>

      <Card className="mb-6 mt-6">
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
