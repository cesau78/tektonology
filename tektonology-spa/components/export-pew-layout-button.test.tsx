import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportPewLayoutButton } from "./export-pew-layout-button";
import type { Project } from "@/data/types";

const pewExcelMocks = vi.hoisted(() => ({
  buildPewLayoutWorkbook: vi.fn(),
}));

vi.mock("@/lib/pew-sections-excel", () => ({
  buildPewLayoutWorkbook: pewExcelMocks.buildPewLayoutWorkbook,
}));

const miniProject: Project = {
  id: "p1",
  name: "N",
  church: "C",
  description: "d",
  layout: {
    orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
    aisles: [{ id: "a", name: "A" }],
    sections: [
      {
        id: "s1",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "r1",
            label: "R1",
            frontType: "pew",
            kneelers: [
              {
                id: "k1",
                capacity: 1,
                hardware: [
                  { partId: "x", name: "P", quantity: 1, status: "installed" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe("ExportPewLayoutButton", () => {
  const createObjectURL = vi.fn(() => "blob:mock");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    pewExcelMocks.buildPewLayoutWorkbook.mockResolvedValue(new Uint8Array([0x50, 0x4b, 3, 4]));
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    pewExcelMocks.buildPewLayoutWorkbook.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("builds a workbook and triggers download on click", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    const elClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(click);
    const { getByRole } = render(<ExportPewLayoutButton project={miniProject} />);
    await user.click(getByRole("button", { name: /Download pew layout/i }));
    expect(pewExcelMocks.buildPewLayoutWorkbook).toHaveBeenCalledWith(miniProject, { sectionId: undefined });
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    elClick.mockRestore();
  });

  it("passes sectionId and custom label, shows hint", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { getByRole, getByText } = render(
      <ExportPewLayoutButton
        project={miniProject}
        sectionId="s1"
        label="Export section"
        hint="Test hint"
      />,
    );
    expect(getByText("Test hint")).toBeInTheDocument();
    await user.click(getByRole("button", { name: /Export section/i }));
    expect(pewExcelMocks.buildPewLayoutWorkbook).toHaveBeenCalledWith(miniProject, { sectionId: "s1" });
  });

  it("uses safe filename when project id sanitizes to empty", async () => {
    const user = userEvent.setup();
    let capturedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      capturedDownload = this.download;
    });
    const idProject: Project = { ...miniProject, id: "@@@###" };
    render(<ExportPewLayoutButton project={idProject} sectionId="sec-1" />);
    await user.click(screen.getByRole("button", { name: /Download pew layout/i }));
    expect(capturedDownload).toContain("export");
    expect(capturedDownload).toContain("sec-1");
  });
});
