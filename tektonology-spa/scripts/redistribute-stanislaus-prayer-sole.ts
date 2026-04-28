/**
 * Re-run Prayer Sole upcoming date packing in church row-major order.
 * Usage (from repo `tektonology-spa`): npx --yes tsx scripts/redistribute-stanislaus-prayer-sole.ts
 */
import fs from "node:fs";
import path from "node:path";
import type { PewSection } from "../data/types";
import {
  PRAYER_SOLE_DEFAULT_TOTAL_UPCOMING_QUANTITY,
  redistributeUpcomingPrayerSoleDates,
  reselectUpcomingPrayerSoleInRowMajorOrder,
} from "../lib/prayer-sole-install-schedule";

const projectPath = path.join(process.cwd(), "data/projects/saint-stanislaus.json");

const raw = fs.readFileSync(projectPath, "utf8");
const project = JSON.parse(raw) as {
  layout: { sections: PewSection[]; transeptGridRow?: number };
};

const transept = project.layout.transeptGridRow ?? 10;
reselectUpcomingPrayerSoleInRowMajorOrder(project.layout.sections, {
  retainQuantity: PRAYER_SOLE_DEFAULT_TOTAL_UPCOMING_QUANTITY,
  transeptGridRow: transept,
});
redistributeUpcomingPrayerSoleDates(project.layout.sections, { transeptGridRow: transept });

fs.writeFileSync(projectPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
console.log(
  "Updated",
  projectPath,
  `reselect ${PRAYER_SOLE_DEFAULT_TOTAL_UPCOMING_QUANTITY} upcoming (row-major, 3 sessions) + redistribute, transeptGridRow=`,
  transept,
);
