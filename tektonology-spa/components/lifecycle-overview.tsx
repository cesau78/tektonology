"use client";

import { useState } from "react";
import type { MaintenanceLifecycle } from "@/data/types";
import { LifecycleRing } from "@/components/maintenance-lifecycle-cycle";
import {
  LifecycleDrillPanel,
  RESTORATION_PREPARE_PHASE_INDEX,
} from "@/components/lifecycle-drill-panel";

interface LifecycleOverviewProps {
  lifecycle: Pick<MaintenanceLifecycle, "restorationLoop" | "planningLoop">;
}

export function LifecycleOverview({ lifecycle }: LifecycleOverviewProps) {
  const { restorationLoop, planningLoop } = lifecycle;
  const [flow, setFlow] = useState<"restoration" | "planning">("restoration");
  const [restorationPhaseIndex, setRestorationPhaseIndex] = useState<number | null>(null);
  const [planningPhaseIndex, setPlanningPhaseIndex] = useState<number | null>(null);

  const showPlanningRing = flow === "planning";
  const showRestorationRing =
    flow === "restoration" &&
    restorationPhaseIndex !== null &&
    restorationPhaseIndex !== RESTORATION_PREPARE_PHASE_INDEX;

  return (
    <div className="mb-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-10 lg:items-start">
      <LifecycleDrillPanel
        restorationLoop={restorationLoop}
        planningLoop={planningLoop}
        flow={flow}
        restorationPhaseIndex={restorationPhaseIndex}
        planningPhaseIndex={planningPhaseIndex}
        onRestorationPhaseClick={(index) => {
          if (index === RESTORATION_PREPARE_PHASE_INDEX) {
            setFlow("planning");
            setRestorationPhaseIndex(null);
            setPlanningPhaseIndex(null);
            return;
          }
          setRestorationPhaseIndex((prev) => (prev === index ? null : index));
        }}
        onPlanningPhaseClick={(index) => {
          setPlanningPhaseIndex((prev) => (prev === index ? null : index));
        }}
        onBackFromPlanning={() => {
          setFlow("restoration");
          setPlanningPhaseIndex(null);
          setRestorationPhaseIndex(null);
        }}
      />

      <div className="min-w-0" aria-live="polite">
        {showPlanningRing ? (
          <LifecycleRing
            loop={planningLoop}
            variant="planning"
            markerId="lifecycle-arrow-planning"
          />
        ) : showRestorationRing ? (
          <LifecycleRing
            loop={restorationLoop}
            variant="restoration"
            markerId="lifecycle-arrow-restoration"
          />
        ) : (
          <div className="flex min-h-[280px] max-w-md mx-auto items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4">
            <p className="text-center text-sm text-muted-foreground">
              Select Spot, Prepare, or Restore to see the on-site cycle. Prepare opens the planning
              pipeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
