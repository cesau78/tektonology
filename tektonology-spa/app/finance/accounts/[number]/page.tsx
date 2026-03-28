"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";

interface Account {
  number: number;
  name: string;
  type: string;
  balance: number;
}

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

const typeLabels: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  cogs: "COGS",
  expense: "Expense",
};

const typeColors: Record<string, string> = {
  asset: "bg-emerald-100 text-emerald-900 border-emerald-300",
  liability: "bg-red-100 text-red-900 border-red-300",
  equity: "bg-blue-100 text-blue-900 border-blue-300",
  revenue: "bg-violet-100 text-violet-900 border-violet-300",
  cogs: "bg-orange-100 text-orange-900 border-orange-300",
  expense: "bg-amber-100 text-amber-900 border-amber-300",
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AccountDetailPage() {
  const params = useParams();
  const accountNumber = parseInt(params.number as string, 10);
  const [account, setAccount] = useState<Account | null>(null);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    if (Number.isNaN(accountNumber)) {
      setError("Invalid account number");
      return;
    }
    Promise.all([
      apiFetch<Account[]>("/api/finance/accounts"),
      apiFetch<JournalEntry[]>(`/api/finance/journal?accountNumber=${accountNumber}`),
    ])
      .then(([accounts, journal]) => {
        const acct = accounts.find((a) => a.number === accountNumber);
        if (!acct) {
          setError("Account not found");
          return;
        }
        setAccount(acct);
        setEntries(journal);
      })
      .catch((e) => setError(e.message));
  }, [apiFetch, accountNumber]);

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/finance" className="hover:text-foreground transition-colors">Finance</Link>
        <span>›</span>
        <Link href="/finance/accounts" className="hover:text-foreground transition-colors">Chart of Accounts</Link>
        <span>›</span>
        <span className="text-foreground">{account ? `${account.number}: ${account.name}` : accountNumber}</span>
      </nav>

      {error && <ErrorState message={error} />}
      {!account && !error && <LoadingState />}

      {account && (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{account.number}: {account.name}</h1>
              <Badge className={`${typeColors[account.type] ?? ""} hover:bg-opacity-100 text-xs`}>
                {typeLabels[account.type] ?? account.type}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Balance: <span className="font-mono font-semibold text-foreground">{fmt(account.balance)}</span>
            </p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">
                Transactions
                {entries && <span className="ml-2 font-normal text-muted-foreground">({entries.length})</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!entries && <LoadingState />}
              {entries && entries.length === 0 && (
                <p className="text-sm text-muted-foreground">No transactions for this account.</p>
              )}
              {entries && entries.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="text-left font-medium pb-1 w-16">Txn #</th>
                      <th className="text-left font-medium pb-1 w-28">Date</th>
                      <th className="text-left font-medium pb-1">Description</th>
                      <th className="text-right font-medium pb-1 w-28 px-3">Debit</th>
                      <th className="text-right font-medium pb-1 w-28 px-3">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const line = entry.lines.find((l) => l.accountNumber === accountNumber);
                      if (!line) return null;
                      return (
                        <tr key={entry.transactionId} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-1.5">
                            <Link
                              href={`/finance/journal/${entry.transactionId}`}
                              className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              #{entry.transactionId}
                            </Link>
                          </td>
                          <td className="py-1.5 text-muted-foreground">{entry.effective}</td>
                          <td className="py-1.5 text-foreground">{entry.description}</td>
                          <td className="text-right font-mono py-1.5 px-3">
                            {line.debit != null ? fmt(line.debit) : ""}
                          </td>
                          <td className="text-right font-mono py-1.5 px-3">
                            {line.credit != null ? fmt(line.credit) : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </RequireRole>
  );
}
