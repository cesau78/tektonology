import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import HomePage from "./page";
import type { MaintenanceLifecycle } from "@/data/types";

vi.mock("@/lib/maintenance-lifecycle", () => ({
  getMaintenanceLifecycle: (): MaintenanceLifecycle => ({
    title: "Restoration lifecycle",
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
      title: "Restoration lifecycle",
      centerEyebrow: "Restore",
      centerNote: "Short note.",
      phaseDetails: [
        {
          label: "A",
          description: "Desc A.",
          subItems: [{ title: "Sub", description: "Sub desc." }],
        },
        { label: "B", description: "Desc B.", subItems: [] },
        { label: "C", description: "Desc C.", subItems: [] },
      ],
    },
    planningLoop: {
      title: "Planning lifecycle",
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
    expect(container).toHaveTextContent("Restoration lifecycle");
    expect(container).toHaveTextContent("Test intro for any project.");
    expect(container).toHaveTextContent("Short note.");
    expect(getByRole("button", { name: "A" })).toBeInTheDocument();
    expect(container).not.toHaveTextContent("Other note.");
  });

  it("opens planning content when Prepare is chosen", () => {
    const { container, getByRole } = render(<HomePage />);
    fireEvent.click(getByRole("button", { name: "B" }));
    expect(container).toHaveTextContent("Other note.");
    expect(getByRole("button", { name: "D" })).toBeInTheDocument();
  });

  it("expands a lifecycle step from the step boxes", () => {
    const { container, getByRole } = render(<HomePage />);
    fireEvent.click(getByRole("button", { name: "A" }));
    expect(container).toHaveTextContent("Desc A.");
    expect(container).toHaveTextContent("Sub desc.");
  });
});
