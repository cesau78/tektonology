"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";

interface DashboardData {
  manufacturing: {
    totalPrintHours: number;
    totalPrintCost: number;
    totalJobs: number;
    failedJobs: number;
    scrapRate: string;
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function ManufacturingDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  const navItems = [
    { href: "/manufacturing/print-jobs", label: "Print Jobs", desc: "Production log" },
    { href: "/manufacturing/components", label: "Components", desc: "Printed parts ready for assembly" },
    { href: "/manufacturing/inventory", label: "Inventory", desc: "Assembled product inventory" },
  ];

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <span className="text-foreground">Manufacturing</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Manufacturing</h1>
        <p className="text-muted-foreground text-sm">Production and print job tracking.</p>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Print Hours</p>
                  <p className="text-lg font-semibold text-foreground">{data.manufacturing.totalPrintHours.toFixed(0)} hrs</p>
                  <p className="text-xs text-muted-foreground">{fmt(data.manufacturing.totalPrintCost)} in materials</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Scrap Rate</p>
                  <p className="text-lg font-semibold text-foreground">{data.manufacturing.scrapRate}%</p>
                  <p className="text-xs text-muted-foreground">{data.manufacturing.failedJobs} of {data.manufacturing.totalJobs} jobs failed</p>
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
