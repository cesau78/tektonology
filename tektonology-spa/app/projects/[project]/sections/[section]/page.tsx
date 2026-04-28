import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject, listProjectSectionStaticParams } from "@/lib/project-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PewMap } from "../../pew-map";
import { SectionRowsPanel } from "../../section-rows-panel";
import { kneelerHardware } from "@/lib/pew-layout";

export function generateStaticParams() {
  return listProjectSectionStaticParams();
}

function partNamesForProject(project: NonNullable<ReturnType<typeof getProject>>) {
  return Array.from(
    new Set(
      project.layout.sections
        .flatMap((s) => s.rows)
        .flatMap((r) => r.kneelers)
        .flatMap((k) => kneelerHardware(k))
        .map((h) => h.name),
    ),
  ).sort();
}

export default async function ProjectSectionPage({
  params,
}: {
  params: Promise<{ project: string; section: string }>;
}) {
  const { project: projectId, section: sectionId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const section = project.layout.sections.find((s) => s.id === sectionId);
  if (!section || section.type === "crossAisle") notFound();

  const partNames = partNamesForProject(project);

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}/`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; {project.name}
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2 mb-1">{section.label}</h1>
        <p className="text-muted-foreground text-sm">
          {project.church}
          {section.side === "full"
            ? " · Full width"
            : ` · ${section.side.charAt(0).toUpperCase() + section.side.slice(1)} side`}
          {section.alignment !== "full" &&
            ` · ${section.alignment === "outer" ? "Outer" : "Nave"} aligned`}
        </p>
      </div>

      <Suspense fallback={null}>
        <PewMap
          churchName={project.church}
          orientation={project.layout.orientation}
          sections={[section]}
          partNames={partNames}
          showRails
          hideChurchFrame
          project={project}
          exportSectionId={sectionId}
        />
      </Suspense>

      <Card className="mt-6 mb-6">
        <CardHeader>
          <CardTitle className="text-base">Rows, kneelers, and parts</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Open a row for pew and rail layout; open each kneeler for hardware quantities and status.
            Use the map above to export an Excel layout for the selected part.
          </p>
        </CardHeader>
        <CardContent>
          <SectionRowsPanel section={section} partNames={partNames} />
        </CardContent>
      </Card>
    </div>
  );
}
