import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { HardwareStatus, Project } from "@/data/types";
import { getProject, listProjectJsonSlugs } from "@/lib/project-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PewMap } from "./pew-map";
import { kneelerHardware } from "@/lib/pew-layout";

export function generateStaticParams() {
  return listProjectJsonSlugs().map((project) => ({ project }));
}

function getInventorySummary(project: Project) {
  const allHardware = project.layout.sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers)
    .flatMap((k) => kneelerHardware(k));

  const emptyCounts = (): Record<HardwareStatus, number> => ({
    unknown: 0,
    inspected: 0,
    needed: 0,
    upcoming: 0,
    installed: 0,
  });
  const byPart = new Map<string, Record<HardwareStatus, number>>();
  for (const h of allHardware) {
    const entry = byPart.get(h.name) ?? emptyCounts();
    entry[h.status] += h.quantity;
    byPart.set(h.name, entry);
  }

  return Array.from(byPart.entries())
    .map(([name, counts]) => ({
      name,
      ...counts,
      total:
        counts.unknown +
        counts.needed +
        counts.upcoming +
        counts.installed +
        counts.inspected,
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
        .flatMap((k) => kneelerHardware(k))
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

      <Suspense fallback={null}>
        <PewMap
          churchName={project.church}
          orientation={orientation}
          sections={sections}
          partNames={partNames}
          showRails={false}
          projectSlug={projectId}
          project={project}
          pewMapUseRowGrid={project.layout.pewMapUseRowGrid ?? false}
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
                  <th className="pb-2 font-medium text-right">Inspected</th>
                  <th className="pb-2 font-medium text-right">Needed</th>
                  <th className="pb-2 font-medium text-right">Upcoming</th>
                  <th className="pb-2 font-medium text-right">Installed</th>
                  <th className="pb-2 font-medium text-right">Unknown</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.name} className="border-b border-border/50">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 text-right">{row.total}</td>
                    <td className="py-2 text-right">
                      {row.inspected > 0 && (
                        <Badge className="bg-teal-100 text-teal-900 border-teal-300 hover:bg-teal-100 text-xs">
                          {row.inspected}
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
                    <td className="py-2 text-right">
                      {row.unknown > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {row.unknown}
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
