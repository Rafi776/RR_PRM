"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { reviewTaskStatus } from "@/lib/actions/tasks";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

const initial: ActionResult = { error: null };

export function ReviewStatusActions({
  taskId,
  memberId,
}: {
  taskId: string;
  memberId: string;
}) {
  const [selectState, selectAction, selectPending] = useActionState(reviewTaskStatus, initial);
  const [rejectState, rejectAction, rejectPending] = useActionState(reviewTaskStatus, initial);

  useEffect(() => {
    if (selectState.success) toast.success(selectState.success);
    if (selectState.error) toast.error(selectState.error);
  }, [selectState]);
  useEffect(() => {
    if (rejectState.success) toast.success(rejectState.success);
    if (rejectState.error) toast.error(rejectState.error);
  }, [rejectState]);

  return (
    <div className="flex gap-2">
      <form action={selectAction}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="status" value="selected" />
        <Button type="submit" size="sm" variant="outline" disabled={selectPending}>
          <Check className="mr-1 h-4 w-4" />
          Select
        </Button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="status" value="rejected" />
        <Button type="submit" size="sm" variant="outline" disabled={rejectPending}>
          <X className="mr-1 h-4 w-4" />
          Reject
        </Button>
      </form>
    </div>
  );
}
