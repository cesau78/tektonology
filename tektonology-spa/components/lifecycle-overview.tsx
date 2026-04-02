"use client";

import { useMemo, useState } from "react";
import type { MaintenanceLifecycle } from "@/data/types";
import { LifecycleRing } from "@/components/maintenance-lifecycle-cycle";
import {
  LifecycleDrillPanel,
  type LifecyclePanelFlow,
  RESTORATION_PREPARE_PHASE_INDEX,
} from "@/components/lifecycle-drill-panel";
import { restorationPhaseWorkflowLoop } from "@/lib/restoration-phase-workflow-loop";

const SPOT_PHASE_INDEX = 0;
const RESTORE_PHASE_INDEX = 2;

interface LifecycleOverviewProps {
  lifecycle: Pick<MaintenanceLifecycle, "restorationLoop" | "planningLoop">;
}

export function LifecycleOverview({ lifecycle }: LifecycleOverviewProps) {
  const { restorationLoop, planningLoop } = lifecycle;
  const spotPhase = restorationLoop.phaseDetails[SPOT_PHASE_INDEX];
  const restorePhase = restorationLoop.phaseDetails[RESTORE_PHASE_INDEX];
  const spotWorkflowLoop = useMemo(
    () => restorationPhaseWorkflowLoop(spotPhase),
    [spotPhase],
  );
  const restoreWorkflowLoop = useMemo(
    () => restorationPhaseWorkflowLoop(restorePhase),
    [restorePhase],
  );

  const [flow, setFlow] = useState<LifecyclePanelFlow>("overview");
  const [restorationDetailPhaseIndex, setRestorationDetailPhaseIndex] = useState<number | null>(null);
  const [restorationDetailSubIndex, setRestorationDetailSubIndex] = useState<number | null>(null);

  const ring =
    flow === "planning" ? (
      <LifecycleRing loop={planningLoop} variant="planning" markerId="lifecycle-arrow-planning" />
    ) : flow === "restorationPhaseDetail" && restorationDetailPhaseIndex === SPOT_PHASE_INDEX ? (
      <LifecycleRing
        loop={spotWorkflowLoop}
        variant="restoration"
        markerId="lifecycle-arrow-spot-detail"
      />
    ) : flow === "restorationPhaseDetail" && restorationDetailPhaseIndex === RESTORE_PHASE_INDEX ? (
      <LifecycleRing
        loop={restoreWorkflowLoop}
        variant="restoration"
        markerId="lifecycle-arrow-restore-detail"
      />
    ) : (
      <LifecycleRing
        loop={restorationLoop}
        variant="restoration"
        markerId="lifecycle-arrow-restoration"
      />
    );

  return (
    <div className="mb-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-10 lg:items-start">
      <LifecycleDrillPanel
        restorationLoop={restorationLoop}
        planningLoop={planningLoop}
        flow={flow}
        restorationDetailPhaseIndex={restorationDetailPhaseIndex}
        restorationDetailSubIndex={restorationDetailSubIndex}
        onRestorationPhaseClick={(index) => {
          switch (index) {
            case RESTORATION_PREPARE_PHASE_INDEX:
              setFlow("planning");
              setRestorationDetailPhaseIndex(null);
              setRestorationDetailSubIndex(null);
              break;
            case SPOT_PHASE_INDEX:
              setFlow("restorationPhaseDetail");
              setRestorationDetailPhaseIndex(SPOT_PHASE_INDEX);
              setRestorationDetailSubIndex(null);
              break;
            case RESTORE_PHASE_INDEX:
              setFlow("restorationPhaseDetail");
              setRestorationDetailPhaseIndex(RESTORE_PHASE_INDEX);
              setRestorationDetailSubIndex(null);
              break;
          }
        }}
        onRestorationDetailSubClick={(index) => {
          setRestorationDetailSubIndex((prev) => (prev === index ? null : index));
        }}
        onBackFromRestorationDetail={() => {
          setFlow("overview");
          setRestorationDetailPhaseIndex(null);
          setRestorationDetailSubIndex(null);
        }}
        onBackFromPlanning={() => {
          setFlow("overview");
          setRestorationDetailPhaseIndex(null);
          setRestorationDetailSubIndex(null);
        }}
      />

      <div className="min-w-0" aria-live="polite">
        {ring}
      </div>
    </div>
  );
}
