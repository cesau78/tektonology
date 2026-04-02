import type { LifecycleLoopDescriptor, LifecyclePhaseDetail } from "@/data/types";

/** Ring for one restoration overview phase (Spot or Restore): subItems become the step nodes. */
export function restorationPhaseWorkflowLoop(phase: LifecyclePhaseDetail): LifecycleLoopDescriptor {
  return {
    title: phase.label,
    centerEyebrow: phase.label,
    centerNote: phase.description,
    phaseDetails: phase.subItems.map((s) => ({
      label: s.title,
      description: s.description,
      subItems: [],
    })),
  };
}
