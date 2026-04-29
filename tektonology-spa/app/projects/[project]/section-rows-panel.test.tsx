import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SectionRowsPanel } from "./section-rows-panel";
import type { PewSection } from "@/data/types";
import * as navigation from "next/navigation";

afterEach(cleanup);

describe("SectionRowsPanel", () => {
  it("shows wheelchair marker in summary when row is handicap accessible", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams() as ReturnType<typeof navigation.useSearchParams>,
    );

    const section: PewSection = {
      id: "s",
      label: "West Rear",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 2,
      rows: [
        {
          id: "r1",
          label: "Row 1",
          frontType: "pew",
          handicapAccessible: true,
          kneelers: [{ id: "k1", capacity: 3, hardware: [] }],
        },
      ],
    };

    render(<SectionRowsPanel section={section} partNames={["Prayer Sole"]} />);
    expect(screen.getByTitle("Wheelchair accessible seating")).toBeTruthy();
    vi.restoreAllMocks();
  });

  it("shows pew-only kneeler message and bench band in expanded row", async () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams() as ReturnType<typeof navigation.useSearchParams>,
    );

    const section: PewSection = {
      id: "s",
      label: "West",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      rows: [
        {
          id: "r1",
          label: "Row 1",
          frontType: "pew",
          kneelers: [
            { id: "po1", capacity: 6, type: "PewOnly", hardware: [] },
          ],
        },
      ],
    };

    render(<SectionRowsPanel section={section} partNames={["Prayer Sole"]} />);
    await screen.findByText("Row 1");
    fireEvent.click(screen.getByText("Row 1"));
    expect(await screen.findByText("Pew only — no kneeler hardware.")).toBeTruthy();
    expect(screen.getByTitle("Pew only (no kneeler hardware)")).toBeTruthy();
    vi.restoreAllMocks();
  });
});
