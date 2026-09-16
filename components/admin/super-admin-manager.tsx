"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { revokeSuperAdmin } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/teams";
import type { SuperAdminRow } from "@/lib/data/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldMinus } from "lucide-react";

const initial: ActionResult = { error: null };

function RevokeButton({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(revokeSuperAdmin, initial);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <form action={formAction}>
      <input type="hidden" name="memberId" value={memberId} />
      <Button type="submit" size="icon" variant="ghost" disabled={pending}>
        <ShieldMinus className="h-4 w-4 text-destructive" />
      </Button>
    </form>
  );
}

// At-a-glance list of current Super Admins with a quick revoke action.
// Granting happens from the full searchable roster below
// (MemberRolesTable) rather than a single dropdown here, since that
// list is capped to a handful of names and doesn't scale to a large org.
export function SuperAdminManager({ admins }: { admins: SuperAdminRow[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {admins.map((a) => (
        <div
          key={a.member_id}
          className="flex items-center gap-2 rounded-full border py-1 pl-3 pr-1"
        >
          <span className="text-sm font-medium">{a.full_name}</span>
          <Badge variant="secondary" className="text-[10px]">
            Super Admin
          </Badge>
          <RevokeButton memberId={a.member_id} />
        </div>
      ))}
      {admins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Super Admins yet.</p>
      ) : null}
    </div>
  );
}
