import Link from "next/link";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { Product } from "@/data/types";

function getProducts(): Product[] {
  const dir = join(process.cwd(), "data", "products");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Product)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function groupByCategory(products: Product[]): Record<string, Product[]> {
  return products.reduce<Record<string, Product[]>>((acc, product) => {
    (acc[product.category] ??= []).push(product);
    return acc;
  }, {});
}

export default function HomePage() {
  const products = getProducts();
  const grouped = groupByCategory(products);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tektonology</h1>
        <p className="text-gray-500 mb-10">
          3D-printable solutions for church and home. Select a product to view
          print settings, assembly guides, and downloads.
        </p>

        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-10">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              {category}
            </h2>
            <div className="grid gap-4">
              {items.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-md transition"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {product.name}
                  </h3>
                  <p className="text-gray-500 text-sm">{product.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
