"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { addTeamMember, type ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initial: ActionResult = { error: null };

export function AddMemberForm({
  teamId,
  candidates,
}: {
  teamId: string;
  candidates: { id: string; full_name: string; email: string }[];
}) {
  const [state, formAction, pending] = useActionState(addTeamMember, initial);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">All members are already on this team.</p>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="memberId" value={selected} />
      <Select
        value={selected}
        items={candidates.map((c) => ({ value: c.id, label: `${c.full_name} (${c.email})` }))}
        onValueChange={(value) => setSelected(value ?? "")}
      >
        <SelectTrigger className="h-9 w-[260px]">
          <SelectValue placeholder="Select a member to add" />
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
        {pending ? "Adding..." : "Add to team"}
      </Button>
    </form>
  );
}
