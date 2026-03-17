"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { type Role, useRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect, user, logout } = useAuth0();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-neutral-500">
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in required</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-neutral-500">
            You need to sign in to access this page.
          </p>
          <Button onClick={() => loginWithRedirect()}>Sign in</Button>
        </CardContent>
      </Card>
    );
  }

  if (user && !user.email_verified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email verification required</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-neutral-500">
            Please check your inbox and verify your email address to continue.
          </p>
          <Button
            variant="outline"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { role, isLoaded } = useRole();
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading || !isLoaded) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-neutral-500">
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in required</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-neutral-500">
            You need to sign in to access this page.
          </p>
          <Button onClick={() => loginWithRedirect()}>Sign in</Button>
        </CardContent>
      </Card>
    );
  }

  if (!roles.includes(role)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500">
            Your role ({role}) does not have permission to view this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
