"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TransactionForm } from "@/components/transaction-form";
import { LoadingState, ErrorState } from "@/components/api-error";
import { apiFetch } from "@/lib/api";

interface AccountInfo {
  number: number;
  name: string;
  type: string;
}

export default function NewTransactionPage() {
  const [accounts, setAccounts] = useState<AccountInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AccountInfo[]>("/api/accounts")
      .then(setAccounts)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/accounting" className="hover:text-foreground transition-colors">Accounting</Link>
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
  );
}
