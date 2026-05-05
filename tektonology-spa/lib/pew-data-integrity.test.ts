import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import type { Project } from "@/data/types";
import { parseMapRowNumber } from "./pew-map-grid";

const PROJECTS_DIR = path.resolve(__dirname, "../data/projects");

/** Expected kneeler-ID prefix for each section id (convention: first letters of section words). */
const SECTION_PREFIX: Record<string, string> = {
  "west-main": "wm-",
  "east-main": "em-",
  "west-rear": "wr-",
  "east-rear": "er-",
  "west-outer": "wo-",
  "east-outer": "eo-",
};

function loadProjects(): Project[] {
  const files = readdirSync(PROJECTS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => JSON.parse(readFileSync(path.join(PROJECTS_DIR, f), "utf8")) as Project);
}

describe("pew project data integrity", () => {
  const projects = loadProjects();

  for (const project of projects) {
    const gridSections = project.layout.sections.filter(
      (s) => s.type !== "crossAisle" && s.side !== "full",
    );

    describe(project.id, () => {
      it("no row number appears in more than one group per side", () => {
        const sides = [...new Set(gridSections.map((s) => s.side))];
        const violations: string[] = [];

        for (const side of sides) {
          const sectionsForSide = gridSections.filter((s) => s.side === side);
          const seen = new Map<number, { sectionId: string; group: number }>();

          for (const sec of sectionsForSide) {
            for (const row of sec.rows) {
              const n = parseMapRowNumber(row);
              if (n == null) continue;
              const prev = seen.get(n);
              if (prev && prev.group !== sec.group) {
                violations.push(
                  `Row ${n} on side "${side}" exists in group ${prev.group} (${prev.sectionId}) AND group ${sec.group} (${sec.id})`,
                );
              } else if (!prev) {
                seen.set(n, { sectionId: sec.id, group: sec.group });
              }
            }
          }
        }

        expect(violations, "Duplicate rows across groups:\n" + violations.join("\n")).toEqual([]);
      });

      it("kneeler ID prefixes match their owning section", () => {
        const violations: string[] = [];

        for (const sec of gridSections) {
          const expectedPrefix = SECTION_PREFIX[sec.id];
          if (!expectedPrefix) continue;

          for (const row of sec.rows) {
            for (const k of row.kneelers) {
              if (!k.id.startsWith(expectedPrefix)) {
                violations.push(
                  `Kneeler "${k.id}" in section "${sec.id}" (${row.label}) should start with "${expectedPrefix}"`,
                );
              }
            }
          }
        }

        expect(violations, "Misplaced kneeler IDs:\n" + violations.join("\n")).toEqual([]);
      });
    });
  }
});
