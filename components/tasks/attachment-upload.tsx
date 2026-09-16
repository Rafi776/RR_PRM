"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addTaskAttachment } from "@/lib/actions/tasks";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: ActionResult = { error: null };

export function AttachmentUpload({ taskId }: { taskId: string }) {
  const [state, formAction, pending] = useActionState(addTaskAttachment, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <Input name="file" type="file" required className="max-w-xs" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Uploading..." : "Attach file"}
      </Button>
    </form>
  );
}
