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
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
          ← All Products
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
        <p className="text-gray-500 mb-8">{product.description}</p>

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
          <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
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

        {/* Batches */}
        {batches.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Print Batches</h2>
            <div className="space-y-3">
              {batches.map((batch) => (
                <Link
                  key={batch.id}
                  href={`/products/${productId}/batches/${batch.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">Batch {batch.id}</span>
                    <span className="ml-3 text-xs text-gray-400">{batch.printedDate}</span>
                  </div>
                  <span className="text-xs text-gray-400">Qty: {batch.quantity} →</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
