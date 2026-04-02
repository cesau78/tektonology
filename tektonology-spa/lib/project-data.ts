import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Project } from "@/data/types";

export function getProject(id: string): Project | undefined {
  const filePath = join(process.cwd(), "data", "projects", `${id}.json`);
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Project;
  } catch {
    return undefined;
  }
}

export function listProjectJsonSlugs(): string[] {
  const dir = join(process.cwd(), "data", "projects");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/** For static export: project + section id (excludes cross-aisle-only sections). */
export function listProjectSectionStaticParams(): { project: string; section: string }[] {
  const params: { project: string; section: string }[] = [];
  for (const id of listProjectJsonSlugs()) {
    const p = getProject(id);
    if (!p) continue;
    for (const s of p.layout.sections) {
      if (s.type === "crossAisle") continue;
      params.push({ project: id, section: s.id });
    }
  }
  return params;
}
