"use client";

import { useUser } from "@clerk/react";

export type Role = "anonymous" | "member" | "owner" | "auditor";

export function useRole(): { role: Role; isLoaded: boolean } {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) return { role: "anonymous", isLoaded: false };
  if (!isSignedIn || !user) return { role: "anonymous", isLoaded: true };

  const role = (user.publicMetadata?.role as Role) ?? "member";
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
