"use client";

import { startTransition, useActionState } from "react";
import { toast } from "sonner";
import { setTeamLeadership, type ActionResult } from "@/lib/actions/teams";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initial: ActionResult = { error: null };

export function LeadershipSelect({
  teamId,
  role,
  members,
  currentMemberId,
}: {
  teamId: string;
  role: "coordinator" | "deputy";
  members: { id: string; full_name: string }[];
  currentMemberId: string | null;
}) {
  const [, formAction] = useActionState(setTeamLeadership, initial);

  return (
    <Select
      defaultValue={currentMemberId ?? "none"}
      items={[
        { value: "none", label: "Unassigned" },
        ...members.map((m) => ({ value: m.id, label: m.full_name })),
      ]}
      onValueChange={(value) => {
        if (value === null || value === "none") return;
        const fd = new FormData();
        fd.set("teamId", teamId);
        fd.set("memberId", value);
        fd.set("role", role);
        startTransition(() => formAction(fd));
        toast.success(`${role === "coordinator" ? "Coordinator" : "Deputy Coordinator"} updated.`);
      }}
    >
      <SelectTrigger className="h-8 w-[220px]">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
