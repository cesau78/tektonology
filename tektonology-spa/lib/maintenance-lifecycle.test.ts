import { describe, it, expect } from "vitest";
import { getMaintenanceLifecycle } from "./maintenance-lifecycle";

describe("getMaintenanceLifecycle", () => {
  it("reads and parses maintenance lifecycle JSON", () => {
    const data = getMaintenanceLifecycle();
    expect(data.title).toBeTruthy();
    expect(data.restorationLoop.phaseDetails.length).toBeGreaterThan(0);
    expect(data.planningLoop.phaseDetails.length).toBeGreaterThan(0);
  });
});
