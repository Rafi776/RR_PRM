"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { fileReport } from "@/lib/actions/reports";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Flag } from "lucide-react";

const initial: ActionResult = { error: null };

export function ReportMemberDialog({
  memberId,
  fullName,
}: {
  memberId: string;
  fullName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(fileReport, initial);

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
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <Flag className="mr-1 h-4 w-4" />
        Report
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="reportedMemberId" value={memberId} />
          <DialogHeader>
            <DialogTitle>Report {fullName}</DialogTitle>
            <DialogDescription>
              Only you and admins will ever see this report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" name="reason" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Details (optional)</Label>
              <Textarea id="details" name="details" rows={4} />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting..." : "Submit report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
