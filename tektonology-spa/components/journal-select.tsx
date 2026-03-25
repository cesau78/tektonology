"use client";

import { useEffect, useState } from "react";
import { useApiFetch } from "@/lib/api";

interface JournalEntry {
  transactionId: number;
  effective: string;
  description: string;
}

interface JournalSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function JournalSelect({ value, onChange }: JournalSelectProps) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<JournalEntry[]>("/api/finance/journal")
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [apiFetch]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
    >
      <option value="">— None —</option>
      {entries?.map((j) => (
        <option key={j.transactionId} value={String(j.transactionId)}>
          #{j.transactionId} — {j.effective} — {j.description}
        </option>
      ))}
    </select>
  );
}
