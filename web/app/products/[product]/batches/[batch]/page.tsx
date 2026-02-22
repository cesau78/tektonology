import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Product, Batch } from "@/data/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function camelToLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function getProduct(id: string): Product | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "data", "products", `${id}.json`), "utf-8")) as Product;
  } catch {
    return null;
  }
}

function getBatch(productId: string, batchId: string): Batch | null {
  const dir = join(process.cwd(), "data", "batches");
  const batches = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Batch)
    .filter((b) => b.productId === productId && b.id === batchId);
  return batches[0] ?? null;
}

export async function generateStaticParams() {
  const batchDir = join(process.cwd(), "data", "batches");
  return readdirSync(batchDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(batchDir, f), "utf-8")) as Batch)
    .map((b) => ({ product: b.productId, batch: b.id }));
}

export default async function BatchPage({
  params,
}: {
  params: Promise<{ product: string; batch: string }>;
}) {
  const { product: productId, batch: batchId } = await params;
  const product = getProduct(productId);
  const batch = getBatch(productId, batchId);
  if (!product || !batch) notFound();

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Products</Link>
        <span>›</span>
        <Link href={`/products/${productId}`} className="hover:text-foreground transition-colors">{product.name}</Link>
        <span>›</span>
        <span className="text-foreground">Batch {batchId}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100 shrink-0 mt-1">{product.category}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">Batch {batch.id} — printed {batch.printedDate}</p>
      </div>

      <Separator className="mb-6" />

      <div className="grid gap-4 [&>*]:shadow-sm">
        {/* Batch Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Batch ID</dt>
                <dd className="text-foreground text-sm">{batch.id}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Printed</dt>
                <dd className="text-foreground text-sm">{batch.printedDate}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Quantity</dt>
                <dd className="text-foreground text-sm">{batch.quantity}</dd>
              </div>
              {batch.notes && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Notes</dt>
                  <dd className="text-foreground text-sm">{batch.notes}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Print Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Print Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {Object.entries(product.printSettings).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    {camelToLabel(key)}
                  </dt>
                  <dd className="text-foreground text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Assembly Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assembly Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 list-decimal list-inside">
              {product.assemblyGuide.map((step, i) => (
                <li key={i} className="text-foreground text-sm">{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Downloads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {product.stlDownloadUrls.map((dl) => (
                <Button key={dl.url} asChild>
                  <a href={dl.url}>↓ {dl.label}</a>
                </Button>
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
      </div>
    </div>
  );
}
