"use client";

import { startTransition, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { setCoreRole, type ActionResult } from "@/lib/actions/teams";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CORE_ROLES = [
  "Convener",
  "Joint Convener",
  "Member Secretary",
  "Deputy Member Secretary",
] as const;

const initial: ActionResult = { error: null };

export function CoreRoleSelect({
  memberId,
  currentRole,
}: {
  memberId: string;
  currentRole: string | null;
}) {
  const [state, formAction] = useActionState(setCoreRole, initial);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <Select
      defaultValue={currentRole ?? "none"}
      items={[
        { value: "none", label: "No fixed role" },
        ...CORE_ROLES.map((role) => ({ value: role, label: role })),
      ]}
      onValueChange={(value) => {
        if (value === null) return;
        const fd = new FormData();
        fd.set("memberId", memberId);
        fd.set("coreRole", value === "none" ? "" : value);
        startTransition(() => formAction(fd));
      }}
    >
      <SelectTrigger className="h-8 w-[210px]">
        <SelectValue placeholder="No fixed role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No fixed role</SelectItem>
        {CORE_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {role}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
