"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { grantSuperAdmin, revokeSuperAdmin } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/teams";
import type { SuperAdminRow } from "@/lib/data/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldMinus, ShieldPlus } from "lucide-react";

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

export function SuperAdminManager({
  admins,
  candidates,
}: {
  admins: SuperAdminRow[];
  candidates: { id: string; full_name: string; email: string }[];
}) {
  const [state, formAction, pending] = useActionState(grantSuperAdmin, initial);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <div className="space-y-4">
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

      {candidates.length > 0 ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="memberId" value={selected} />
          <Select value={selected} onValueChange={(v) => setSelected(v ?? "")}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Grant admin access to..." />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name} ({c.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={pending || !selected}>
            <ShieldPlus className="mr-1 h-4 w-4" />
            Grant admin access
          </Button>
        </form>
      ) : null}
    </div>
  );
}
