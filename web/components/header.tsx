"use client";

import Link from "next/link";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { useRole, canAccessAccounting } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Header() {
  const { isSignedIn, isLoaded } = useAuth();
  const { role } = useRole();

  return (
    <header className="bg-black border-b border-neutral-800">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Tektonology
        </Link>
        <div className="flex items-center gap-4">
          {canAccessAccounting(role) && (
            <Link
              href="/accounting"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Accounting
            </Link>
          )}
          {isLoaded && isSignedIn && (
            <Link
              href="/profile"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Profile
            </Link>
          )}
          {isLoaded && !isSignedIn && (
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" className="text-xs text-neutral-400 hover:text-white">
                Sign in
              </Button>
            </SignInButton>
          )}
          {isLoaded && isSignedIn && (
            <UserButton />
          )}
        </div>
      </div>
    </header>
  );
}
