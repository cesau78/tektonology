"use client";

import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/auth-guard";
import { useRole, canAccessFinance, canWrite, type Role } from "@/lib/auth";

const roleDescriptions: Record<Role, { label: string; color: string; description: string }> = {
  anonymous: { label: "Anonymous", color: "bg-gray-100 text-gray-900 border-gray-300", description: "" },
  member: {
    label: "Member",
    color: "bg-blue-100 text-blue-900 border-blue-300",
    description: "You can view products and manage your profile.",
  },
  owner: {
    label: "Owner",
    color: "bg-amber-100 text-amber-900 border-amber-300",
    description: "Full access to finance, operations, and all administrative functions.",
  },
  auditor: {
    label: "Auditor",
    color: "bg-violet-100 text-violet-900 border-violet-300",
    description: "Read-only access to finance and operations data.",
  },
};

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const { user } = useAuth0();
  const { role } = useRole();
  const info = roleDescriptions[role];

  if (!user) return null;

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <span className="text-foreground">Profile</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Profile</h1>
        <p className="text-muted-foreground text-sm">Your account and access details.</p>
      </div>

      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium text-foreground">{user.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium text-foreground">{user.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Role</dt>
                <dd>
                  <Badge className={`${info.color} hover:bg-opacity-100`}>{info.label}</Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{info.description}</p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-emerald-600">&#10003;</span>
                <span>Products and Assembly Guides</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600">&#10003;</span>
                <span>Profile Management</span>
              </li>
              {canAccessFinance(role) && (
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600">&#10003;</span>
                  <span>Finance and Operations (read)</span>
                </li>
              )}
              {canWrite(role) && (
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600">&#10003;</span>
                  <span>Finance and Operations (write)</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
