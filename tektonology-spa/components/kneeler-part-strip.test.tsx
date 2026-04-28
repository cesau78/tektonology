import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KneelerPartStripPanel } from "./kneeler-part-strip";

describe("KneelerPartStripPanel", () => {
  it("renders a single block when segments are not split", () => {
    render(
      <KneelerPartStripPanel segments={[{ status: "needed", weight: 3 }]} noneFill={false}>
        Sole
      </KneelerPartStripPanel>,
    );
    expect(screen.getByText("Sole")).toBeTruthy();
    expect(screen.getByText("Sole").closest("div")?.className).toContain("amber");
  });
});
