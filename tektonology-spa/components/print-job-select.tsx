"use client";

import { useEffect, useState } from "react";
import { useApiFetch } from "@/lib/api";

interface PrintJobOption {
  _id: string;
  project: string;
  effective: string;
  outcome: string;
  components: { part: string; quantity: number }[];
}

interface PrintJobSelectProps {
  value: string;
  onChange: (value: string, job?: PrintJobOption) => void;
}

export function PrintJobSelect({ value, onChange }: PrintJobSelectProps) {
  const [jobs, setJobs] = useState<PrintJobOption[] | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<PrintJobOption[]>("/api/manufacturing/print-jobs")
      .then(setJobs)
      .catch(() => setJobs([]));
  }, [apiFetch]);

  const handleChange = (id: string) => {
    const job = jobs?.find((j) => j._id === id);
    onChange(id, job);
  };

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
    >
      <option value="">— None —</option>
      {jobs?.map((j) => {
        const parts = j.components.map((c) => `${c.quantity}× ${c.part}`).join(", ");
        return (
          <option key={j._id} value={j._id}>
            {j.effective} — {j.project} — {j.outcome}{parts ? ` (${parts})` : ""}
          </option>
        );
      })}
    </select>
  );
}
