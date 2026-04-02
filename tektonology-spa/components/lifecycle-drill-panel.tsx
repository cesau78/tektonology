"use client";

import type { LifecycleLoopDescriptor } from "@/data/types";

type Accent = "amber" | "teal";

const boxBase: Record<Accent, string> = {
  amber:
    "border-amber-200/90 bg-amber-50/30 text-left hover:bg-amber-50/70 focus-visible:ring-amber-400/80 data-[active=true]:border-amber-400 data-[active=true]:bg-amber-50/90",
  teal: "border-teal-200/90 bg-teal-50/30 text-left hover:bg-teal-50/70 focus-visible:ring-teal-400/80 data-[active=true]:border-teal-400 data-[active=true]:bg-teal-50/90",
};

const prepareIndex = 1;

export type LifecyclePanelFlow = "overview" | "planning" | "restorationPhaseDetail";

interface LifecycleDrillPanelProps {
  restorationLoop: LifecycleLoopDescriptor;
  planningLoop: LifecycleLoopDescriptor;
  flow: LifecyclePanelFlow;
  /** 0 = Spot, 2 = Restore when `flow === "restorationPhaseDetail"`. */
  restorationDetailPhaseIndex: number | null;
  restorationDetailSubIndex: number | null;
  onRestorationPhaseClick: (index: number) => void;
  onRestorationDetailSubClick: (index: number) => void;
  onBackFromRestorationDetail: () => void;
  onBackFromPlanning: () => void;
}

export function LifecycleDrillPanel({
  restorationLoop,
  planningLoop,
  flow,
  restorationDetailPhaseIndex,
  restorationDetailSubIndex,
  onRestorationPhaseClick,
  onRestorationDetailSubClick,
  onBackFromRestorationDetail,
  onBackFromPlanning,
}: LifecycleDrillPanelProps) {
  if (flow === "planning") {
    const loop = planningLoop;
    const accent: Accent = "teal";
    const box = boxBase[accent];

    return (
      <div className="min-w-0 rounded-lg border border-border bg-card/50 p-5 shadow-sm">
        <button
          type="button"
          onClick={onBackFromPlanning}
          className="mb-4 text-sm font-medium text-teal-900/90 underline underline-offset-2 hover:text-teal-950"
        >
          ← Back to overview
        </button>
        <p className="text-sm text-muted-foreground leading-relaxed">{loop.centerNote}</p>

        <div className="mt-4 flex flex-col gap-3">
          {loop.phaseDetails.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`rounded-lg border p-3 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${box}`}
              aria-label={p.label}
            >
              <span className="block text-sm font-semibold text-foreground">{p.label}</span>
              <span className="mt-2 block text-sm text-muted-foreground leading-relaxed">{p.description}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (flow === "restorationPhaseDetail" && restorationDetailPhaseIndex != null) {
    const phase = restorationLoop.phaseDetails[restorationDetailPhaseIndex];
    const accent: Accent = "amber";
    const box = boxBase[accent];

    return (
      <div className="min-w-0 rounded-lg border border-border bg-card/50 p-5 shadow-sm">
        <button
          type="button"
          onClick={onBackFromRestorationDetail}
          className="mb-4 text-sm font-medium text-amber-900/90 underline underline-offset-2 hover:text-amber-950"
        >
          ← Back to overview
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{phase.label}</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{phase.description}</p>

        <div className="mt-4 flex flex-col gap-3">
          {phase.subItems.map((p, i) => {
            const active = restorationDetailSubIndex === i;
            return (
              <button
                key={p.title}
                type="button"
                data-active={active || undefined}
                onClick={() => onRestorationDetailSubClick(i)}
                className={`rounded-lg border p-3 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${box}`}
                aria-pressed={active}
                aria-label={p.title}
              >
                <span className="block text-sm font-semibold text-foreground">{p.title}</span>
                <span className="mt-2 block text-sm text-muted-foreground leading-relaxed">{p.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const loop = restorationLoop;
  const accent: Accent = "amber";
  const box = boxBase[accent];

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card/50 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{loop.centerNote}</p>

      <div className="mt-4 flex flex-col gap-3">
        {loop.phaseDetails.map((p, i) => {
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onRestorationPhaseClick(i)}
              className={`rounded-lg border p-3 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${box}`}
              aria-pressed={false}
              aria-label={p.label}
            >
              <span className="block text-sm font-semibold text-foreground">{p.label}</span>
              <span className="mt-2 block text-sm text-muted-foreground leading-relaxed">{p.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const RESTORATION_PREPARE_PHASE_INDEX = prepareIndex;
