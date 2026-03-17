"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";

interface SpoolData {
  spoolId: number;
  brand: string;
  material: string;
  color: string;
  cost: number;
  weightG: number;
  remainingG: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const materialColor: Record<string, string> = {
  "TPU 90A": "bg-violet-100 text-violet-900 border-violet-300",
  "PLA Pro": "bg-amber-100 text-amber-900 border-amber-300",
  PETG: "bg-sky-100 text-sky-900 border-sky-300",
};

export default function SpoolsPage() {
  const [spools, setSpools] = useState<SpoolData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<SpoolData[]>("/api/spools")
      .then(setSpools)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  const totalRemaining = spools?.reduce((s, sp) => s + sp.remainingG, 0) ?? 0;
  const totalWeight = spools?.reduce((s, sp) => s + sp.weightG, 0) ?? 0;
  const totalCost = spools?.reduce((s, sp) => s + sp.cost, 0) ?? 0;

  // Group by material
  const byMaterial = new Map<string, SpoolData[]>();
  for (const s of spools ?? []) {
    const list = byMaterial.get(s.material) ?? [];
    list.push(s);
    byMaterial.set(s.material, list);
  }

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/operations" className="hover:text-foreground transition-colors">Operations</Link>
        <span>›</span>
        <span className="text-foreground">Filament Spools</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Filament Spools</h1>
        {spools && (
          <p className="text-muted-foreground text-sm">
            {spools.length} spools — {(totalRemaining / 1000).toFixed(1)} kg remaining of {(totalWeight / 1000).toFixed(1)} kg purchased ({fmt(totalCost)} invested)
          </p>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {!spools && !error && <LoadingState />}

      {spools && (
        <div className="space-y-6">
          {Array.from(byMaterial.entries()).map(([material, items]) => {
            const groupRemaining = items.reduce((s, sp) => s + sp.remainingG, 0);
            const groupTotal = items.reduce((s, sp) => s + sp.weightG, 0);
            const groupCost = items.reduce((s, sp) => s + sp.cost, 0);

            return (
              <div key={material}>
                <div className="flex items-center gap-3 mb-3">
                  <Badge className={`${materialColor[material] ?? "bg-gray-100 text-gray-900 border-gray-300"} hover:bg-opacity-100`}>
                    {material}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {(groupRemaining / 1000).toFixed(1)} / {(groupTotal / 1000).toFixed(1)} kg — {fmt(groupCost)}
                  </span>
                  <div className="flex-1 border-t border-border" />
                </div>

                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                          <th className="text-left font-medium pb-2">#</th>
                          <th className="text-left font-medium pb-2">Brand</th>
                          <th className="text-left font-medium pb-2">Color</th>
                          <th className="text-right font-medium pb-2">Cost</th>
                          <th className="text-right font-medium pb-2">$/g</th>
                          <th className="text-right font-medium pb-2">Remaining</th>
                          <th className="text-right font-medium pb-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((s) => {
                          const pct = s.weightG > 0 ? (s.remainingG / s.weightG) * 100 : 0;
                          const costPerG = s.weightG > 0 ? s.cost / s.weightG : 0;
                          return (
                            <tr key={s.spoolId} className="border-t border-border/50">
                              <td className="py-1.5 font-mono text-xs text-muted-foreground">{s.spoolId}</td>
                              <td className="py-1.5">{s.brand}</td>
                              <td className="py-1.5">{s.color}</td>
                              <td className="py-1.5 text-right font-mono">{fmt(s.cost)}</td>
                              <td className="py-1.5 text-right font-mono text-xs">{costPerG.toFixed(3)}</td>
                              <td className="py-1.5 text-right font-mono">{s.remainingG.toFixed(0)}g</td>
                              <td className="py-1.5 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </RequireRole>
  );
}
