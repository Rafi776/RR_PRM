"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { blockMember, unblockMember } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
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
import { ShieldBan, ShieldCheck } from "lucide-react";

const initial: ActionResult = { error: null };

export function BlockMemberControl({
  memberId,
  fullName,
  blockedAt,
  blockedReason,
}: {
  memberId: string;
  fullName: string;
  blockedAt: string | null;
  blockedReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [blockState, blockAction, blockPending] = useActionState(blockMember, initial);
  const [unblockState, unblockAction, unblockPending] = useActionState(unblockMember, initial);

  useEffect(() => {
    if (blockState.success) {
      toast.success(blockState.success);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog in response to a server action result, not deriving render state
      setOpen(false);
    }
    if (blockState.error) toast.error(blockState.error);
  }, [blockState.success, blockState.error]);

  useEffect(() => {
    if (unblockState.success) toast.success(unblockState.success);
    if (unblockState.error) toast.error(unblockState.error);
  }, [unblockState.success, unblockState.error]);

  if (blockedAt) {
    return (
      <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm">
          <span className="font-medium">Blocked</span> since{" "}
          {new Date(blockedAt).toLocaleDateString()}
          {blockedReason ? ` — ${blockedReason}` : ""}
        </p>
        <form action={unblockAction}>
          <input type="hidden" name="memberId" value={memberId} />
          <Button type="submit" size="sm" variant="outline" disabled={unblockPending}>
            <ShieldCheck className="mr-1 h-4 w-4" />
            {unblockPending ? "Unblocking..." : "Unblock member"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <ShieldBan className="mr-1 h-4 w-4 text-destructive" />
        Block member
      </DialogTrigger>
      <DialogContent>
        <form action={blockAction}>
          <input type="hidden" name="memberId" value={memberId} />
          <DialogHeader>
            <DialogTitle>Block {fullName}?</DialogTitle>
            <DialogDescription>
              This cancels their membership (status set to inactive) and blocks
              them from signing in. It can be reversed later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="reason">Reason (optional, kept internally)</Label>
            <Textarea id="reason" name="reason" rows={3} />
            {blockState.error ? (
              <p className="text-sm text-destructive">{blockState.error}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={blockPending}>
              {blockPending ? "Blocking..." : "Block and cancel membership"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
