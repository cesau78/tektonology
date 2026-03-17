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
        <div className="relative flex items-center gap-4">
          {isAuthenticated && user && !user.email_verified && canAccessAccounting(role) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400 whitespace-nowrap">
                Verify Email to Access:
              </span>
              <div className="border border-amber-400 rounded px-3 py-1.5 flex items-center">
                <span className="text-xs leading-none text-neutral-500 cursor-default">
                  Accounting
                </span>
              </div>
            </div>
          )}
          {canAccessAccounting(role) && user?.email_verified && (
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
