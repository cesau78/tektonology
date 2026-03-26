import { describe, it, expect } from "vitest";
import { isFeatureEnabled } from "./features";
import type { FeatureFlag } from "./features";

describe("isFeatureEnabled", () => {
  it("returns true when the role is in the allowed list", () => {
    expect(isFeatureEnabled("newProducts", "owner")).toBe(true);
    expect(isFeatureEnabled("newProjects", "owner")).toBe(true);
    expect(isFeatureEnabled("sales", "owner")).toBe(true);
  });

  it("returns false when the role is not in the allowed list", () => {
    expect(isFeatureEnabled("newProducts", "member")).toBe(false);
    expect(isFeatureEnabled("newProducts", "anonymous")).toBe(false);
    expect(isFeatureEnabled("sales", "auditor")).toBe(false);
  });

  it("returns false for an unknown flag via nullish coalescing fallback", () => {
    const bogusFlag = "nonExistentFlag" as FeatureFlag;
    expect(isFeatureEnabled(bogusFlag, "owner")).toBe(false);
  });
});
