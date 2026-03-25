"use client";

import type { Role } from "@/lib/auth";

export type FeatureFlag = "newProducts" | "newProjects" | "sales";

/**
 * Feature flags — controls which roles can see each feature.
 * A feature is enabled when the user's role is in the allowed list.
 */
const FLAGS: Record<FeatureFlag, Role[]> = {
  newProducts: ["owner"],
  newProjects: ["owner"],
  sales: ["owner"],
};

export function isFeatureEnabled(flag: FeatureFlag, role: Role): boolean {
  return FLAGS[flag]?.includes(role) ?? false;
}
