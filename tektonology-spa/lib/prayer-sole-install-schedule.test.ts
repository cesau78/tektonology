import { describe, expect, it } from "vitest";
import type { PewSection } from "@/data/types";
import {
  DEFAULT_PRAYER_SOLE_SESSION_DATES,
  redistributeUpcomingPrayerSoleDates,
  reselectUpcomingPrayerSoleInRowMajorOrder,
  retainUpcomingPrayerSoleQuantity,
} from "./prayer-sole-install-schedule";

function sole(q: number, date: string) {
  return {
    partId: "kneeler-boot-compound-fastened",
    name: "Prayer Sole",
    quantity: q,
    status: "upcoming" as const,
    date,
  };
}

function soleNeeded(q: number) {
  return {
    partId: "kneeler-boot-compound-fastened",
    name: "Prayer Sole",
    quantity: q,
    status: "needed" as const,
  };
}

describe("redistributeUpcomingPrayerSoleDates", () => {
  it("runs with default options when second argument omitted", () => {
    const kneelers = Array.from({ length: 3 }, (_, i) => ({
      id: `k-${i}`,
      capacity: 3,
      hardware: [sole(3, "2000-01-01")],
    }));
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [{ id: "r1", label: "Row 1", frontType: "pew", kneelers }],
      },
    ];
    const { totalQuantity } = redistributeUpcomingPrayerSoleDates(sections);
    expect(totalQuantity).toBe(9);
    expect(kneelers.every((k) => k.hardware![0].date === DEFAULT_PRAYER_SOLE_SESSION_DATES[0])).toBe(true);
  });

  it("forEachUpcoming skips wrong part status and kneelers with missing hardware", () => {
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              { id: "bare", capacity: 3 },
              {
                id: "k2",
                capacity: 3,
                hardware: [
                  sole(3, "2000-01-01"),
                  { partId: "other", name: "X", quantity: 1, status: "upcoming" },
                ],
              },
            ],
          },
        ],
      },
    ];
    redistributeUpcomingPrayerSoleDates(sections);
    expect(sections[0].rows[0].kneelers[1].hardware![0].date).toBe(DEFAULT_PRAYER_SOLE_SESSION_DATES[0]);
    expect(sections[0].rows[0].kneelers[1].hardware![1].date).toBeUndefined();
  });

  it("packs 3 sessions of 75 (225 total) into three dates", () => {
    const kneelers = Array.from({ length: 75 }, (_, i) => ({
      id: `k-${i}`,
      capacity: 3,
      hardware: [sole(3, "2000-01-01")],
    }));
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [{ id: "r1", label: "Row 1", frontType: "pew", kneelers }],
      },
    ];
    redistributeUpcomingPrayerSoleDates(sections);
    const dates = kneelers.map((k) => k.hardware![0].date);
    expect(dates.filter((d) => d === DEFAULT_PRAYER_SOLE_SESSION_DATES[0]).length).toBe(25);
    expect(dates.filter((d) => d === DEFAULT_PRAYER_SOLE_SESSION_DATES[1]).length).toBe(25);
    expect(dates.filter((d) => d === DEFAULT_PRAYER_SOLE_SESSION_DATES[2]).length).toBe(25);
  });

  it("uses custom session capacity and dates", () => {
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              { id: "a", capacity: 3, hardware: [sole(10, "x")] },
              { id: "b", capacity: 3, hardware: [sole(10, "x")] },
              { id: "c", capacity: 3, hardware: [sole(10, "x")] },
            ],
          },
        ],
      },
    ];
    redistributeUpcomingPrayerSoleDates(sections, {
      sessionCapacity: 20,
      sessionDates: ["2030-01-01", "2030-02-01", "2030-03-01"],
    });
    expect(sections[0].rows[0].kneelers[0].hardware![0].date).toBe("2030-01-01");
    expect(sections[0].rows[0].kneelers[1].hardware![0].date).toBe("2030-01-01");
    expect(sections[0].rows[0].kneelers[2].hardware![0].date).toBe("2030-02-01");
  });

  it("fills row N across west sections before advancing to row N+1 (row-major)", () => {
    const sections: PewSection[] = [
      {
        id: "west-main",
        label: "West Main",
        type: "pews",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "wm-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "a", capacity: 3, hardware: [sole(40, "x")] }],
          },
          {
            id: "wm-2",
            label: "Row 2",
            frontType: "pew",
            kneelers: [{ id: "b", capacity: 3, hardware: [sole(40, "x")] }],
          },
        ],
      },
      {
        id: "west-rear",
        label: "West Rear",
        type: "pews",
        side: "west",
        alignment: "nave",
        group: 2,
        rows: [
          {
            id: "wr-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "c", capacity: 3, hardware: [sole(40, "x")] }],
          },
        ],
      },
    ];
    redistributeUpcomingPrayerSoleDates(sections, {
      sessionCapacity: 75,
      sessionDates: DEFAULT_PRAYER_SOLE_SESSION_DATES,
      transeptGridRow: 9,
    });
    const mainRow2Date = sections[0].rows[1].kneelers[0].hardware![0].date;
    expect(mainRow2Date).toBe(DEFAULT_PRAYER_SOLE_SESSION_DATES[1]);
  });
});

describe("reselectUpcomingPrayerSoleInRowMajorOrder", () => {
  it("promotes west outer before west rear and east outer on the same grid row (then stops)", () => {
    const sections: PewSection[] = [
      {
        id: "west-outer",
        label: "West Outer",
        type: "pews",
        side: "westOuter",
        alignment: "nave",
        group: 2,
        rows: [
          {
            id: "wo-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "wo1", capacity: 3, hardware: [soleNeeded(20)] }],
          },
        ],
      },
      {
        id: "west-rear",
        label: "West Rear",
        type: "pews",
        side: "west",
        alignment: "nave",
        group: 2,
        rows: [
          {
            id: "wr-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "wr1", capacity: 3, hardware: [soleNeeded(20)] }],
          },
        ],
      },
      {
        id: "east-outer",
        label: "East Outer",
        type: "pews",
        side: "eastOuter",
        alignment: "nave",
        group: 2,
        rows: [
          {
            id: "eo-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "eo1", capacity: 3, hardware: [soleNeeded(20)] }],
          },
        ],
      },
    ];
    reselectUpcomingPrayerSoleInRowMajorOrder(sections, { retainQuantity: 40, transeptGridRow: 9 });
    expect(sections[0].rows[0].kneelers[0].hardware![0].status).toBe("upcoming");
    expect(sections[1].rows[0].kneelers[0].hardware![0].status).toBe("upcoming");
    expect(sections[2].rows[0].kneelers[0].hardware![0].status).toBe("needed");
  });

  it("demotes prior upcoming then repicks in row-major so work is not stuck in one section", () => {
    const sections: PewSection[] = [
      {
        id: "west-outer",
        label: "West Outer",
        type: "pews",
        side: "westOuter",
        alignment: "nave",
        group: 2,
        rows: [
          {
            id: "wo-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "wo1", capacity: 3, hardware: [soleNeeded(25)] }],
          },
        ],
      },
      {
        id: "west-rear",
        label: "West Rear",
        type: "pews",
        side: "west",
        alignment: "nave",
        group: 2,
        rows: [
          {
            id: "wr-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "wr1", capacity: 3, hardware: [sole(50, "2000-01-01")] }],
          },
        ],
      },
    ];
    reselectUpcomingPrayerSoleInRowMajorOrder(sections, { retainQuantity: 75, transeptGridRow: 9 });
    expect(sections[0].rows[0].kneelers[0].hardware![0].status).toBe("upcoming");
    expect(sections[1].rows[0].kneelers[0].hardware![0].status).toBe("upcoming");
    expect(
      sections[0].rows[0].kneelers[0].hardware![0].quantity +
        sections[1].rows[0].kneelers[0].hardware![0].quantity,
    ).toBe(75);
  });
});

describe("retainUpcomingPrayerSoleQuantity", () => {
  it("keeps first 75 units upcoming and converts the rest to needed", () => {
    const kneelers = Array.from({ length: 75 }, (_, i) => ({
      id: `k-${i}`,
      capacity: 3,
      hardware: [sole(3, "2000-01-01")],
    }));
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [{ id: "r1", label: "Row 1", frontType: "pew", kneelers }],
      },
    ];
    const r = retainUpcomingPrayerSoleQuantity(sections, { retainQuantity: 75 });
    expect(r.retainedUpcomingQuantity).toBe(75);
    expect(r.convertedToNeededQuantity).toBe(150);
    const statuses = kneelers.map((k) => k.hardware![0].status);
    expect(statuses.filter((s) => s === "upcoming").length).toBe(25);
    expect(statuses.filter((s) => s === "needed").length).toBe(50);
    expect(kneelers[24].hardware![0].date).toBe("2000-01-01");
    expect(kneelers[25].hardware![0].date).toBeUndefined();
  });

  it("uses default retain quantity and part id when options omitted", () => {
    const kneelers = Array.from({ length: 30 }, (_, i) => ({
      id: `k-${i}`,
      capacity: 3,
      hardware: [sole(3, "2000-01-01")],
    }));
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [{ id: "r1", label: "Row 1", frontType: "pew", kneelers }],
      },
    ];
    const r = retainUpcomingPrayerSoleQuantity(sections);
    expect(r.retainedUpcomingQuantity).toBe(75);
    expect(r.convertedToNeededQuantity).toBe(15);
  });
});

describe("reselectUpcomingPrayerSoleInRowMajorOrder defaults", () => {
  it("applies default retain, part id, and transept row", () => {
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "a", capacity: 3, hardware: [sole(100, "x")] }],
          },
        ],
      },
    ];
    const r = reselectUpcomingPrayerSoleInRowMajorOrder(sections);
    expect(r.retainedUpcomingQuantity).toBe(100);
    expect(sections[0].rows[0].kneelers[0].hardware![0].status).toBe("upcoming");
  });

  it("ignores kneelers without hardware and non-needed lines when promoting", () => {
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              { id: "no-hw", capacity: 3 },
              {
                id: "mix",
                capacity: 3,
                hardware: [
                  soleNeeded(10),
                  {
                    partId: "kneeler-boot-compound-fastened",
                    name: "Prayer Sole",
                    quantity: 5,
                    status: "installed",
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    reselectUpcomingPrayerSoleInRowMajorOrder(sections, { retainQuantity: 100, transeptGridRow: 9 });
    const mix = sections[0].rows[0].kneelers[1].hardware!;
    expect(mix[0].status).toBe("upcoming");
    expect(mix[1].status).toBe("installed");
  });

  it("skips sections that have no row for the current grid number", () => {
    const sections: PewSection[] = [
      {
        id: "west-main",
        label: "WM",
        type: "pews",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "wm-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [{ id: "a", capacity: 3, hardware: [soleNeeded(80)] }],
          },
        ],
      },
      {
        id: "west-rear",
        label: "WR",
        type: "pews",
        side: "west",
        alignment: "nave",
        group: 2,
        rows: [],
      },
    ];
    reselectUpcomingPrayerSoleInRowMajorOrder(sections, { retainQuantity: 10, transeptGridRow: 9 });
    expect(sections[0].rows[0].kneelers[0].hardware![0].status).toBe("upcoming");
  });
});
