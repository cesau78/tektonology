"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useRole, canAccessAccounting } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Header() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user } = useAuth0();
  const { role } = useRole();

  return (
    <header className="bg-black border-b border-neutral-800">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Tektonology
        </Link>
        <div className="flex items-center gap-4">
          {isAuthenticated && user && !user.email_verified && (
            <span className="text-xs text-amber-400">
              Verify your email
            </span>
          )}
          {canAccessAccounting(role) && (
            <Link
              href="/accounting"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Accounting
            </Link>
          )}
          {!isLoading && isAuthenticated && (
            <Link
              href="/profile"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Profile
            </Link>
          )}
          {!isLoading && !isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-neutral-400 hover:text-white"
              onClick={() => loginWithRedirect()}
            >
              Sign in
            </Button>
          )}
          {!isLoading && isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-neutral-400 hover:text-white"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
