"use client";

import { useAuth0 } from "@auth0/auth0-react";

export type Role = "anonymous" | "member" | "owner" | "auditor";

const ROLE_CLAIM = "https://tektonology.com/role";

export function useRole(): { role: Role; isLoaded: boolean } {
  const { isAuthenticated, isLoading, user } = useAuth0();

  if (isLoading) return { role: "anonymous", isLoaded: false };
  if (!isAuthenticated || !user) return { role: "anonymous", isLoaded: true };

  const role = (user[ROLE_CLAIM] as Role) ?? "member";
  return { role, isLoaded: true };
}

export function canAccessAccounting(role: Role): boolean {
  return role === "owner" || role === "auditor";
}

export function canWrite(role: Role): boolean {
  return role === "owner";
}

export function isAuthenticated(role: Role): boolean {
  return role !== "anonymous";
}
