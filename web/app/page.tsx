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

export default function HomePage() {
  const products = getProducts();

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tektonology</h1>
        <p className="text-gray-500 mb-10">
          3D-printable solutions for liturgical furniture. Select a product to
          view print settings, assembly guides, and downloads.
        </p>

        <div className="grid gap-4">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-md transition"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {product.name}
              </h2>
              <p className="text-gray-500 text-sm">{product.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
