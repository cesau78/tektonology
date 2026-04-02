import { readFileSync } from "fs";
import { join } from "path";
import type { MaintenanceLifecycle } from "@/data/types";

export function getMaintenanceLifecycle(): MaintenanceLifecycle {
  const filePath = join(process.cwd(), "data", "site", "maintenanceLifecycle.json");
  return JSON.parse(readFileSync(filePath, "utf-8")) as MaintenanceLifecycle;
}
