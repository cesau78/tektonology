"use client";

import type { LifecycleLoopDescriptor } from "@/data/types";

type Accent = "amber" | "teal";

const boxBase: Record<Accent, string> = {
  amber:
    "border-amber-200/90 bg-amber-50/30 text-left hover:bg-amber-50/70 focus-visible:ring-amber-400/80 data-[active=true]:border-amber-400 data-[active=true]:bg-amber-50/90",
  teal: "border-teal-200/90 bg-teal-50/30 text-left hover:bg-teal-50/70 focus-visible:ring-teal-400/80 data-[active=true]:border-teal-400 data-[active=true]:bg-teal-50/90",
};

const detailBorder: Record<Accent, string> = {
  amber: "border-amber-200/80",
  teal: "border-teal-200/80",
};

const prepareIndex = 1;

interface LifecycleDrillPanelProps {
  restorationLoop: LifecycleLoopDescriptor;
  planningLoop: LifecycleLoopDescriptor;
  /** Restoration overview vs planning (opened via Prepare). */
  flow: "restoration" | "planning";
  /** Selected restoration phase for substeps (not used when flow is planning). */
  restorationPhaseIndex: number | null;
  /** Selected planning phase for substeps. */
  planningPhaseIndex: number | null;
  onRestorationPhaseClick: (index: number) => void;
  onPlanningPhaseClick: (index: number) => void;
  onBackFromPlanning: () => void;
}

export function LifecycleDrillPanel({
  restorationLoop,
  planningLoop,
  flow,
  restorationPhaseIndex,
  planningPhaseIndex,
  onRestorationPhaseClick,
  onPlanningPhaseClick,
  onBackFromPlanning,
}: LifecycleDrillPanelProps) {
  if (flow === "planning") {
    const loop = planningLoop;
    const accent: Accent = "teal";
    const box = boxBase[accent];
    const detail = detailBorder[accent];
    const phase = planningPhaseIndex != null ? loop.phaseDetails[planningPhaseIndex] : null;

    return (
      <div className="min-w-0 rounded-lg border border-border bg-card/50 p-5 shadow-sm">
        <button
          type="button"
          onClick={onBackFromPlanning}
          className="mb-4 text-sm font-medium text-teal-900/90 underline underline-offset-2 hover:text-teal-950"
        >
          ← Back to restoration
        </button>
        <p className="text-sm text-muted-foreground leading-relaxed">{loop.centerNote}</p>

        <div
          className="mt-4 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${loop.phaseDetails.length}, minmax(0, 1fr))` }}
        >
          {loop.phaseDetails.map((p, i) => {
            const active = planningPhaseIndex === i;
            return (
              <button
                key={p.label}
                type="button"
                data-active={active || undefined}
                onClick={() => onPlanningPhaseClick(i)}
                className={`rounded-lg border p-3 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${box}`}
                aria-pressed={active}
                aria-label={p.label}
              >
                <span className="block text-sm font-semibold text-foreground">{p.label}</span>
                <span className="mt-2 block text-sm text-muted-foreground leading-relaxed">{p.description}</span>
              </button>
            );
          })}
        </div>

        {phase != null && phase.subItems.length > 0 ? (
          <div className={`mt-4 rounded-lg border bg-card/50 p-4 shadow-sm ${detail}`}>
            <ul className="space-y-3 list-none p-0 m-0">
              {phase.subItems.map((sub) => (
                <li key={sub.title}>
                  <span className="text-sm font-semibold text-foreground">{sub.title}</span>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{sub.description}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const loop = restorationLoop;
  const accent: Accent = "amber";
  const box = boxBase[accent];
  const detail = detailBorder[accent];
  const phase =
    restorationPhaseIndex != null ? loop.phaseDetails[restorationPhaseIndex] : null;

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card/50 p-5 shadow-sm">
      <p className="text-sm text-muted-foreground leading-relaxed">{loop.centerNote}</p>

      <div
        className="mt-4 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${loop.phaseDetails.length}, minmax(0, 1fr))` }}
      >
        {loop.phaseDetails.map((p, i) => {
          const isPrepare = i === prepareIndex;
          const active = restorationPhaseIndex === i && !isPrepare;
          return (
            <button
              key={p.label}
              type="button"
              data-active={active || undefined}
              onClick={() => onRestorationPhaseClick(i)}
              className={`rounded-lg border p-3 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${box}`}
              aria-pressed={active}
              aria-label={p.label}
            >
              <span className="block text-sm font-semibold text-foreground">{p.label}</span>
              <span className="mt-2 block text-sm text-muted-foreground leading-relaxed">{p.description}</span>
            </button>
          );
        })}
      </div>

      {phase != null && phase.subItems.length > 0 ? (
        <div className={`mt-4 rounded-lg border bg-card/50 p-4 shadow-sm ${detail}`}>
          <ul className="space-y-3 list-none p-0 m-0">
            {phase.subItems.map((sub) => (
              <li key={sub.title}>
                <span className="text-sm font-semibold text-foreground">{sub.title}</span>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{sub.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export const RESTORATION_PREPARE_PHASE_INDEX = prepareIndex;
