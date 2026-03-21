import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Badge, badgeVariants } from "./badge";

afterEach(cleanup);

describe("Badge", () => {
  it("renders a span by default with data-slot", () => {
    const { container } = render(<Badge>Default</Badge>);
    const el = container.firstElementChild!;
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveAttribute("data-slot", "badge");
  });

  it("applies default variant data attribute", () => {
    const { container } = render(<Badge>Default</Badge>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-variant", "default");
  });

  it("applies custom className", () => {
    const { container } = render(<Badge className="custom-class">Styled</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain("custom-class");
  });

  it("merges custom className with variant classes", () => {
    const { container } = render(<Badge className="extra" variant="secondary">Merged</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain("extra");
    expect(el.className).toContain("inline-flex");
  });

  it("passes through additional props", () => {
    const { container } = render(<Badge data-testid="my-badge" id="badge-1">Props</Badge>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("id", "badge-1");
    expect(el).toHaveAttribute("data-testid", "my-badge");
  });

  describe("variants", () => {
    const variants = [
      "default",
      "secondary",
      "destructive",
      "outline",
      "ghost",
      "link",
    ] as const;

    for (const variant of variants) {
      it(`renders variant="${variant}" with correct data attribute and classes`, () => {
        const { container } = render(<Badge variant={variant}>{variant}</Badge>);
        const el = container.firstElementChild!;
        expect(el).toHaveAttribute("data-variant", variant);
        // base classes should always be present (cn/twMerge may drop conflicting ones)
        expect(el.className).toContain("inline-flex");
        expect(el.className).toContain("rounded-full");
      });
    }
  });

  describe("asChild", () => {
    it("renders as a Slot when asChild is true", () => {
      const { container } = render(
        <Badge asChild>
          <a href="/link">Link Badge</a>
        </Badge>
      );
      const el = container.firstElementChild!;
      expect(el.tagName).toBe("A");
      expect(el).toHaveAttribute("href", "/link");
      expect(el).toHaveAttribute("data-slot", "badge");
    });

    it("renders as span when asChild is false (explicit)", () => {
      const { container } = render(<Badge asChild={false}>Span Badge</Badge>);
      const el = container.firstElementChild!;
      expect(el.tagName).toBe("SPAN");
    });
  });

  describe("badgeVariants", () => {
    it("returns class string for each variant", () => {
      const result = badgeVariants({ variant: "destructive" });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns default classes when called with no args", () => {
      const result = badgeVariants({});
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
