import Link from "next/link";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { Project } from "@/data/types";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function getProjects(): Project[] {
  const dir = join(process.cwd(), "data", "projects");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Project)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getProjectStats(project: Project) {
  const allKneelers = project.layout.sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers);
  const allHardware = allKneelers.flatMap((k) => k.hardware);
  const totalParts = allHardware.reduce((sum, h) => sum + h.quantity, 0);
  const installedParts = allHardware
    .filter((h) => h.status === "installed")
    .reduce((sum, h) => sum + h.quantity, 0);
  const totalRows = project.layout.sections.reduce(
    (s, sec) => s + sec.rows.length,
    0,
  );
  return {
    totalSections: project.layout.sections.length,
    totalRows,
    totalKneelers: allKneelers.length,
    totalParts,
    installedParts,
  };
}

export default function ProjectsPage() {
  const projects = getProjects();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Projects</h1>
        <p className="text-muted-foreground text-sm">
          Church restoration projects — track pew maps, hardware, and
          installation progress.
        </p>
      </div>

      <div className="grid gap-3">
        {projects.map((project) => {
          const stats = getProjectStats(project);
          const pct =
            stats.totalParts > 0
              ? Math.round((stats.installedParts / stats.totalParts) * 100)
              : 0;

          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="bg-card shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100">
                      {pct}% installed
                    </Badge>
                  </div>
                  <CardDescription>{project.church}</CardDescription>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span>{stats.totalSections} sections</span>
                    <span>{stats.totalRows} rows</span>
                    <span>{stats.totalKneelers} kneelers</span>
                    <span>{stats.totalParts} parts</span>
                    <span>{stats.installedParts} installed</span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
