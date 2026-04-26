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
    let downloadName = "";
    const elClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
      click();
    });
    const { getByRole } = render(
      <ExportPewLayoutButton project={miniProject} partName="P" />,
    );
    await user.click(getByRole("button", { name: /^export$/i }));
    expect(pewExcelMocks.buildPewLayoutWorkbook).toHaveBeenCalledWith(miniProject, {
      sectionId: undefined,
      partName: "P",
    });
    expect(downloadName).toMatch(/^p1-map-p-\d{8}\.xlsx$/);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    elClick.mockRestore();
  });

  it("passes sectionId and custom label", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { getByRole } = render(
      <ExportPewLayoutButton
        project={miniProject}
        sectionId="s1"
        partName="P"
        label="export section"
      />,
    );
    await user.click(getByRole("button", { name: /export section/i }));
    expect(pewExcelMocks.buildPewLayoutWorkbook).toHaveBeenCalledWith(miniProject, {
      sectionId: "s1",
      partName: "P",
    });
  });

  it("uses project-map-part filename; safe when project id sanitizes to empty", async () => {
    const user = userEvent.setup();
    let capturedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      capturedDownload = this.download;
    });
    const idProject: Project = { ...miniProject, id: "@@@###" };
    render(
      <ExportPewLayoutButton project={idProject} sectionId="sec-1" partName="Prayer Sole" />,
    );
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    expect(capturedDownload).toMatch(/^export-map-prayer-sole-\d{8}\.xlsx$/);
  });

  it("part token is lowercase and collapses whitespace to a single dash", async () => {
    const user = userEvent.setup();
    let capturedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      capturedDownload = this.download;
    });
    render(<ExportPewLayoutButton project={miniProject} partName="Kneeler  Bushing" />);
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    expect(capturedDownload).toMatch(/^p1-map-kneeler-bushing-\d{8}\.xlsx$/);
  });

  it("uses default part file token when part name is only whitespace", async () => {
    const user = userEvent.setup();
    let capturedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      capturedDownload = this.download;
    });
    render(<ExportPewLayoutButton project={miniProject} partName="   " />);
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    expect(capturedDownload).toMatch(/^p1-map-part-\d{8}\.xlsx$/);
  });
});
