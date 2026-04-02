import Link from "next/link";
import { MaintenanceLifecycleSection } from "@/components/maintenance-lifecycle-section";
import { getMaintenanceLifecycle } from "@/lib/maintenance-lifecycle";

export default function HomePage() {
  const lifecycle = getMaintenanceLifecycle();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Tektonology</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tektonology is growing into a maintenance system any church can use to organize parishioners around upkeep and restoration — making care for the building visible and coordinated, not only cutting costs.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed mt-3">
          3D printing is a big part of that: anyone with access to a printer can produce parts and fixtures for the church. Here you will find products, print settings, assembly guides, and tools to track restoration projects.
        </p>
      </div>

      <MaintenanceLifecycleSection lifecycle={lifecycle} />

      <h2 className="text-lg font-semibold text-foreground mb-3">Explore</h2>
      <div className="grid gap-3">
        <Link
          href="/products"
          className="block rounded-lg border border-border p-6 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">Products</h3>
          <p className="text-sm text-muted-foreground">
            Browse print settings, assembly guides, STL downloads, and purchase links.
          </p>
        </Link>
        <Link
          href="/projects"
          className="block rounded-lg border border-border p-6 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">Projects</h3>
          <p className="text-sm text-muted-foreground">
            Track church restoration projects — pew maps, hardware, and installation progress.
          </p>
        </Link>
      </div>
    </div>
  );
}
