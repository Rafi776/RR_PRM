"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { uploadNocs } from "@/lib/actions/noc";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = { error: null };

// A member uploads both a District NOC and a Unit NOC — separate
// documents, reviewed independently — but can supply either or both
// in a single submit. A type already pending/approved is skipped
// server-side rather than blocked here, so the same form still works
// once one type needs re-uploading after a rejection.
export function NocUploadForm({
  districtLocked,
  unitLocked,
}: {
  districtLocked: boolean;
  unitLocked: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadNocs, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const districtId = useId();
  const unitId = useId();

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={districtId}>District NOC (PDF or image)</Label>
          <Input
            id={districtId}
            name="districtFile"
            type="file"
            accept=".pdf,image/*"
            disabled={districtLocked}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={unitId}>Unit NOC (PDF or image)</Label>
          <Input
            id={unitId}
            name="unitFile"
            type="file"
            accept=".pdf,image/*"
            disabled={unitLocked}
          />
        </div>
      </div>
      <Button type="submit" disabled={pending || (districtLocked && unitLocked)}>
        {pending ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
}
