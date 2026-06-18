import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Product, Batch } from "@/data/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StlViewer, StlAssemblyViewer } from "@/components/stl-viewer";

function getProduct(id: string): Product | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "data", "products", `${id}.json`), "utf-8")) as Product;
  } catch {
    return null;
  }
}

function getBatchesForProduct(productId: string): Batch[] {
  const dir = join(process.cwd(), "data", "batches");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Batch)
    .filter((b) => b.productId === productId)
    .sort((a, b) => b.printedDate.localeCompare(a.printedDate));
}

export async function generateStaticParams() {
  const dir = join(process.cwd(), "data", "products");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ product: f.replace(".json", "") }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const { product: productId } = await params;
  const product = getProduct(productId);
  if (!product) notFound();

  const batches = getBatchesForProduct(productId);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/products" className="hover:text-foreground transition-colors">Products</Link>
        <span>›</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100 shrink-0 mt-1">{product.category}</Badge>
        </div>
        <p className="text-muted-foreground">{product.description}</p>
      </div>

      <Separator className="mb-6" />

      <div className="grid gap-4 [&>*]:shadow-sm">
        {/* Downloads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            {product.assemblyView && (
              <div className="mb-4">
                <StlAssemblyViewer parts={product.assemblyView.parts} label={product.assemblyView.label} rotation={product.assemblyView.rotation} />
              </div>
            )}
            <div className={`grid gap-4 ${product.stlDownloadUrls.length === 2 ? "grid-cols-2" : product.stlDownloadUrls.length >= 3 ? "grid-cols-3" : ""}`}>
              {product.stlDownloadUrls.map((dl) => (
                <div key={dl.url} className="flex flex-col">
                  {dl.url.endsWith(".stl") && (
                    <div className="mb-2">
                      <StlViewer url={dl.url} label={dl.label} color={dl.color} edgeColor={dl.edgeColor} rotation={dl.rotation} />
                    </div>
                  )}
                  <Button asChild size="sm">
                    <a href={dl.url}>↓ {dl.label}</a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Purchase Links */}
        {product.purchaseLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where to Buy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {product.purchaseLinks.map((link) => (
                  <Button key={link.url} variant="outline" asChild>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.label} ↗
                    </a>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batches */}
        {batches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Print Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {batches.map((batch) => (
                  <Link
                    key={batch.id}
                    href={`/products/${productId}/batches/${batch.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground">Batch {batch.id}</span>
                      <span className="text-xs text-muted-foreground">{batch.printedDate}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Qty: {batch.quantity} →</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
