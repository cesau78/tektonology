"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface InventoryUpdateRow {
  date: string;
  inspected: number;
  needed: number;
  upcoming: number;
  installed: number;
}

export type InventoryUpdatesData = Record<string, InventoryUpdateRow[]>;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(m!, 10)}/${parseInt(d!, 10)}/${y}`;
}

export function InventoryUpdatesCard({
  updatesData,
  partNames,
}: {
  updatesData: InventoryUpdatesData;
  partNames: string[];
}) {
  const searchParams = useSearchParams();
  const partParam = searchParams.get("part");

  const selectedPart =
    partNames.find(
      (n) => n === partParam || n.toLowerCase().replace(/\s+/g, "-") === partParam,
    ) ?? partNames[0];

  const rows = selectedPart ? (updatesData[selectedPart] ?? []) : [];

  return (
    <Card className="mb-6 mt-6">
      <CardHeader>
        <CardTitle className="text-base">
          Inventory Updates
          {selectedPart && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              &mdash; {selectedPart}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No dated updates for {selectedPart ?? "this part"}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium text-right">Inspected</th>
                  <th className="pb-2 font-medium text-right">Needed</th>
                  <th className="pb-2 font-medium text-right">Upcoming</th>
                  <th className="pb-2 font-medium text-right">Installed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date} className="border-b border-border/50">
                    <td className="py-2 tabular-nums">{formatDate(row.date)}</td>
                    <td className="py-2 text-right">
                      {row.inspected > 0 && (
                        <Badge className="bg-teal-100 text-teal-900 border-teal-300 hover:bg-teal-100 text-xs">
                          {row.inspected}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.needed > 0 && (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100 text-xs">
                          {row.needed}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.upcoming > 0 && (
                        <Badge className="bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-100 text-xs">
                          {row.upcoming}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.installed > 0 && (
                        <Badge className="bg-green-100 text-green-900 border-green-300 hover:bg-green-100 text-xs">
                          {row.installed}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
