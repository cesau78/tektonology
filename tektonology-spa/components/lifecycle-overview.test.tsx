import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { LifecycleOverview } from "./lifecycle-overview";
import type { MaintenanceLifecycle } from "@/data/types";

const mockLifecycle: Pick<MaintenanceLifecycle, "restorationLoop" | "planningLoop"> = {
  restorationLoop: {
    title: "Restoration lifecycle",
    centerEyebrow: "Restore",
    centerNote: "On-site summary.",
    phaseDetails: [
      {
        label: "Spot",
        description: "Spot desc.",
        subItems: [{ title: "Sub", description: "Sub desc." }],
      },
      { label: "Prepare", description: "Prepare desc.", subItems: [] },
      { label: "Restore", description: "Restore desc.", subItems: [] },
    ],
  },
  planningLoop: {
    title: "Planning lifecycle",
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
  it("shows placeholder until a step is chosen", () => {
    const { getByText } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    expect(getByText(/Select Spot, Prepare, or Restore/)).toBeInTheDocument();
  });

  it("shows restoration ring when Spot is selected and toggles off", () => {
    const { getByRole, getByText, queryByText, container } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Spot" }));
    expect(queryByText(/Select Spot, Prepare, or Restore/)).not.toBeInTheDocument();
    expect(container.querySelector('figure[aria-label*="Restoration lifecycle"]')).not.toBeNull();
    fireEvent.click(getByRole("button", { name: "Spot" }));
    expect(getByText(/Select Spot, Prepare, or Restore/)).toBeInTheDocument();
  });

  it("opens planning flow from Prepare and expands planning substeps", () => {
    const { getByRole, getByText, container } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Prepare" }));
    expect(getByText("Planning summary.")).toBeInTheDocument();
    expect(container.querySelector('figure[aria-label*="Planning lifecycle"]')).not.toBeNull();
    fireEvent.click(getByRole("button", { name: "Fund" }));
    expect(getByText("Gift desc.")).toBeInTheDocument();
  });

  it("returns from planning via Back", () => {
    const { getByRole, getByText } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Prepare" }));
    fireEvent.click(getByRole("button", { name: "← Back to restoration" }));
    expect(getByText("On-site summary.")).toBeInTheDocument();
  });

  it("toggles planning phase substeps off when the same phase is clicked again", () => {
    const { getByRole, queryByText } = render(<LifecycleOverview lifecycle={mockLifecycle} />);
    fireEvent.click(getByRole("button", { name: "Prepare" }));
    fireEvent.click(getByRole("button", { name: "Fund" }));
    expect(queryByText("Gift desc.")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Fund" }));
    expect(queryByText("Gift desc.")).not.toBeInTheDocument();
  });
});
