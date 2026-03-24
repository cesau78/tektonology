import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Tektonology</h1>
        <p className="text-muted-foreground text-sm">
          3D-printable solutions for liturgical furniture — product info, print settings, and assembly guides.
        </p>
      </div>

      <div className="grid gap-3">
        <Link
          href="/products"
          className="block rounded-lg border border-border p-6 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <h2 className="text-lg font-semibold text-foreground mb-1">Products</h2>
          <p className="text-sm text-muted-foreground">
            Browse print settings, assembly guides, STL downloads, and purchase links.
          </p>
        </Link>
        <Link
          href="/projects"
          className="block rounded-lg border border-border p-6 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <h2 className="text-lg font-semibold text-foreground mb-1">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Track church restoration projects — pew maps, hardware, and installation progress.
          </p>
        </Link>
      </div>
    </div>
  );
}
