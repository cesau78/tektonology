import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Product, Batch } from "@/data/types";

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
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-3 mb-6 text-sm">
          <Link href="/" className="text-blue-600 hover:underline">All Products</Link>
          <span className="text-gray-400">›</span>
          <Link href={`/products/${productId}`} className="text-blue-600 hover:underline">{product.name}</Link>
          <span className="text-gray-400">›</span>
          <span className="text-gray-500">Batch {batchId}</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-1">{product.name}</h1>
        <p className="text-gray-500 mb-8">Batch {batch.id} — printed {batch.printedDate}</p>

        {/* Batch Info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Batch Info</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Batch ID</dt>
              <dd className="text-gray-800 text-sm mt-0.5">{batch.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Printed</dt>
              <dd className="text-gray-800 text-sm mt-0.5">{batch.printedDate}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quantity</dt>
              <dd className="text-gray-800 text-sm mt-0.5">{batch.quantity}</dd>
            </div>
            {batch.notes && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</dt>
                <dd className="text-gray-800 text-sm mt-0.5">{batch.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Print Settings */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Print Settings</h2>
          <dl className="space-y-3">
            {Object.entries(product.printSettings).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
                <dd className="text-gray-800 text-sm mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Assembly Guide */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Assembly Guide</h2>
          <ol className="space-y-2 list-decimal list-inside">
            {product.assemblyGuide.map((step, i) => (
              <li key={i} className="text-gray-700 text-sm">{step}</li>
            ))}
          </ol>
        </section>

        {/* Downloads */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Downloads</h2>
          <div className="flex flex-wrap gap-3">
            {product.stlDownloadUrls.map((dl) => (
              <a
                key={dl.url}
                href={dl.url}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
              >
                ↓ {dl.label}
              </a>
            ))}
          </div>
        </section>

        {/* Purchase Links */}
        {product.purchaseLinks.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Where to Buy</h2>
            <div className="flex flex-wrap gap-3">
              {product.purchaseLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition"
                >
                  {link.label} ↗
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
