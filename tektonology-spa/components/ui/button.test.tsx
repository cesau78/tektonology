import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Button, buttonVariants } from "./button";

vi.mock("radix-ui", () => ({
  Slot: {
    Root: React.forwardRef(({ children, ...props }: any, ref: any) => {
      if (React.isValidElement(children)) {
        return React.cloneElement(children, { ...props, ref });
      }
      return (
        <span {...props} ref={ref}>
          {children}
        </span>
      );
    }),
  },
}));

afterEach(cleanup);

describe("Button", () => {
  it("renders a button element by default", () => {
    const { container } = render(<Button>Click me</Button>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("data-slot")).toBe("button");
    expect(el.textContent).toBe("Click me");
  });

  it("applies default variant and size data attributes", () => {
    const { container } = render(<Button>Defaults</Button>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("data-variant")).toBe("default");
    expect(el.getAttribute("data-size")).toBe("default");
  });

  it("applies custom className", () => {
    const { container } = render(<Button className="my-class">Styled</Button>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("my-class");
  });

  it("passes through additional props", () => {
    const { container } = render(
      <Button type="submit" disabled>
        Submit
      </Button>
    );
    const el = container.firstElementChild as HTMLButtonElement;
    expect(el.getAttribute("type")).toBe("submit");
    expect(el.disabled).toBe(true);
  });

  it("forwards onClick handler", () => {
    const handler = vi.fn();
    const { container } = render(<Button onClick={handler}>Clickable</Button>);
    const el = container.firstElementChild as HTMLElement;
    el.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  describe("variants", () => {
    const variants = [
      "default",
      "destructive",
      "outline",
      "secondary",
      "ghost",
      "link",
    ] as const;

    for (const variant of variants) {
      it(`renders variant="${variant}"`, () => {
        const { container } = render(
          <Button variant={variant}>{variant}</Button>
        );
        const el = container.firstElementChild as HTMLElement;
        expect(el.getAttribute("data-variant")).toBe(variant);
      });
    }
  });

  describe("sizes", () => {
    const sizes = [
      "default",
      "xs",
      "sm",
      "lg",
      "icon",
      "icon-xs",
      "icon-sm",
      "icon-lg",
    ] as const;

    for (const size of sizes) {
      it(`renders size="${size}"`, () => {
        const { container } = render(<Button size={size}>{size}</Button>);
        const el = container.firstElementChild as HTMLElement;
        expect(el.getAttribute("data-size")).toBe(size);
      });
    }
  });

  describe("asChild", () => {
    it("renders child element with button props when asChild is true", () => {
      const { container } = render(
        <Button asChild>
          <a href="/page">Link Button</a>
        </Button>
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el.tagName).toBe("A");
      expect(el.getAttribute("href")).toBe("/page");
      expect(el.getAttribute("data-slot")).toBe("button");
      expect(el.getAttribute("data-variant")).toBe("default");
      expect(el.getAttribute("data-size")).toBe("default");
      expect(el.textContent).toBe("Link Button");
    });

    it("renders child element with variant and size when asChild is true", () => {
      const { container } = render(
        <Button asChild variant="destructive" size="lg">
          <a href="/delete">Delete</a>
        </Button>
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el.tagName).toBe("A");
      expect(el.getAttribute("data-variant")).toBe("destructive");
      expect(el.getAttribute("data-size")).toBe("lg");
    });

    it("wraps non-element children in a span when asChild is true", () => {
      const { container } = render(<Button asChild>plain text</Button>);
      const el = container.firstElementChild as HTMLElement;
      expect(el.tagName).toBe("SPAN");
      expect(el.textContent).toBe("plain text");
      expect(el.getAttribute("data-slot")).toBe("button");
    });

    it("renders as button when asChild is false (explicit)", () => {
      const { container } = render(<Button asChild={false}>Normal</Button>);
      const el = container.firstElementChild as HTMLElement;
      expect(el.tagName).toBe("BUTTON");
    });

    it("renders as button when asChild is omitted (default false)", () => {
      const { container } = render(<Button>Default</Button>);
      const el = container.firstElementChild as HTMLElement;
      expect(el.tagName).toBe("BUTTON");
    });
  });

  describe("buttonVariants", () => {
    it("returns class string for variant + size combination", () => {
      const result = buttonVariants({
        variant: "destructive",
        size: "lg",
      });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns default classes when called with empty object", () => {
      const result = buttonVariants({});
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("accepts className in the variants call", () => {
      const result = buttonVariants({ className: "extra" });
      expect(result).toContain("extra");
    });

    for (const variant of [
      "default",
      "destructive",
      "outline",
      "secondary",
      "ghost",
      "link",
    ] as const) {
      it(`generates classes for variant="${variant}"`, () => {
        const result = buttonVariants({ variant });
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });
    }

    for (const size of [
      "default",
      "xs",
      "sm",
      "lg",
      "icon",
      "icon-xs",
      "icon-sm",
      "icon-lg",
    ] as const) {
      it(`generates classes for size="${size}"`, () => {
        const result = buttonVariants({ size });
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });
    }
  });
});
