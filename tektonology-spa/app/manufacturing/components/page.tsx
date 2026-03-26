"use client";

import Link from "next/link";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";
import { useCrud } from "@/lib/use-crud";
import { CrudTable, type Column } from "@/components/crud-table";
import { FormField, inputClass, monoInputClass } from "@/components/form-field";
import { PrintJobSelect } from "@/components/print-job-select";

interface ComponentStockData {
  batchId: number;
  part: string;
  effective: string;
  quantity: number;
  remaining: number;
  printJobId?: string;
  deletedAt?: string;
}

const columns: Column<ComponentStockData>[] = [
  { key: "batchId", label: "Batch", mono: true, render: (c) => <span className="text-xs text-muted-foreground">{c.batchId}</span> },
  { key: "part", label: "Part", render: (c) => <span className="font-medium">{c.part}</span> },
  { key: "effective", label: "Produced" },
  { key: "quantity", label: "Qty", align: "right", mono: true },
  { key: "remaining", label: "Remaining", align: "right", mono: true },
  {
    key: "pct", label: "%", align: "right",
    render: (c) => {
      const pct = c.quantity > 0 ? (c.remaining / c.quantity) * 100 : 0;
      return (
        <div className="inline-flex items-center gap-1.5">
          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
          </div>
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
        </div>
      );
    },
  },
];

const emptyFields = { part: "", effective: "", quantity: "", remaining: "", printJobId: "" };

function ComponentForm({ values, onChange }: { values: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <FormField label="Part">
        <input type="text" value={values.part} onChange={(e) => onChange("part", e.target.value)} placeholder="e.g. Insert, Cap, Slipper" className={inputClass} autoFocus />
      </FormField>
      <FormField label="Date Produced">
        <input type="date" value={values.effective} onChange={(e) => onChange("effective", e.target.value)} className={inputClass} />
      </FormField>
      <FormField label="Print Job">
        <PrintJobSelect
          value={values.printJobId}
          onChange={(id, job) => {
            onChange("printJobId", id);
            if (job && job.components.length > 0) {
              onChange("part", job.components[0].part);
              onChange("quantity", String(job.components[0].quantity));
              onChange("remaining", String(job.components[0].quantity));
            }
          }}
        />
      </FormField>
      <FormField label="Quantity Produced">
        <input type="number" value={values.quantity} onChange={(e) => onChange("quantity", e.target.value)} placeholder="0" className={monoInputClass} />
      </FormField>
      <FormField label="Remaining">
        <input type="number" value={values.remaining} onChange={(e) => onChange("remaining", e.target.value)} placeholder="0" className={monoInputClass} />
      </FormField>
    </div>
  );
}

export default function ComponentsPage() {
  const crud = useCrud<ComponentStockData>("/api/manufacturing/components");
  const { role } = useRole();
  const writable = canWrite(role);

  const active = crud.items?.filter((c) => !c.deletedAt) ?? [];
  const totalQty = active.reduce((s, c) => s + c.quantity, 0);
  const totalRemaining = active.reduce((s, c) => s + c.remaining, 0);

  // Group by part for summary
  const byPart = new Map<string, { quantity: number; remaining: number }>();
  for (const c of active) {
    const prev = byPart.get(c.part) ?? { quantity: 0, remaining: 0 };
    byPart.set(c.part, { quantity: prev.quantity + c.quantity, remaining: prev.remaining + c.remaining });
  }

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>&rsaquo;</span>
        <Link href="/manufacturing" className="hover:text-foreground transition-colors">Manufacturing</Link>
        <span>&rsaquo;</span>
        <span className="text-foreground">Components</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Components</h1>
        <p className="text-muted-foreground text-sm">
          Printed parts ready for assembly — {totalRemaining} / {totalQty} pieces on hand
        </p>
      </div>

      {/* On-hand summary by part */}
      {byPart.size > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          {Array.from(byPart.entries()).map(([part, totals]) => (
            <div key={part} className="border border-border rounded-lg px-3 py-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{part}</div>
              <div className="text-lg font-semibold font-mono">{totals.remaining}</div>
              <div className="text-xs text-muted-foreground">of {totals.quantity} produced</div>
            </div>
          ))}
        </div>
      )}

      <CrudTable<ComponentStockData>
        crud={crud}
        columns={columns}
        getId={(c) => c.batchId}
        isDeleted={(c) => !!c.deletedAt}
        writable={writable}
        emptyFields={emptyFields}
        title="Component Batch"
        renderForm={(values, onChange) => <ComponentForm values={values} onChange={onChange} />}
        toPayload={(v) => ({
          part: v.part?.trim(),
          effective: v.effective,
          quantity: Number(v.quantity),
          remaining: Number(v.remaining),
          ...(v.printJobId ? { printJobId: v.printJobId.trim() } : {}),
        })}
        fromItem={(c) => ({
          part: c.part,
          effective: c.effective,
          quantity: String(c.quantity),
          remaining: String(c.remaining),
          printJobId: c.printJobId || "",
        })}
      />
    </div>
    </RequireRole>
  );
}
