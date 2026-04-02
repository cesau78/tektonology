import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { LifecycleOverview } from "./lifecycle-overview";
import type { MaintenanceLifecycle } from "@/data/types";

const mockLifecycle: Pick<MaintenanceLifecycle, "restorationLoop" | "planningLoop"> = {
  restorationLoop: {
    title: "Restoration Lifecycle",
    centerEyebrow: "Restore",
    centerNote: "On-site summary.",
    phaseDetails: [
      {
        label: "Spot",
        description: "Spot desc.",
        subItems: [
          { title: "Identify", description: "Id desc." },
          { title: "Tag", description: "Tag desc." },
          { title: "Report", description: "Rep desc." },
        ],
      },
      { label: "Prepare", description: "Prepare desc.", subItems: [] },
      {
        label: "Restore",
        description: "Restore phase desc.",
        subItems: [
          { title: "Repair", description: "Repair desc." },
          { title: "Verify", description: "Verify desc." },
        ],
      },
    ],
  },
  planningLoop: {
    title: "Planning Lifecycle",
    centerEyebrow: "Planning",
    centerNote: "Planning summary.",
    phaseDetails: [
      {
        label: "Fund",
        description: "Fund desc.",
        subItems: [{ title: "Gift", description: "Gift desc." }],
      },
      { label: "R&D", description: "R&D desc.", subItems: [] },
    ],
  },
};

afterEach(cleanup);

describe("LifecycleOverview", () => {
  it("shows the Spot > Prepare > Restore diagram at rest", () => {
    const { container } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    expect(container.querySelector('figure[aria-label*="Restoration lifecycle"]')).not.toBeNull();
  });

  it("drills into Spot with sub-step buttons and a matching ring", () => {
    const { getByRole, queryByRole, container } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Spot" }));
    expect(getByRole("button", { name: "← Back to overview" })).toBeInTheDocument();
    expect(queryByRole("button", { name: "Prepare" })).not.toBeInTheDocument();
    expect(getByRole("button", { name: "Identify" })).toBeInTheDocument();
    expect(container.querySelector('figure[aria-label*="Spot: Identify, then Tag, then Report"]')).not.toBeNull();
  });

  it("returns from Spot detail via Back", () => {
    const { getByRole, getByText } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Spot" }));
    fireEvent.click(getByRole("button", { name: "← Back to overview" }));
    expect(getByText("On-site summary.")).toBeInTheDocument();
    expect(getByRole("button", { name: "Spot" })).toBeInTheDocument();
  });

  it("drills into Restore with sub-step buttons and a matching ring", () => {
    const { getByRole, queryByRole, container } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Restore" }));
    expect(getByRole("button", { name: "← Back to overview" })).toBeInTheDocument();
    expect(queryByRole("button", { name: "Spot" })).not.toBeInTheDocument();
    expect(getByRole("button", { name: "Repair" })).toBeInTheDocument();
    expect(
      container.querySelector('figure[aria-label*="Restore: Repair, then Verify"]'),
    ).not.toBeNull();
  });

  it("toggles Spot detail sub-step pressed state", () => {
    const { getByRole } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Spot" }));
    const identify = getByRole("button", { name: "Identify" });
    expect(identify).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(identify);
    expect(identify).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(identify);
    expect(identify).toHaveAttribute("aria-pressed", "false");
  });

  it("opens planning from Prepare with Fund, R&D, and matching ring", () => {
    const { getByRole, getByText, container } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Prepare" }));
    expect(getByText("← Back to overview")).toBeInTheDocument();
    expect(getByText("Planning summary.")).toBeInTheDocument();
    expect(getByRole("button", { name: "Fund" })).toBeInTheDocument();
    expect(container.querySelector('figure[aria-label*="Planning Lifecycle"]')).not.toBeNull();
  });

  it("returns from planning via Back", () => {
    const { getByRole, getByText } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Prepare" }));
    fireEvent.click(getByRole("button", { name: "← Back to overview" }));
    expect(getByText("On-site summary.")).toBeInTheDocument();
  });

  it("does not expand planning substeps when a planning step is clicked", () => {
    const { getByRole, queryByText } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Prepare" }));
    fireEvent.click(getByRole("button", { name: "Fund" }));
    expect(queryByText("Gift desc.")).not.toBeInTheDocument();
  });
});
