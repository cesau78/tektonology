import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LifecycleRing } from "./maintenance-lifecycle-cycle";

const baseLoop = {
  title: "Test loop",
  centerEyebrow: "Eyebrow",
  centerNote: "Center note.",
  phaseDetails: [
    { label: "Make", description: "", subItems: [] },
    { label: "TenPlusChars", description: "", subItems: [] },
  ],
};

afterEach(cleanup);

describe("LifecycleRing", () => {
  it("uses smaller node font when any step label exceeds 9 characters", () => {
    const { container } = render(<LifecycleRing loop={baseLoop} variant="planning" markerId="m-long" />);
    expect(container.innerHTML).toContain("text-[10px]");
  });

  it("uses default node font when all step labels are short", () => {
    const shortLoop = {
      ...baseLoop,
      phaseDetails: [
        { label: "A", description: "", subItems: [] },
        { label: "B", description: "", subItems: [] },
      ],
    };
    const { container } = render(<LifecycleRing loop={shortLoop} variant="restoration" markerId="m-short" />);
    expect(container.innerHTML).toContain("text-[11px]");
  });
});
