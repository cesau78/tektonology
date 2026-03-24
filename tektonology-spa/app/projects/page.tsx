import Link from "next/link";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Project, Product, HardwareItem } from "@/data/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProductThumbnail } from "@/components/product-thumbnail";

function getProjects(): Project[] {
  const dir = join(process.cwd(), "data", "projects");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Project)
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface PartStats {
  partId: string;
  name: string;
  total: number;
  installed: number;
  needed: number;
  upcoming: number;
  product: Product | null;
}

function getProjectStats(project: Project) {
  const allKneelers = project.layout.sections
    .flatMap((s) => s.rows)
    .flatMap((r) => r.kneelers);
  const allHardware = allKneelers.flatMap((k) => k.hardware);
  const totalRows = project.layout.sections.reduce(
    (s, sec) => s + sec.rows.length,
    0,
  );

  const byPart: Record<string, { name: string; items: HardwareItem[] }> = {};
  for (const h of allHardware) {
    if (!byPart[h.partId]) {
      byPart[h.partId] = { name: h.name, items: [] };
    }
    byPart[h.partId].items.push(h);
  }

  const partStats: PartStats[] = Object.entries(byPart)
    .filter(([, { items }]) => items.some((h) => h.status === "needed"))
    .map(([partId, { name, items }]) => ({
      partId,
      name,
      total: items.reduce((s, h) => s + h.quantity, 0),
      installed: items.filter((h) => h.status === "installed").reduce((s, h) => s + h.quantity, 0),
      needed: items.filter((h) => h.status === "needed").reduce((s, h) => s + h.quantity, 0),
      upcoming: items.filter((h) => h.status === "upcoming").reduce((s, h) => s + h.quantity, 0),
      product: getProduct(partId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    totalSections: project.layout.sections.length,
    totalRows,
    totalKneelers: allKneelers.length,
    partStats,
  };
}

function getProduct(id: string): Product | null {
  const filePath = join(process.cwd(), "data", "products", `${id}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8")) as Product;
}

function tokenize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
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

          return (
            <Card key={project.id} className="bg-card shadow-sm">
              <CardHeader>
                <Link href={`/projects/${project.id}`} className="hover:underline">
                  <CardTitle className="text-base">{project.name}</CardTitle>
                </Link>
                <CardDescription>{project.church}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                  <span>{stats.totalSections} sections</span>
                  <span>{stats.totalRows} rows</span>
                  <span>{stats.totalKneelers} kneelers</span>
                </div>

                {stats.partStats.length > 0 && (
                  <div className="space-y-4 border-t pt-4 divide-y">
                    {stats.partStats.map((part, i) => {
                      const pct = part.total > 0 ? Math.round((part.installed / part.total) * 100) : 0;
                      return (
                        <div key={part.partId} className={`flex gap-4 items-start ${i > 0 ? "pt-4" : ""}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <Link
                                href={`/projects/${project.id}?part=${tokenize(part.name)}`}
                                className="text-sm font-medium text-foreground hover:underline"
                              >
                                {part.name}
                              </Link>
                              <span className="text-sm font-bold text-foreground">{pct}%</span>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex-1 h-2 rounded-full bg-neutral-200 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-green-500 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {part.installed} / {part.total} units installed
                            </span>
                          </div>

                          <div className="shrink-0 flex flex-col items-center gap-1">
                            {part.product && (
                              <Link href={`/products/${part.partId}`}>
                                <ProductThumbnail product={part.product} />
                              </Link>
                            )}
                            <Link
                              href={`/projects/${project.id}?part=${tokenize(part.name)}`}
                              className="text-[10px] text-amber-700 hover:text-amber-900 hover:underline transition-colors"
                            >
                              Installation Map
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
