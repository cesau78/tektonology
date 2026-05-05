import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as navigation from "next/navigation";
import { InventoryUpdatesCard, type InventoryUpdatesData } from "./inventory-updates-card";

afterEach(cleanup);

const sampleData: InventoryUpdatesData = {
  "Prayer Sole": [
    { date: "2028-04-12", inspected: 0, needed: 3, upcoming: 0, installed: 0 },
    { date: "2028-05-03", inspected: 0, needed: 0, upcoming: 4, installed: 6 },
  ],
  "Kneeler Plate": [
    { date: "2028-05-03", inspected: 2, needed: 0, upcoming: 0, installed: 1 },
  ],
};

const partNames = ["Kneeler Plate", "Prayer Sole"];

describe("InventoryUpdatesCard", () => {
  it("renders title with first part when no URL param is set", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("") as ReturnType<typeof navigation.useSearchParams>,
    );

    const { container } = render(
      <InventoryUpdatesCard updatesData={sampleData} partNames={partNames} />,
    );

    expect(container).toHaveTextContent("Inventory Updates");
    expect(container).toHaveTextContent("Kneeler Plate");
  });

  it("selects part from URL ?part= param by exact name", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=Prayer Sole") as ReturnType<typeof navigation.useSearchParams>,
    );

    const { container } = render(
      <InventoryUpdatesCard updatesData={sampleData} partNames={partNames} />,
    );

    expect(container).toHaveTextContent("Prayer Sole");
    expect(container).toHaveTextContent("4/12/2028");
    expect(container).toHaveTextContent("5/3/2028");
  });

  it("selects part from URL ?part= param by slug (lowercase-hyphenated)", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=prayer-sole") as ReturnType<typeof navigation.useSearchParams>,
    );

    const { container } = render(
      <InventoryUpdatesCard updatesData={sampleData} partNames={partNames} />,
    );

    expect(container).toHaveTextContent("Prayer Sole");
    expect(container).toHaveTextContent("4/12/2028");
  });

  it("renders status badges for non-zero counts", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=Prayer Sole") as ReturnType<typeof navigation.useSearchParams>,
    );

    const { container } = render(
      <InventoryUpdatesCard updatesData={sampleData} partNames={partNames} />,
    );

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);

    expect(rows[0]).toHaveTextContent("3");
    expect(rows[1]).toHaveTextContent("6");
  });

  it("renders empty state when selected part has no dated updates", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=Spacer") as ReturnType<typeof navigation.useSearchParams>,
    );

    const data: InventoryUpdatesData = { "Prayer Sole": [] };
    const { container } = render(
      <InventoryUpdatesCard updatesData={data} partNames={["Prayer Sole", "Spacer"]} />,
    );

    expect(container).toHaveTextContent("No dated updates");
  });

  it("renders empty state when partNames is empty", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("") as ReturnType<typeof navigation.useSearchParams>,
    );

    const { container } = render(
      <InventoryUpdatesCard updatesData={{}} partNames={[]} />,
    );

    expect(container).toHaveTextContent("No dated updates");
  });

  it("renders all four status column headers", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=Kneeler Plate") as ReturnType<typeof navigation.useSearchParams>,
    );

    const { container } = render(
      <InventoryUpdatesCard updatesData={sampleData} partNames={partNames} />,
    );

    const headers = container.querySelectorAll("thead th");
    const labels = Array.from(headers).map((h) => h.textContent);
    expect(labels).toEqual(["Date", "Inspected", "Needed", "Upcoming", "Installed"]);
  });

  it("does not render badges for zero counts", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=Kneeler Plate") as ReturnType<typeof navigation.useSearchParams>,
    );

    const { container } = render(
      <InventoryUpdatesCard updatesData={sampleData} partNames={partNames} />,
    );

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1);

    const cells = rows[0].querySelectorAll("td");
    expect(cells[0]).toHaveTextContent("5/3/2028");
    expect(cells[1]).toHaveTextContent("2");
    expect(cells[2]).toHaveTextContent("");
    expect(cells[3]).toHaveTextContent("");
    expect(cells[4]).toHaveTextContent("1");
  });

  it("falls back to first part when URL param doesn't match any part", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=nonexistent") as ReturnType<typeof navigation.useSearchParams>,
    );

    const { container } = render(
      <InventoryUpdatesCard updatesData={sampleData} partNames={partNames} />,
    );

    expect(container).toHaveTextContent("Kneeler Plate");
    expect(container).toHaveTextContent("5/3/2028");
  });
});
