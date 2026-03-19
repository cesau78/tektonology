"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";

interface HardwareData {
  hardwareId: number;
  supplier: string;
  item: string;
  dimensions: string;
  cost: number;
  quantity: number;
  remaining: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function HardwarePage() {
  const [hardware, setHardware] = useState<HardwareData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<HardwareData[]>("/api/procurement/hardware")
      .then(setHardware)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  const totalCost = hardware?.reduce((s, h) => s + h.cost, 0) ?? 0;
  const totalPieces = hardware?.reduce((s, h) => s + h.remaining, 0) ?? 0;

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/procurement" className="hover:text-foreground transition-colors">Procurement</Link>
        <span>›</span>
        <span className="text-foreground">Hardware Inventory</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Hardware Inventory</h1>
        {hardware && (
          <p className="text-muted-foreground text-sm">
            {totalPieces.toLocaleString()} pieces on hand — {fmt(totalCost)} invested
          </p>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {!hardware && !error && <LoadingState />}

      {hardware && (
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left font-medium pb-2">#</th>
                  <th className="text-left font-medium pb-2">Item</th>
                  <th className="text-left font-medium pb-2">Supplier</th>
                  <th className="text-left font-medium pb-2">Dimensions</th>
                  <th className="text-right font-medium pb-2">Cost</th>
                  <th className="text-right font-medium pb-2">Unit</th>
                  <th className="text-right font-medium pb-2">Qty</th>
                  <th className="text-right font-medium pb-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {hardware.map((h) => {
                  const unitCost = h.quantity > 0 ? h.cost / h.quantity : 0;
                  return (
                    <tr key={h.hardwareId} className="border-t border-border/50">
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">{h.hardwareId}</td>
                      <td className="py-1.5 font-medium">{h.item}</td>
                      <td className="py-1.5 text-muted-foreground">{h.supplier}</td>
                      <td className="py-1.5 font-mono text-xs">{h.dimensions}</td>
                      <td className="py-1.5 text-right font-mono">{fmt(h.cost)}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{fmt(unitCost)}</td>
                      <td className="py-1.5 text-right font-mono">{h.quantity.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono">{h.remaining.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
    </RequireRole>
  );
}
