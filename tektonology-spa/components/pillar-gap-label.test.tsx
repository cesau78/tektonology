import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PillarGapLabel } from "./pillar-gap-label";

describe("PillarGapLabel", () => {
  afterEach(cleanup);

  it("renders default detail size", () => {
    const { container } = render(<PillarGapLabel />);
    expect(container.querySelector(".min-w-\\[44px\\]")).toBeTruthy();
    expect(container).toHaveTextContent("Pillar");
    expect(container.querySelector("[title='Pillar']")).toBeTruthy();
  });

  it("renders compact non-spanning size", () => {
    const { container } = render(<PillarGapLabel compact />);
    expect(container.querySelector(".w-\\[16px\\]")).toBeTruthy();
    expect(container.querySelector(".text-\\[9px\\]")).toBeTruthy();
  });

  it("renders compact spanning size", () => {
    const { container } = render(<PillarGapLabel compact spanning />);
    expect(container.querySelector(".w-\\[26px\\]")).toBeTruthy();
  });

  it("renders detail spanning size", () => {
    const { container } = render(<PillarGapLabel spanning />);
    expect(container.querySelector(".w-\\[68px\\]")).toBeTruthy();
    expect(container.querySelector(".text-\\[15px\\]")).toBeTruthy();
  });

  it("merges className on outer wrapper", () => {
    const { container } = render(<PillarGapLabel className="extra-class" />);
    const outer = container.firstElementChild;
    expect(outer?.className).toContain("extra-class");
  });
});
