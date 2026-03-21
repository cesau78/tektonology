import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Separator } from "./separator";

vi.mock("radix-ui", () => ({
  Separator: {
    Root: ({
      className,
      orientation,
      decorative,
      ...props
    }: any) => (
      <div
        className={className}
        data-orientation={orientation}
        role={decorative ? "none" : "separator"}
        {...props}
      />
    ),
  },
}));

afterEach(cleanup);

describe("Separator", () => {
  it("renders with default attributes", () => {
    const { container } = render(<Separator />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-slot", "separator");
    expect(el).toHaveAttribute("data-orientation", "horizontal");
    expect(el).toHaveAttribute("role", "none");
  });

  it("merges custom className with base classes", () => {
    const { container } = render(<Separator className="my-sep" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain("shrink-0");
    expect(el.className).toContain("my-sep");
  });

  it("renders vertical orientation", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-orientation", "vertical");
  });

  it("renders as separator role when not decorative", () => {
    const { container } = render(<Separator decorative={false} />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("role", "separator");
  });

  it("passes through additional props", () => {
    const { container } = render(<Separator id="s1" aria-label="divider" />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("id", "s1");
    expect(el).toHaveAttribute("aria-label", "divider");
  });
});
