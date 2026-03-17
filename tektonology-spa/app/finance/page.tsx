"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";

interface DashboardData {
  balanceSheet: {
    byType: Record<string, { number: number; name: string; balance: number }[]>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  profitLoss: {
    revenue: number;
    expensesByCategory: Record<string, number>;
    totalExpenses: number;
    netIncome: number;
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function FinanceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { role } = useRole();
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  const allNavItems = [
    { href: "/finance/new", label: "New Transaction", desc: "Add a ledger entry", ownerOnly: true },
    { href: "/finance/ledger", label: "General Ledger", desc: "All transactions", ownerOnly: false },
  ];

  const navItems = allNavItems.filter((item) => !item.ownerOnly || canWrite(role));

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <span className="text-foreground">Finance</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Finance</h1>
        <p className="text-muted-foreground text-sm">Balance sheet, profit & loss, and transaction history.</p>
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
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Balance Sheet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Assets", type: "asset", color: "bg-emerald-100 text-emerald-900 border-emerald-300", total: data.balanceSheet.totalAssets },
                    { label: "Liabilities", type: "liability", color: "bg-red-100 text-red-900 border-red-300", total: data.balanceSheet.totalLiabilities },
                    { label: "Equity", type: "equity", color: "bg-blue-100 text-blue-900 border-blue-300", total: data.balanceSheet.totalEquity },
                  ].map(({ label, type, color, total }) => (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${color} hover:bg-opacity-100`}>{label}</Badge>
                        <span className="text-sm font-semibold text-foreground">{fmt(total)}</span>
                      </div>
                      <div className="space-y-1 pl-4">
                        {(data.balanceSheet.byType[type] ?? []).map((a) => (
                          <div key={a.number} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{a.number}: {a.name}</span>
                            <span className="font-mono text-foreground">{fmt(Math.abs(a.balance))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profit & Loss</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-700 font-medium">Revenue</span>
                    <span className="font-mono text-foreground">{fmt(data.profitLoss.revenue)}</span>
                  </div>
                  {Object.entries(data.profitLoss.expensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{cat}</span>
                        <span className="font-mono text-red-700">({fmt(amount)})</span>
                      </div>
                    ))}
                  <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                    <span>Net Income</span>
                    <span className={`font-mono ${data.profitLoss.netIncome >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {fmt(data.profitLoss.netIncome)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
    </RequireRole>
  );
}
