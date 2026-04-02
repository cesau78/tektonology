import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import HomePage from "./page";
import type { MaintenanceLifecycle } from "@/data/types";

vi.mock("@/lib/maintenance-lifecycle", () => ({
  getMaintenanceLifecycle: (): MaintenanceLifecycle => ({
    title: "Restoration Lifecycle",
    intro: "Test intro for any project.",
    phases: [
      {
        phaseNumber: 1,
        title: "Phase one",
        role: "Testers",
        summary: "Summary line.",
        bullets: ["First bullet."],
      },
    ],
    restorationLoop: {
      title: "Restoration Lifecycle",
      centerEyebrow: "Restore",
      centerNote: "Short note.",
      phaseDetails: [
        {
          label: "A",
          description: "Desc A.",
          subItems: [
            { title: "Identify", description: "Id line." },
            { title: "Tag", description: "Tag line." },
            { title: "Report", description: "Rep line." },
          ],
        },
        { label: "B", description: "Desc B.", subItems: [] },
        {
          label: "C",
          description: "Desc C.",
          subItems: [
            { title: "Finish", description: "Finish line." },
            { title: "Close", description: "Close line." },
          ],
        },
      ],
    },
    planningLoop: {
      title: "Planning Lifecycle",
      centerEyebrow: "Planning",
      centerNote: "Other note.",
      phaseDetails: [
        { label: "D", description: "Desc D.", subItems: [] },
        { label: "E", description: "Desc E.", subItems: [] },
      ],
    },
  }),
}));

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

  it("renders the restoration lifecycle section", () => {
    const { container, getByRole } = render(<HomePage />);
    expect(container).toHaveTextContent("Restoration Lifecycle");
    expect(container).toHaveTextContent("Test intro for any project.");
    expect(container).toHaveTextContent("Short note.");
    expect(container).toHaveTextContent("Overview");
    expect(getByRole("button", { name: "A" })).toBeInTheDocument();
    expect(container).not.toHaveTextContent("Other note.");
  });

  it("opens planning from Prepare", () => {
    const { container, getByRole } = render(<HomePage />);
    fireEvent.click(getByRole("button", { name: "B" }));
    expect(container).toHaveTextContent("← Back to overview");
    expect(container).toHaveTextContent("Other note.");
    expect(getByRole("button", { name: "D" })).toBeInTheDocument();
  });

  it("drills into a restoration overview phase with sub-steps and matching ring", () => {
    const { container, getByRole } = render(<HomePage />);
    fireEvent.click(getByRole("button", { name: "A" }));
    expect(container).toHaveTextContent("← Back to overview");
    expect(getByRole("button", { name: "Identify" })).toBeInTheDocument();
    expect(
      container.querySelector('figure[aria-label*="A: Identify, then Tag, then Report"]'),
    ).not.toBeNull();
  });

  it("drills into Restore phase with its sub-steps", () => {
    const { container, getByRole } = render(<HomePage />);
    fireEvent.click(getByRole("button", { name: "C" }));
    expect(container).toHaveTextContent("← Back to overview");
    expect(getByRole("button", { name: "Finish" })).toBeInTheDocument();
    expect(
      container.querySelector('figure[aria-label*="C: Finish, then Close"]'),
    ).not.toBeNull();
  });
});
