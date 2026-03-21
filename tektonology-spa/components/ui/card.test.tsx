import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from "./card";

afterEach(cleanup);

describe("Card", () => {
  it("renders with data-slot and base classes", () => {
    const { container } = render(<Card>Content</Card>);
    const el = container.firstElementChild!;
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveAttribute("data-slot", "card");
    expect(el.className).toContain("bg-card");
  });

  it("merges custom className", () => {
    const { container } = render(<Card className="my-card">Content</Card>);
    expect(container.firstElementChild!.className).toContain("my-card");
  });

  it("passes through additional props", () => {
    const { container } = render(<Card id="c1">Content</Card>);
    expect(container.firstElementChild!).toHaveAttribute("id", "c1");
  });
});

describe("CardHeader", () => {
  it("renders with data-slot", () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-slot", "card-header");
    expect(el.className).toContain("grid");
  });

  it("merges custom className", () => {
    const { container } = render(<CardHeader className="hdr">H</CardHeader>);
    expect(container.firstElementChild!.className).toContain("hdr");
  });
});

describe("CardTitle", () => {
  it("renders with data-slot", () => {
    const { container } = render(<CardTitle>Title</CardTitle>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-slot", "card-title");
    expect(el.className).toContain("font-semibold");
  });

  it("merges custom className", () => {
    const { container } = render(<CardTitle className="ttl">T</CardTitle>);
    expect(container.firstElementChild!.className).toContain("ttl");
  });
});

describe("CardDescription", () => {
  it("renders with data-slot", () => {
    const { container } = render(<CardDescription>Desc</CardDescription>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-slot", "card-description");
    expect(el.className).toContain("text-muted-foreground");
  });

  it("merges custom className", () => {
    const { container } = render(<CardDescription className="dsc">D</CardDescription>);
    expect(container.firstElementChild!.className).toContain("dsc");
  });
});

describe("CardAction", () => {
  it("renders with data-slot", () => {
    const { container } = render(<CardAction>Action</CardAction>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-slot", "card-action");
    expect(el.className).toContain("col-start-2");
  });

  it("merges custom className", () => {
    const { container } = render(<CardAction className="act">A</CardAction>);
    expect(container.firstElementChild!.className).toContain("act");
  });
});

describe("CardContent", () => {
  it("renders with data-slot", () => {
    const { container } = render(<CardContent>Body</CardContent>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-slot", "card-content");
    expect(el.className).toContain("px-6");
  });

  it("merges custom className", () => {
    const { container } = render(<CardContent className="cnt">C</CardContent>);
    expect(container.firstElementChild!.className).toContain("cnt");
  });
});

describe("CardFooter", () => {
  it("renders with data-slot", () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-slot", "card-footer");
    expect(el.className).toContain("flex");
  });

  it("merges custom className", () => {
    const { container } = render(<CardFooter className="ftr">F</CardFooter>);
    expect(container.firstElementChild!.className).toContain("ftr");
  });
});
