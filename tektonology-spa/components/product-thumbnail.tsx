"use client";

import type { Product } from "@/data/types";
import { StlAssemblyViewer, StlViewer } from "@/components/stl-viewer";

export function ProductThumbnail({ product }: { product: Product }) {
  if (product.assemblyView) {
    return (
      <div className="w-24 h-24 shrink-0 rounded overflow-hidden bg-transparent">
        <StlAssemblyViewer parts={product.assemblyView.parts} label="" compact rotation={product.assemblyView.rotation} />
      </div>
    );
  }

  const stl = product.stlDownloadUrls.find((dl) => dl.url.endsWith(".stl"));
  if (!stl) return null;

  return (
    <div className="w-24 h-24 shrink-0 rounded overflow-hidden bg-transparent">
      <StlViewer url={stl.url} label="" color={stl.color} compact />
    </div>
  );
}
