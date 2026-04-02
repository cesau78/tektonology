import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("fs", () => {
  const readFileSync = vi.fn();
  const readdirSync = vi.fn();
  return {
    readFileSync,
    readdirSync,
    default: { readFileSync, readdirSync },
  };
});

describe("project-data", () => {
  beforeEach(async () => {
    vi.resetModules();
    const fs = await import("fs");
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.readdirSync).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("getProject returns undefined on read error", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const { getProject } = await import("./project-data");
    expect(getProject("missing")).toBeUndefined();
  });

  it("listProjectJsonSlugs filters to json files", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readdirSync).mockReturnValue(["a.json", "b.txt"]);
    const { listProjectJsonSlugs } = await import("./project-data");
    expect(listProjectJsonSlugs()).toEqual(["a"]);
  });

  it("listProjectSectionStaticParams skips projects that fail to load", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readdirSync).mockReturnValue(["missing.json"]);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const { listProjectSectionStaticParams } = await import("./project-data");
    expect(listProjectSectionStaticParams()).toEqual([]);
  });

  it("listProjectSectionStaticParams skips crossAisle sections", async () => {
    const fs = await import("fs");
    vi.mocked(fs.readdirSync).mockReturnValue(["p.json"]);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        id: "p",
        name: "P",
        church: "C",
        description: "",
        layout: {
          orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
          aisles: [],
          sections: [
            { id: "pews", label: "Pews", type: "pews", side: "west", alignment: "nave", group: 0, rows: [] },
            {
              id: "transept",
              label: "T",
              type: "crossAisle",
              side: "full",
              alignment: "full",
              group: 1,
              rows: [],
            },
          ],
        },
      }),
    );
    const { listProjectSectionStaticParams } = await import("./project-data");
    expect(listProjectSectionStaticParams()).toEqual([{ project: "p", section: "pews" }]);
  });
});
