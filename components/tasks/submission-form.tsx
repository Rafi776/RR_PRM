"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { submitTask } from "@/lib/actions/tasks";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = { error: null };

export function SubmissionForm({
  taskId,
  currentUrl,
}: {
  taskId: string;
  currentUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitTask, initial);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="flex-1 space-y-2">
        <Label htmlFor="submissionUrl">Submission link</Label>
        <Input
          id="submissionUrl"
          name="submissionUrl"
          placeholder="https://..."
          defaultValue={currentUrl ?? ""}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting..." : "Submit"}
      </Button>
    </form>
  );
}
