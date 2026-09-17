"use client";

import { useState } from "react";
import { toast } from "sonner";
import { switchActiveOrganization } from "@/lib/actions/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

// Shown by AuthGuard in place of the app when a signed-in user belongs
// to more than one organization and hasn't picked which one to view
// yet. Picking one just points user_active_organization at it — RLS
// independently enforces that the choice is one of their real
// memberships (0015).
export function OrgPickerGate({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const choose = async (id: string) => {
    setPendingId(id);
    const result = await switchActiveOrganization(id);
    if (result.error) {
      toast.error(result.error);
      setPendingId(null);
    }
    // On success, AuthGuard's auth-status query re-resolves to "ready"
    // and swaps this gate out for the app automatically.
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Which organization?</CardTitle>
          <CardDescription>You&apos;re a member of more than one — pick one to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {organizations.map((org) => (
            <Button
              key={org.id}
              type="button"
              variant="outline"
              className="w-full justify-start"
              disabled={pendingId !== null}
              onClick={() => choose(org.id)}
            >
              <Building2 className="mr-2 h-4 w-4" />
              {pendingId === org.id ? "Switching..." : org.name}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
