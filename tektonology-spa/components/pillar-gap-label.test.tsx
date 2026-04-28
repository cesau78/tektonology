import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PillarGapLabel } from "./pillar-gap-label";

describe("PillarGapLabel", () => {
  afterEach(cleanup);

  it("renders kneeler-height strip (h-2) like map kneeler cells", () => {
    const { container } = render(<PillarGapLabel />);
    expect(container.querySelector(".h-2")).toBeTruthy();
    expect(container.querySelector(".rounded-sm")).toBeTruthy();
    expect(container.querySelector(".bg-neutral-300")).toBeTruthy();
    expect(container.textContent?.trim()).toBe("");
    expect(container.querySelector("[aria-label='Pillar (structural gap)']")).toBeTruthy();
    expect(container.querySelector("[title='Pillar']")).toBeTruthy();
  });

  it("renders rail-height strip to match pew rail bar", () => {
    const { container } = render(<PillarGapLabel stripHeight="rail" />);
    expect(container.querySelector(".h-\\[5px\\]")).toBeTruthy();
  });

  it("merges className on outer wrapper", () => {
    const { container } = render(<PillarGapLabel className="extra-class" />);
    const outer = container.firstElementChild;
    expect(outer?.className).toContain("extra-class");
  });
});
