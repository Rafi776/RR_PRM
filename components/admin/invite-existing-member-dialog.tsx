"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { inviteExistingMember } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

const initial: ActionResult = { error: null };

// For adding someone who already has a login (in another org) to this
// org too. A brand-new person should go through "Bulk import members"
// instead — this only works for an email that already has an account.
export function InviteExistingMemberDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(inviteExistingMember, initial);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog in response to a server action result, not deriving render state
      setOpen(false);
    }
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlus className="mr-1 h-4 w-4" />
        Add existing member
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Add an existing member to your organization</DialogTitle>
            <DialogDescription>
              For someone who already has a login (e.g. a member of another
              organization on this platform). Enter their email — if no
              account exists yet, use &quot;Bulk import members&quot; instead
              to create one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" name="email" type="email" required />
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add to organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
