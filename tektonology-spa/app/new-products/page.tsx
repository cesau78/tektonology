"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/api-error";
import { RequireRole } from "@/components/auth-guard";
import { useApiFetch } from "@/lib/api";
import { useRole, canWrite } from "@/lib/auth";

interface ProductData {
  productId: number;
  name: string;
  category: string;
  description: string;
  origin: string;
  versions: { version: string; effective: string }[];
  deletedAt?: string;
}

function groupByCategory(products: ProductData[]): Record<string, ProductData[]> {
  return products.reduce<Record<string, ProductData[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});
}

export default function NewProductsPage() {
  const [products, setProducts] = useState<ProductData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "", description: "", origin: "original" });
  const [actionError, setActionError] = useState<string | null>(null);
  const { role } = useRole();
  const apiFetch = useApiFetch();
  const writable = canWrite(role);

  const load = useCallback(() => {
    apiFetch<ProductData[]>(`/api/products${showDeleted ? "?includeDeleted=true" : ""}`)
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, [apiFetch, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setActionError(null);
    if (!newProduct.name.trim()) { setActionError("Name is required"); return; }
    if (!newProduct.category.trim()) { setActionError("Category is required"); return; }
    try {
      await apiFetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProduct,
          name: newProduct.name.trim(),
          category: newProduct.category.trim(),
          description: newProduct.description.trim(),
          effective: new Date().toISOString().slice(0, 10),
          printSettings: {},
          assemblyGuide: [],
          versions: [],
        }),
      });
      setAdding(false);
      setNewProduct({ name: "", category: "", description: "", origin: "original" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const handleDelete = async (productId: number) => {
    try {
      await apiFetch(`/api/products/${productId}`, { method: "DELETE" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleRestore = async (productId: number) => {
    try {
      await apiFetch(`/api/products/${productId}/restore`, { method: "POST" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to restore");
    }
  };

  const activeProducts = products?.filter((p) => !p.deletedAt) ?? [];
  const visible = showDeleted ? products : activeProducts;
  const grouped = groupByCategory(visible ?? []);

  return (
    <RequireRole roles={["owner"]}>
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Products</h1>
          <p className="text-muted-foreground text-sm">
            Select a product to view print settings, assembly guides, and downloads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDeleted((v) => !v)} className={showDeleted ? "border-gray-400" : ""}>
            {showDeleted ? "Hide Deleted" : "Show Deleted"}
          </Button>
          {writable && !adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>+ Add Product</Button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!products && !error && <LoadingState />}

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{actionError}</div>
      )}

      {adding && (
        <Card className="shadow-sm border-dashed mb-6">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">New Product</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Name" className="border border-border rounded px-2 py-1 text-sm bg-background" autoFocus />
              <input type="text" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} placeholder="Category" className="border border-border rounded px-2 py-1 text-sm bg-background" />
              <input type="text" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Description" className="col-span-2 border border-border rounded px-2 py-1 text-sm bg-background" />
              <select value={newProduct.origin} onChange={(e) => setNewProduct({ ...newProduct, origin: e.target.value })} className="border border-border rounded px-2 py-1 text-sm bg-background">
                <option value="original">Original</option>
                <option value="third-party">Third Party</option>
              </select>
            </div>
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="xs" onClick={handleAdd}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => { setAdding(false); setActionError(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {products && Object.entries(grouped).sort(([a], [b]) => {
        if (a === "Tools") return 1;
        if (b === "Tools") return -1;
        return a.localeCompare(b);
      }).map(([category, items]) => (
        <section key={category} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100">
              {category}
            </Badge>
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="grid gap-3">
            {items.map((product) => {
              const deleted = !!product.deletedAt;
              const latestVersion = product.versions?.[product.versions.length - 1];
              return (
                <Card key={product.productId} className={`bg-card shadow-sm hover:shadow-md hover:border-amber-300 transition-all ${deleted ? "opacity-50" : ""}`}>
                  <CardHeader>
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">{product.name}</CardTitle>
                        <CardDescription>{product.description}</CardDescription>
                        {latestVersion && (
                          <span className="text-xs text-muted-foreground">v{latestVersion.version}</span>
                        )}
                      </div>
                      {writable && (
                        <div className="flex items-start gap-1 shrink-0">
                          {deleted ? (
                            <Button variant="ghost" size="xs" onClick={() => handleRestore(product.productId)}>Restore</Button>
                          ) : (
                            <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(product.productId)}>Delete</Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
    </RequireRole>
  );
}
