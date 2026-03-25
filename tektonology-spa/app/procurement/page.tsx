"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";

interface DashboardData {
  procurement: {
    totalFilamentG: number;
    totalFilamentCost: number;
    activeSpools: number;
    depletedSpools: number;
    totalSpools: number;
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function ProcurementDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  const navItems = [
    { href: "/procurement/spools", label: "Filament Spools", desc: "Inventory tracking" },
    { href: "/procurement/hardware", label: "Hardware Inventory", desc: "Bolts, nuts, wrenches" },
    { href: "/procurement/printers", label: "Printers", desc: "3D printers and usage" },
    { href: "/procurement/nozzles", label: "Nozzles", desc: "Nozzle inventory and hours" },
    { href: "/procurement/plates", label: "Build Plates", desc: "Build plate tracking" },
  ];

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <span className="text-foreground">Procurement</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Procurement</h1>
        <p className="text-muted-foreground text-sm">Raw materials and sourcing.</p>
      </div>

      <div className="grid gap-4 [&>*]:shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="bg-card hover:shadow-md hover:border-amber-300 transition-all cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-sm">{item.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {error && <ErrorState message={error} />}
        {!data && !error && <LoadingState />}

        {data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Filament on Hand</p>
                  <p className="text-lg font-semibold text-foreground">{(data.procurement.totalFilamentG / 1000).toFixed(1)} kg</p>
                  <p className="text-xs text-muted-foreground">{fmt(data.procurement.totalFilamentCost)} invested</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Spools</p>
                  <p className="text-lg font-semibold text-foreground">{data.procurement.activeSpools} active</p>
                  <p className="text-xs text-muted-foreground">{data.procurement.depletedSpools} depleted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </RequireRole>
  );
}
