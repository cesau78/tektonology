"use client";

import { useState } from "react";
import type { Project } from "@/data/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function safeFileSegment(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "export";
}

/** Lowercase part name with runs of whitespace replaced by a single dash. */
function partNameFileToken(partName: string) {
  const t = partName.trim().toLowerCase().replace(/\s+/g, "-");
  return t || "part";
}

/** `-yyyymmdd` from local calendar date (at export time). */
function exportDateFileSuffix(): string {
  const at = new Date();
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `-${y}${m}${d}`;
}

type Props = {
  project: Project;
  /** If set, only that section (one sheet in the workbook). */
  sectionId?: string;
  /** When set, kneeler cells use this part’s hardware lines and status (same as map). */
  partName: string;
  label?: string;
  className?: string;
};

/**
 * Client-only: loads exceljs in a split chunk, then builds the workbook in-browser
 * (compatible with `output: 'export'`; no API route).
 */
export function ExportPewLayoutButton({
  project,
  sectionId,
  partName,
  label,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="link"
      className={cn(
        "h-auto min-h-0 p-0 text-xs font-normal text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300",
        className,
      )}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { buildPewLayoutWorkbook } = await import("@/lib/pew-sections-excel");
          const u8 = await buildPewLayoutWorkbook(project, { sectionId, partName });
          const name = `${safeFileSegment(project.id)}-map-${partNameFileToken(partName)}${exportDateFileSuffix()}.xlsx`;
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
      {busy ? "Preparing…" : (label ?? "export")}
    </Button>
  );
}
