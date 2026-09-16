"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateOwnPhone } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = { error: null };

export function PhoneForm({ currentPhone }: { currentPhone: string | null }) {
  const [state, formAction, pending] = useActionState(updateOwnPhone, initial);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={currentPhone ?? ""} className="w-56" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
