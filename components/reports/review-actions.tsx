"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { reviewReport } from "@/lib/actions/reports";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

const initial: ActionResult = { error: null };

export function ReportReviewActions({ reportId }: { reportId: string }) {
  const [reviewState, reviewAction, reviewPending] = useActionState(reviewReport, initial);
  const [dismissState, dismissAction, dismissPending] = useActionState(reviewReport, initial);

  useEffect(() => {
    if (reviewState.success) toast.success(reviewState.success);
    if (reviewState.error) toast.error(reviewState.error);
  }, [reviewState]);
  useEffect(() => {
    if (dismissState.success) toast.success(dismissState.success);
    if (dismissState.error) toast.error(dismissState.error);
  }, [dismissState]);

  return (
    <div className="flex gap-2">
      <form action={reviewAction}>
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="status" value="reviewed" />
        <Button type="submit" size="sm" variant="outline" disabled={reviewPending}>
          <Check className="mr-1 h-4 w-4" />
          Mark reviewed
        </Button>
      </form>
      <form action={dismissAction}>
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="status" value="dismissed" />
        <Button type="submit" size="sm" variant="ghost" disabled={dismissPending}>
          <X className="mr-1 h-4 w-4" />
          Dismiss
        </Button>
      </form>
    </div>
  );
}
