"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTaskComment } from "@/lib/actions/tasks";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionResult = { error: null };

export function CommentForm({ taskId }: { taskId: string }) {
  const [state, formAction, pending] = useActionState(addTaskComment, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea name="comment" placeholder="Add a comment..." rows={2} required />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Posting..." : "Post comment"}
      </Button>
    </form>
  );
}
