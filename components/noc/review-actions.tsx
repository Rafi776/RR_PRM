"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { reviewNoc } from "@/lib/actions/noc";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, X } from "lucide-react";

const initial: ActionResult = { error: null };

export function ReviewActions({ nocId }: { nocId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(reviewNoc, initial);
  const [rejectState, rejectAction, rejectPending] = useActionState(reviewNoc, initial);
  const [rejectOpen, setRejectOpen] = useState(false);

  useEffect(() => {
    if (approveState.success) toast.success(approveState.success);
    if (approveState.error) toast.error(approveState.error);
  }, [approveState]);

  useEffect(() => {
    if (rejectState.success) {
      toast.success(rejectState.success);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog in response to a server action result, not deriving render state
      setRejectOpen(false);
    }
    if (rejectState.error) toast.error(rejectState.error);
  }, [rejectState]);

  return (
    <div className="flex gap-2">
      <form action={approveAction}>
        <input type="hidden" name="nocId" value={nocId} />
        <input type="hidden" name="decision" value="approved" />
        <Button type="submit" size="sm" variant="outline" disabled={approvePending}>
          <Check className="mr-1 h-4 w-4" />
          Approve
        </Button>
      </form>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger render={<Button size="sm" variant="outline" />}>
          <X className="mr-1 h-4 w-4" />
          Reject
        </DialogTrigger>
        <DialogContent>
          <form action={rejectAction}>
            <input type="hidden" name="nocId" value={nocId} />
            <input type="hidden" name="decision" value="rejected" />
            <DialogHeader>
              <DialogTitle>Reject NOC submission</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                name="rejectionReason"
                placeholder="Reason for rejection"
                required
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={rejectPending}>
                {rejectPending ? "Rejecting..." : "Confirm rejection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
