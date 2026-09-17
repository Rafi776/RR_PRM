"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { bulkImportTasks, type BulkTaskImportResult } from "@/lib/actions/tasks";
import { downloadExampleCsv } from "@/lib/utils/download-csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Upload, FileDown } from "lucide-react";

const initial: BulkTaskImportResult = { error: null, imported: 0, skipped: [] };

export function BulkImportTasksDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(bulkImportTasks, initial);

  useEffect(() => {
    if (state.imported > 0) toast.success(`Imported ${state.imported} task(s).`);
  }, [state.imported]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Upload className="mr-1 h-4 w-4" />
        Bulk import
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Bulk import tasks</DialogTitle>
            <DialogDescription>
              CSV or Excel (.xlsx/.xls). Columns:{" "}
              <code>title, description, team_slug, task_type, points, due_date</code>.
              Leave <code>team_slug</code> blank for a global task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-primary"
              onClick={() =>
                downloadExampleCsv(
                  "task-import-example.csv",
                  ["title", "description", "team_slug", "task_type", "points", "due_date"],
                  [
                    "Write a blog post",
                    "Publish a 500-word post about the recent event.",
                    "social-media",
                    "Blog Post",
                    "10",
                    "2026-12-31",
                  ],
                )
              }
            >
              <FileDown className="mr-1 h-4 w-4" />
              Download example file
            </Button>
            <div className="space-y-2">
              <Label htmlFor="task-file">CSV or Excel file</Label>
              <Input
                id="task-file"
                name="file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                required
              />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            {state.skipped.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs">
                <p className="mb-1 font-medium text-destructive">
                  {state.skipped.length} row(s) skipped:
                </p>
                <ul className="space-y-0.5">
                  {state.skipped.map((s) => (
                    <li key={s.row}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
