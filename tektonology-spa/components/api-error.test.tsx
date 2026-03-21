import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LoadingState, ErrorState } from "./api-error";

afterEach(cleanup);

describe("LoadingState", () => {
  it("renders loading text", () => {
    const { container } = render(<LoadingState />);
    expect(container.textContent).toContain("Loading...");
  });
});

describe("ErrorState", () => {
  it("renders the error message and help text", () => {
    const { container } = render(<ErrorState message="Something went wrong" />);
    expect(container.textContent).toContain("Unable to load data");
    expect(container.textContent).toContain("Something went wrong");
    expect(container.textContent).toContain(
      "Make sure the tektonology-api server is running on localhost:3001",
    );
  });

  it("renders a different error message", () => {
    const { container } = render(<ErrorState message="Network timeout" />);
    expect(container.textContent).toContain("Network timeout");
    expect(container.textContent).toContain("Unable to load data");
  });
});
