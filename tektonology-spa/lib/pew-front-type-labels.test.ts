import { describe, it, expect } from "vitest";
import { labelForRowFrontType } from "./pew-front-type-labels";

describe("labelForRowFrontType", () => {
  it("maps known front types", () => {
    expect(labelForRowFrontType("communionRail")).toBe("Communion Rail");
    expect(labelForRowFrontType("pew")).toBe("Pew with Kneeler");
    expect(labelForRowFrontType("pewOnly")).toBe("Pew Only");
  });

  it("passthroughs unknown string", () => {
    expect(labelForRowFrontType("custom")).toBe("custom");
  });
});
