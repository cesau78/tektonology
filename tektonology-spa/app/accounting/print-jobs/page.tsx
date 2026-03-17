"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";

interface PrintJobData {
  batchId: number;
  date: string;
  project: string;
  product: string;
  spool: string;
  usageG: number;
  totalHours: number;
  cost: number;
  success: boolean | null;
  usage: string;
  quantity: number;
  part: string;
  comments: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const usageBadge: Record<string, string> = {
  Prototype: "bg-blue-100 text-blue-900 border-blue-300",
  Inventory: "bg-emerald-100 text-emerald-900 border-emerald-300",
  Scrap: "bg-red-100 text-red-900 border-red-300",
  Shop: "bg-violet-100 text-violet-900 border-violet-300",
};

export default function PrintJobsPage() {
  const [jobs, setJobs] = useState<PrintJobData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<PrintJobData[]>("/api/print-jobs")
      .then(setJobs)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  const totalHours = jobs?.reduce((s, j) => s + (j.totalHours ?? 0), 0) ?? 0;
  const totalCost = jobs?.reduce((s, j) => s + (j.cost ?? 0), 0) ?? 0;
  const totalUsage = jobs?.reduce((s, j) => s + (j.usageG ?? 0), 0) ?? 0;

  // Group by usage type
  const byUsage: Record<string, { count: number; hours: number; cost: number }> = {};
  for (const j of jobs ?? []) {
    const u = j.usage || "Unknown";
    if (!byUsage[u]) byUsage[u] = { count: 0, hours: 0, cost: 0 };
    byUsage[u].count++;
    byUsage[u].hours += j.totalHours ?? 0;
    byUsage[u].cost += j.cost ?? 0;
  }

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/accounting" className="hover:text-foreground transition-colors">Accounting</Link>
        <span>›</span>
        <span className="text-foreground">Print Jobs</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Print Jobs</h1>
        {jobs && (
          <p className="text-muted-foreground text-sm">
            {jobs.length} jobs — {totalHours.toFixed(0)} hours — {(totalUsage / 1000).toFixed(1)} kg used — {fmt(totalCost)} in materials
          </p>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {!jobs && !error && <LoadingState />}

      {jobs && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Object.entries(byUsage).map(([type, stats]) => (
              <Card key={type} className="shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <Badge className={`${usageBadge[type] ?? "bg-gray-100 text-gray-900 border-gray-300"} hover:bg-opacity-100 mb-2`}>
                    {type}
                  </Badge>
                  <p className="text-lg font-semibold">{stats.count}</p>
                  <p className="text-xs text-muted-foreground">{stats.hours.toFixed(0)} hrs — {fmt(stats.cost)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm overflow-x-auto">
            <CardContent className="pt-4">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left font-medium pb-2">Batch</th>
                    <th className="text-left font-medium pb-2">Date</th>
                    <th className="text-left font-medium pb-2">Part</th>
                    <th className="text-center font-medium pb-2">Status</th>
                    <th className="text-left font-medium pb-2">Type</th>
                    <th className="text-right font-medium pb-2">Qty</th>
                    <th className="text-right font-medium pb-2">Grams</th>
                    <th className="text-right font-medium pb-2">Hours</th>
                    <th className="text-right font-medium pb-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">{j.batchId}</td>
                      <td className="py-1.5 text-xs">{j.date}</td>
                      <td className="py-1.5">
                        <span className="text-foreground">{j.part}</span>
                        {j.comments && (
                          <span className="ml-1 text-xs text-muted-foreground" title={j.comments}>*</span>
                        )}
                      </td>
                      <td className="py-1.5 text-center">
                        <span className={j.success === true ? "text-emerald-600" : j.success === false ? "text-red-600" : "text-muted-foreground"}>
                          {j.success === true ? "Pass" : j.success === false ? "Fail" : "—"}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <Badge variant="outline" className={`text-xs ${usageBadge[j.usage] ?? ""} hover:bg-opacity-100`}>
                          {j.usage}
                        </Badge>
                      </td>
                      <td className="py-1.5 text-right font-mono">{j.quantity}</td>
                      <td className="py-1.5 text-right font-mono">{(j.usageG ?? 0).toFixed(0)}</td>
                      <td className="py-1.5 text-right font-mono">{(j.totalHours ?? 0).toFixed(1)}</td>
                      <td className="py-1.5 text-right font-mono">{fmt(j.cost ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </RequireRole>
  );
}
