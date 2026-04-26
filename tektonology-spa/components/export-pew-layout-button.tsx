"use client";

import { useState } from "react";
import type { Project } from "@/data/types";

function safeFileSegment(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "export";
}

type Props = {
  project: Project;
  /** If set, only that section (one sheet in the workbook). */
  sectionId?: string;
  label?: string;
  hint?: string;
  className?: string;
};

const baseBtn =
  "text-xs font-medium text-foreground border border-border rounded-md px-3 py-1.5 inline-block hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:pointer-events-none";

/**
 * Client-only: loads exceljs in a split chunk, then builds the workbook in-browser
 * (compatible with `output: 'export'`; no API route).
 */
export function ExportPewLayoutButton({ project, sectionId, label, hint, className }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <span className={className ?? "mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-2"}>
      <button
        type="button"
        className={baseBtn + " w-fit"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { buildPewLayoutWorkbook } = await import("@/lib/pew-sections-excel");
            const u8 = await buildPewLayoutWorkbook(project, { sectionId });
            const name = sectionId
              ? `${safeFileSegment(project.id)}-section-${safeFileSegment(sectionId)}-pew-layout.xlsx`
              : `${safeFileSegment(project.id)}-pew-layout.xlsx`;
            const ab = u8.buffer.slice(
              u8.byteOffset,
              u8.byteOffset + u8.byteLength,
            ) as ArrayBuffer;
            const blob = new Blob([ab], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            URL.revokeObjectURL(a.href);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing…" : (label ?? "Download pew layout (Excel)")}
      </button>
      {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
    </span>
  );
}
