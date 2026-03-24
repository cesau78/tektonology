import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import HomePage from "./page";

afterEach(cleanup);

describe("HomePage", () => {
  it("renders the Tektonology heading", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector("h1")).toHaveTextContent("Tektonology");
  });

  it("renders a link to Products", () => {
    const { container } = render(<HomePage />);
    const link = container.querySelector("a[href='/products']");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Products");
  });

  it("renders a link to Projects", () => {
    const { container } = render(<HomePage />);
    const link = container.querySelector("a[href='/projects']");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Projects");
  });

  it("renders descriptions for each section", () => {
    const { container } = render(<HomePage />);
    expect(container).toHaveTextContent("print settings");
    expect(container).toHaveTextContent("church restoration");
  });
});
