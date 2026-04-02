import { describe, it, expect } from "vitest";
import { restorationPhaseWorkflowLoop } from "./restoration-phase-workflow-loop";
import type { LifecyclePhaseDetail } from "@/data/types";

const phase: LifecyclePhaseDetail = {
  label: "Spot",
  description: "Spot summary.",
  subItems: [
    { title: "Identify", description: "A." },
    { title: "Tag", description: "B." },
  ],
};

describe("restorationPhaseWorkflowLoop", () => {
  it("maps subItems to ring phaseDetails", () => {
    const loop = restorationPhaseWorkflowLoop(phase);
    expect(loop.title).toBe("Spot");
    expect(loop.centerNote).toBe("Spot summary.");
    expect(loop.phaseDetails.map((p) => p.label)).toEqual(["Identify", "Tag"]);
  });
});
