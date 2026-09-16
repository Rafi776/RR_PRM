"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { grantSuperAdmin, revokeSuperAdmin } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/teams";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoreRoleSelect } from "@/components/admin/core-role-form";
import { ShieldCheck, ShieldMinus } from "lucide-react";

const initial: ActionResult = { error: null };

type Member = { id: string; full_name: string; email: string };

function SuperAdminToggle({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) {
  const [state, formAction, pending] = useActionState(
    isAdmin ? revokeSuperAdmin : grantSuperAdmin,
    initial,
  );

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <form action={formAction}>
      <input type="hidden" name="memberId" value={memberId} />
      <Button type="submit" size="sm" variant={isAdmin ? "outline" : "secondary"} disabled={pending}>
        {isAdmin ? (
          <>
            <ShieldMinus className="mr-1 h-4 w-4 text-destructive" />
            Revoke admin
          </>
        ) : (
          <>
            <ShieldCheck className="mr-1 h-4 w-4" />
            Make admin
          </>
        )}
      </Button>
    </form>
  );
}

export function MemberRolesTable({
  members,
  superAdminIds,
  coreRoleByMemberId,
}: {
  members: Member[];
  superAdminIds: Set<string>;
  coreRoleByMemberId: Map<string, string | null>;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query),
    );
  }, [members, q]);

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search all ${members.length} members by name or email...`}
        className="max-w-sm"
      />

      <div className="max-h-[28rem] overflow-y-auto rounded-lg border">
        <div className="divide-y">
          {filtered.map((m) => {
            const isAdmin = superAdminIds.has(m.id);
            return (
              <div
                key={m.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{m.full_name}</p>
                    {isAdmin ? <Badge>Super Admin</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CoreRoleSelect
                    // Remounts if the resolved role changes (e.g. once
                    // the async core-team query settles after mount)
                    // instead of mutating an already-initialized
                    // uncontrolled Select's defaultValue, which Base UI
                    // warns about.
                    key={coreRoleByMemberId.get(m.id) ?? "none"}
                    memberId={m.id}
                    currentRole={coreRoleByMemberId.get(m.id) ?? null}
                  />
                  <SuperAdminToggle memberId={m.id} isAdmin={isAdmin} />
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No members match &quot;{q}&quot;.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
