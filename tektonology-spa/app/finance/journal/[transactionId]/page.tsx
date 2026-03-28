"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";

interface JournalLine {
  accountNumber: number;
  accountName: string;
  debit: number | null;
  credit: number | null;
  description?: string;
}

interface JournalEntry {
  transactionId: number;
  effective: string;
  description: string;
  lines: JournalLine[];
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function codeColor(code: number): string {
  if (code < 2000) return "text-emerald-700";
  if (code < 3000) return "text-red-700";
  if (code < 4000) return "text-blue-700";
  if (code < 5000) return "text-emerald-700";
  return "text-orange-700";
}

export default function TransactionDetailPage() {
  const params = useParams();
  const transactionId = parseInt(params.transactionId as string, 10);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    if (Number.isNaN(transactionId)) {
      setError("Invalid transaction ID");
      return;
    }
    apiFetch<JournalEntry[]>("/api/finance/journal?includeDeleted=true")
      .then((entries) => {
        const found = entries.find((e) => e.transactionId === transactionId);
        if (!found) {
          setError("Transaction not found");
          return;
        }
        setEntry(found);
      })
      .catch((e) => setError(e.message));
  }, [apiFetch, transactionId]);

  const dr = entry?.lines.reduce((s, l) => s + (l.debit ?? 0), 0) ?? 0;
  const cr = entry?.lines.reduce((s, l) => s + (l.credit ?? 0), 0) ?? 0;
  const unbalanced = Math.abs(dr - cr) >= 0.005;

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/finance" className="hover:text-foreground transition-colors">Finance</Link>
        <span>›</span>
        <Link href="/finance/journal" className="hover:text-foreground transition-colors">Journal</Link>
        <span>›</span>
        <span className="text-foreground">Transaction #{transactionId}</span>
      </nav>

      {error && <ErrorState message={error} />}
      {!entry && !error && <LoadingState />}

      {entry && (
        <Card className={`shadow-sm ${unbalanced ? "border-red-400 bg-red-50/50" : ""}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Transaction #{entry.transactionId}
                {entry.description && (
                  <span className="ml-2 font-normal text-muted-foreground">— {entry.description}</span>
                )}
                {unbalanced && (
                  <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300">
                    Unbalanced (off by ${Math.abs(dr - cr).toFixed(2)})
                  </span>
                )}
              </CardTitle>
              <span className="text-xs text-muted-foreground">{entry.effective}</span>
            </div>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left font-medium pb-1">Account</th>
                  <th className="text-right font-medium pb-1 w-28 px-3">Debit</th>
                  <th className="text-right font-medium pb-1 w-28 px-3">Credit</th>
                  <th className="text-left font-medium pb-1 pl-4">Memo</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1.5">
                      <Link
                        href={`/finance/accounts/${line.accountNumber}`}
                        className={`font-mono text-xs hover:underline ${codeColor(line.accountNumber)}`}
                      >
                        {line.accountNumber}
                      </Link>
                      <Link
                        href={`/finance/accounts/${line.accountNumber}`}
                        className="ml-2 text-foreground hover:text-blue-600 hover:underline"
                      >
                        {line.accountName}
                      </Link>
                    </td>
                    <td className="text-right font-mono py-1.5 px-3">
                      {line.debit != null ? fmt(line.debit) : ""}
                    </td>
                    <td className="text-right font-mono py-1.5 px-3">
                      {line.credit != null ? fmt(line.credit) : ""}
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground pl-4">
                      {line.description ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex items-center gap-4 text-sm border-t pt-2">
              <span className="text-muted-foreground">Total Debits: <span className="font-mono font-semibold">{fmt(dr)}</span></span>
              <span className="text-muted-foreground">Total Credits: <span className="font-mono font-semibold">{fmt(cr)}</span></span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </RequireRole>
  );
}
