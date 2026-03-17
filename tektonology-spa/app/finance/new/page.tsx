"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TransactionForm } from "@/components/transaction-form";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";

interface AccountInfo {
  number: number;
  name: string;
  type: string;
}

export default function NewTransactionPage() {
  const [accounts, setAccounts] = useState<AccountInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<AccountInfo[]>("/api/accounts")
      .then(setAccounts)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  return (
    <RequireRole roles={["owner"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/finance" className="hover:text-foreground transition-colors">Finance</Link>
        <span>›</span>
        <span className="text-foreground">New Transaction</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">New Transaction</h1>
        <p className="text-muted-foreground text-sm">
          Create a new journal entry. Debits must equal credits.
        </p>
      </div>

      {error && <ErrorState message={error} />}
      {!accounts && !error && <LoadingState />}

      {accounts && <TransactionForm accounts={accounts} />}
    </div>
    </RequireRole>
  );
}
