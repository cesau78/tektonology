import Link from "next/link";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { Product } from "@/data/types";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Products</h1>
        <p className="text-muted-foreground text-sm">
          Select a product to view print settings, assembly guides, and downloads.
        </p>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100">
              {category}
            </Badge>
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="grid gap-3">
            {items.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="bg-card shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
