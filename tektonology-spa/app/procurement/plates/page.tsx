"use client";

import Link from "next/link";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";
import { useCrud } from "@/lib/use-crud";
import { CrudTable, type Column } from "@/components/crud-table";
import { JournalSelect } from "@/components/journal-select";
import { FormField, inputClass, monoInputClass } from "@/components/form-field";

interface PlateData {
  plateId: number;
  brand: string;
  plate: string;
  effective: string;
  baseCost: number;
  taxes: number;
  shipping: number;
  cost: number;
  hoursUsed: number;
  journalId?: number;
  deletedAt?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const columns: Column<PlateData>[] = [
  { key: "plateId", label: "#", mono: true, render: (p) => <span className="text-xs text-muted-foreground">{p.plateId}</span> },
  { key: "brand", label: "Brand" },
  { key: "plate", label: "Plate" },
  { key: "effective", label: "Purchased" },
  { key: "cost", label: "Cost", align: "right", mono: true, render: (p) => fmt(p.cost) },
  { key: "hoursUsed", label: "Hours", align: "right", mono: true, render: (p) => p.hoursUsed.toFixed(1) },
  { key: "journalId", label: "Journal", mono: true, render: (p) => p.journalId ? `#${p.journalId}` : "—" },
];

const emptyFields = { brand: "", plate: "", effective: "", baseCost: "", taxes: "", shipping: "", cost: "", hoursUsed: "0", journalId: "" };

function PlateForm({ values, onChange }: { values: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <FormField label="Brand">
        <input type="text" value={values.brand} onChange={(e) => onChange("brand", e.target.value)} placeholder="e.g. Bambu" className={inputClass} />
      </FormField>
      <FormField label="Plate">
        <input type="text" value={values.plate} onChange={(e) => onChange("plate", e.target.value)} placeholder="e.g. Textured PEI" className={inputClass} />
      </FormField>
      <FormField label="Date Purchased">
        <input type="date" value={values.effective} onChange={(e) => onChange("effective", e.target.value)} className={inputClass} />
      </FormField>
      <FormField label="Base Cost">
        <input type="number" step="0.01" value={values.baseCost} onChange={(e) => onChange("baseCost", e.target.value)} placeholder="0.00" className={monoInputClass} />
      </FormField>
      <FormField label="Taxes">
        <input type="number" step="0.01" value={values.taxes} onChange={(e) => onChange("taxes", e.target.value)} placeholder="0.00" className={monoInputClass} />
      </FormField>
      <FormField label="Shipping">
        <input type="number" step="0.01" value={values.shipping} onChange={(e) => onChange("shipping", e.target.value)} placeholder="0.00" className={monoInputClass} />
      </FormField>
      <FormField label="Total Cost">
        <input type="number" step="0.01" value={values.cost} onChange={(e) => onChange("cost", e.target.value)} placeholder="0.00" className={monoInputClass} />
      </FormField>
      <FormField label="Hours Used">
        <input type="number" step="0.1" value={values.hoursUsed} onChange={(e) => onChange("hoursUsed", e.target.value)} placeholder="0" className={monoInputClass} />
      </FormField>
      <FormField label="Journal Entry">
        <JournalSelect value={values.journalId} onChange={(v) => onChange("journalId", v)} />
      </FormField>
    </div>
  );
}

export default function PlatesPage() {
  const crud = useCrud<PlateData>("/api/procurement/plates");
  const { role } = useRole();
  const writable = canWrite(role);

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>&rsaquo;</span>
        <Link href="/procurement" className="hover:text-foreground transition-colors">Procurement</Link>
        <span>&rsaquo;</span>
        <span className="text-foreground">Plates</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Build Plates</h1>
        {crud.items && (
          <p className="text-muted-foreground text-sm">
            {crud.items.filter((p) => !p.deletedAt).length} plates — {crud.items.filter((p) => !p.deletedAt).reduce((s, p) => s + p.hoursUsed, 0).toFixed(0)} total hours
          </p>
        )}
      </div>

      <CrudTable<PlateData>
        crud={crud}
        columns={columns}
        getId={(p) => p.plateId}
        isDeleted={(p) => !!p.deletedAt}
        writable={writable}
        emptyFields={emptyFields}
        title="Plate"
        renderForm={(values, onChange) => <PlateForm values={values} onChange={onChange} />}
        toPayload={(v) => ({
          brand: v.brand?.trim(),
          plate: v.plate?.trim(),
          effective: v.effective,
          baseCost: parseFloat(v.baseCost) || 0,
          taxes: parseFloat(v.taxes) || 0,
          shipping: parseFloat(v.shipping) || 0,
          cost: parseFloat(v.cost) || 0,
          hoursUsed: parseFloat(v.hoursUsed) || 0,
          ...(v.journalId ? { journalId: parseInt(v.journalId) } : {}),
        })}
        fromItem={(p) => ({
          brand: p.brand,
          plate: p.plate,
          effective: p.effective,
          baseCost: String(p.baseCost),
          taxes: String(p.taxes),
          shipping: String(p.shipping),
          cost: String(p.cost),
          hoursUsed: String(p.hoursUsed),
          journalId: p.journalId ? String(p.journalId) : "",
        })}
      />
    </div>
    </RequireRole>
  );
}
