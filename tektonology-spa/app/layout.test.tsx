import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import RootLayout, { metadata } from "./layout";

afterEach(cleanup);

vi.mock("@/components/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));

vi.mock("@/components/header", () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

describe("RootLayout", () => {
  it("renders children inside the layout structure", () => {
    const { container } = render(
      <RootLayout>
        <p>Hello</p>
      </RootLayout>
    );

    expect(container.querySelector("[data-testid='providers']")).toBeInTheDocument();
    expect(container.querySelector("[data-testid='header']")).toBeInTheDocument();
    expect(container.querySelector("p")).toHaveTextContent("Hello");
    expect(container).toHaveTextContent("Tektonology — Godspeed.");

    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass("max-w-3xl");
  });

  it("applies font class variables to body", () => {
    render(
      <RootLayout>
        <p>Test</p>
      </RootLayout>
    );

    // In jsdom, <body> is hoisted to document.body rather than nesting inside the container div
    const body = document.body;
    expect(body.className).toContain("mock-geist-sans");
    expect(body.className).toContain("mock-geist-mono");
    expect(body.className).toContain("antialiased");
  });

  it("exports correct metadata", () => {
    expect(metadata.title).toBe("Tektonology");
    expect(metadata.description).toContain("3D-printable solutions");
  });
});
