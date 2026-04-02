import type { MaintenanceLifecycle } from "@/data/types";
import { LifecycleOverview } from "@/components/lifecycle-overview";

interface MaintenanceLifecycleSectionProps {
  lifecycle: MaintenanceLifecycle;
}

export function MaintenanceLifecycleSection({ lifecycle }: MaintenanceLifecycleSectionProps) {
  return (
    <section className="mb-12" aria-labelledby="lifecycle-heading">
      <h2 id="lifecycle-heading" className="text-xl font-semibold text-foreground mb-2">
        {lifecycle.title}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{lifecycle.intro}</p>

      <LifecycleOverview lifecycle={lifecycle} />
    </section>
  );
}
