"use client";

import { useState, useEffect, useCallback } from "react";
import { useApiFetch } from "@/lib/api";

export interface CrudState<T> {
  items: T[] | null;
  error: string | null;
  actionError: string | null;
  showDeleted: boolean;
  setShowDeleted: (v: boolean) => void;
  setActionError: (v: string | null) => void;
  load: () => void;
  create: (data: Partial<T>) => Promise<void>;
  update: (id: string | number, data: Partial<T>) => Promise<void>;
  remove: (id: string | number) => Promise<void>;
  restore: (id: string | number) => Promise<void>;
  permanentDelete: (id: string | number) => Promise<void>;
}

export function useCrud<T>(apiPath: string): CrudState<T> {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const apiFetch = useApiFetch();

  const load = useCallback(() => {
    apiFetch<T[]>(`${apiPath}${showDeleted ? "?includeDeleted=true" : ""}`)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [apiFetch, apiPath, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: Partial<T>) => {
    setActionError(null);
    try {
      await apiFetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create";
      setActionError(msg);
      throw e;
    }
  }, [apiFetch, apiPath, load]);

  const update = useCallback(async (id: string | number, data: Partial<T>) => {
    setActionError(null);
    try {
      await apiFetch(`${apiPath}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      setActionError(msg);
      throw e;
    }
  }, [apiFetch, apiPath, load]);

  const remove = useCallback(async (id: string | number) => {
    setActionError(null);
    try {
      await apiFetch(`${apiPath}/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      setActionError(msg);
      throw e;
    }
  }, [apiFetch, apiPath, load]);

  const restore = useCallback(async (id: string | number) => {
    setActionError(null);
    try {
      await apiFetch(`${apiPath}/${id}/restore`, { method: "POST" });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to restore";
      setActionError(msg);
      throw e;
    }
  }, [apiFetch, apiPath, load]);

  const permanentDelete = useCallback(async (id: string | number) => {
    setActionError(null);
    try {
      await apiFetch(`${apiPath}/${id}/permanent`, { method: "DELETE" });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to permanently delete";
      setActionError(msg);
      throw e;
    }
  }, [apiFetch, apiPath, load]);

  return { items, error, actionError, showDeleted, setShowDeleted, setActionError, load, create, update, remove, restore, permanentDelete };
}
