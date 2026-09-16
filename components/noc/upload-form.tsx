"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { uploadNoc } from "@/lib/actions/noc";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = { error: null };

export function NocUploadForm() {
  const [state, formAction, pending] = useActionState(uploadNoc, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="noc-file">Upload NOC (PDF or image)</Label>
        <Input id="noc-file" name="file" type="file" accept=".pdf,image/*" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading..." : "Upload"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
