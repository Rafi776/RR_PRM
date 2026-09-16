"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateMemberDetails } from "@/lib/actions/teams";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import type { TeamMemberRow } from "@/lib/data/teams";

const initial: ActionResult = { error: null };

export function EditMemberDialog({ member }: { member: TeamMemberRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateMemberDetails, initial);
  const [status, setStatus] = useState(member.status);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog in response to a server action result, not deriving render state
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="memberId" value={member.member_id} />
          <input type="hidden" name="status" value={status} />
          <DialogHeader>
            <DialogTitle>Edit {member.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bsId">BS ID</Label>
                <Input id="bsId" name="bsId" defaultValue={member.bs_id ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage">Stage</Label>
                <Input id="stage" name="stage" defaultValue={member.stage ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scoutGroup">Scout Group</Label>
                <Input id="scoutGroup" name="scoutGroup" defaultValue={member.scout_group ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input id="district" name="district" defaultValue={member.district ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team label</Label>
                <Input id="teamName" name="teamName" defaultValue={member.team_name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input id="position" name="position" defaultValue={member.position ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
