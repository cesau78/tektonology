"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useRole, canAccessFinance } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { User, LogIn, LogOut } from "lucide-react";

export function Header() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user } = useAuth0();
  const { role } = useRole();
  const showFinance = canAccessFinance(role) && user?.email_verified;

  return (
    <header className="bg-black border-b border-neutral-800">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Tektonology
        </Link>
        <div className="flex items-center gap-2">
          {isAuthenticated && user && !user.email_verified && canAccessFinance(role) && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs text-amber-400 whitespace-nowrap">
                Verify Email to Access:
              </span>
              <div className="border border-amber-400 rounded px-3 py-1.5 flex items-center">
                <span className="text-xs leading-none text-neutral-500 cursor-default">
                  Finance, Procurement & Manufacturing
                </span>
              </div>
            </div>
          )}
          {!isLoading && isAuthenticated && (
            <Link
              href="/profile"
              className="text-neutral-400 hover:text-white transition-colors"
              aria-label="Profile"
            >
              <User className="size-4" />
            </Link>
          )}
          {!isLoading && !isAuthenticated && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-neutral-400 hover:text-white"
              aria-label="Sign in"
              onClick={() => loginWithRedirect()}
            >
              <LogIn className="size-4" />
            </Button>
          )}
          {!isLoading && isAuthenticated && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-neutral-400 hover:text-white"
              aria-label="Sign out"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <nav className="border-t border-neutral-800">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/products"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Products
            </Link>
            <Link
              href="/projects"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Projects
            </Link>
          </div>
          {showFinance && (
            <div className="flex items-center gap-4">
              <Link
                href="/finance"
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Finance
              </Link>
              <Link
                href="/procurement"
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Procurement
              </Link>
              <Link
                href="/manufacturing"
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Manufacturing
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
