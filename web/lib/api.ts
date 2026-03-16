import { useAuth } from "@clerk/react";
import { useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_FINOPS_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function authedApiFetch<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    ...Object.fromEntries(new Headers(init?.headers).entries()),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return apiFetch<T>(path, { ...init, headers });
}

export function useApiFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      return authedApiFetch<T>(path, token, init);
    },
    [getToken],
  );
}
